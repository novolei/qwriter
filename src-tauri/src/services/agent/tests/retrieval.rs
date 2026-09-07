use super::*;
use crate::services::knowledge::{self, retriever::LocalRetriever, MemoryEntry};
use std::sync::Arc;

#[test]
fn loop_retrieves_versioned_chunks_without_preloading_the_library() {
    let root = tempfile::tempdir().unwrap();
    let saved = knowledge::save(
        root.path(),
        MemoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            title: "Garden observations".into(),
            content: "# Observation\n\nMorning light shines on the garden leaves.".into(),
            source: "field-notes.md".into(),
            kind: "knowledge".into(),
            document_id: "doc-a".into(),
            archived: false,
            revision: 0,
            updated_at: 0,
        },
    )
    .unwrap();
    let chunk = knowledge::index::search(root.path(), "garden", "doc-a")
        .unwrap()
        .remove(0);
    let (url, server) = server(vec![
        call("search_memory", json!({"query":"garden"})),
        call("read_memory", json!({"id":chunk.id})),
        call(
            "propose_draft",
            json!({"title":"Morning", "markdown":"The leaves shine.", "summary":"Based on field notes."}),
        ),
    ]);
    let mut goal = input();
    goal.harness = Some(options::HarnessOptions {
        memory_enabled: true,
        document_id: "doc-a".into(),
        ..Default::default()
    });
    let context = context::prepare(root.path(), goal.harness.as_ref().unwrap()).unwrap();
    assert!(context.memories.is_empty());
    assert!(context.retriever.is_some());
    let result = tauri::async_runtime::block_on(run_with_context(
        config(url, "openai"),
        goal,
        CancellationToken::new(),
        context,
        |_| Ok(()),
    ))
    .unwrap();
    assert!(result.draft.is_some());
    assert!(result.memory_read_ids.contains(&saved.id));
    assert!(result
        .knowledge_sources
        .iter()
        .any(|c| c.id == chunk.id && c.revision == 1));
    let requests = server.join().unwrap();
    assert!(!requests[0].to_string().contains("Morning light"));
    assert!(requests[1].to_string().contains("field-notes.md"));
    assert!(requests[2].to_string().contains("startLine"));
}

#[test]
fn changed_or_out_of_scope_chunks_are_not_returned_to_the_model() {
    let root = tempfile::tempdir().unwrap();
    let saved = knowledge::save(
        root.path(),
        MemoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            title: "Private".into(),
            content: "unique reference".into(),
            source: "user".into(),
            kind: "knowledge".into(),
            document_id: "other".into(),
            archived: false,
            revision: 0,
            updated_at: 0,
        },
    )
    .unwrap();
    let chunk = knowledge::chunks::split(&saved).remove(0);
    let (url, server) = server(vec![
        call("read_memory", json!({"id":chunk.id})),
        json!({"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"Source unavailable"}}]}),
    ]);
    let mut goal = input();
    goal.harness = Some(options::HarnessOptions {
        memory_enabled: true,
        ..Default::default()
    });
    let context = context::RunContext {
        retriever: Some(Arc::new(LocalRetriever {
            root: root.path().to_owned(),
            document_id: "doc".into(),
        })),
        ..Default::default()
    };
    let output = tauri::async_runtime::block_on(run_with_context(
        config(url, "openai"),
        goal,
        CancellationToken::new(),
        context,
        |_| Ok(()),
    ))
    .unwrap();
    assert!(output.knowledge_sources.is_empty());
    let requests = server.join().unwrap();
    assert!(requests[1]
        .to_string()
        .contains("Source unavailable or changed"));
    assert!(!requests[1].to_string().contains("unique reference"));
}

#[test]
fn cancellation_stops_while_an_async_retriever_is_waiting() {
    use knowledge::{chunks::KnowledgeChunk, retriever::KnowledgeRetriever};
    struct Waiting(Arc<tokio::sync::Notify>);
    impl KnowledgeRetriever for Waiting {
        fn search(
            &self,
            _: String,
        ) -> std::pin::Pin<
            Box<dyn std::future::Future<Output = AppResult<Vec<KnowledgeChunk>>> + Send + '_>,
        > {
            Box::pin(async move {
                self.0.notify_one();
                std::future::pending().await
            })
        }
        fn read(
            &self,
            _: String,
        ) -> std::pin::Pin<
            Box<dyn std::future::Future<Output = AppResult<KnowledgeChunk>> + Send + '_>,
        > {
            Box::pin(std::future::pending())
        }
    }
    let (url, server) = server(vec![call("search_memory", json!({"query":"garden"}))]);
    let mut goal = input();
    goal.harness = Some(options::HarnessOptions {
        memory_enabled: true,
        ..Default::default()
    });
    let entered = Arc::new(tokio::sync::Notify::new());
    let context = context::RunContext {
        retriever: Some(Arc::new(Waiting(entered.clone()))),
        ..Default::default()
    };
    tauri::async_runtime::block_on(async {
        let token = CancellationToken::new();
        let cancel = token.clone();
        let task = tokio::spawn(async move {
            entered.notified().await;
            cancel.cancel();
        });
        let output = tokio::time::timeout(
            Duration::from_secs(5),
            run_with_context(config(url, "openai"), goal, token, context, |_| Ok(())),
        )
        .await
        .unwrap()
        .unwrap();
        assert!(matches!(output.status, AgentStatus::Cancelled));
        task.await.unwrap();
    });
    server.join().unwrap();
}
