use super::*;
#[test]
fn revision_scope_search_and_archive() {
    let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
    let entry = MemoryEntry {
        id: uuid::Uuid::new_v4().to_string(),
        title: "写作偏好".into(),
        content: "喜欢简洁具体的短句。".into(),
        kind: "preference".into(),
        document_id: "doc-a".into(),
        source: "User".into(),
        archived: false,
        revision: 0,
        updated_at: 0,
    };
    let saved = save(&root, entry.clone()).unwrap();
    assert!(save(&root, entry).is_err());
    assert_eq!(search(&root, "简洁", "doc-a").unwrap().len(), 1);
    assert_eq!(search(&root, "具体的短句", "doc-a").unwrap().len(), 1);
    assert!(search(&root, "简洁", "doc-b").unwrap().is_empty());
    let archived = save(
        &root,
        MemoryEntry {
            archived: true,
            ..saved
        },
    )
    .unwrap();
    assert!(search(&root, "具体的短句", "doc-a").unwrap().is_empty());
    assert_eq!(list(&root).unwrap()[0].revision, 2);
    save(
        &root,
        MemoryEntry {
            archived: false,
            ..archived
        },
    )
    .unwrap();
    assert_eq!(search(&root, "具体的短句", "doc-a").unwrap().len(), 1);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn history_is_immutable_and_bounded_after_reopening() {
    use crate::services::agent::types::{AgentOutput, AgentStatus};
    let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
    let mut last = None;
    for n in 0..102 {
        let session = sessions::AgentSession {
            id: uuid::Uuid::new_v4().to_string(),
            instruction: format!("Goal {n}"),
            model: "fixture".into(),
            document_id: "doc".into(),
            created_at: n,
            output: AgentOutput {
                status: AgentStatus::Complete,
                answer: "Result".into(),
                draft: None,
                rounds: 1,
                read_ids: vec![],
                memories: vec![],
                memory_read_ids: vec![],
            },
        };
        sessions::save(&root, session.clone()).unwrap();
        last = Some(session);
    }
    let mut duplicate = last.unwrap();
    duplicate.instruction = "Do not overwrite".into();
    sessions::save(&root, duplicate).unwrap();
    let saved = sessions::list(&root).unwrap();
    assert_eq!(saved.len(), 100);
    assert_eq!(saved[0].instruction, "Goal 101");
    assert_eq!(saved[99].instruction, "Goal 2");
    std::fs::remove_dir_all(root).unwrap();
}
