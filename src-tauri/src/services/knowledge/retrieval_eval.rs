use super::{index, save, MemoryEntry};
use std::time::Instant;

/// Small deterministic relevance set, not a general semantic-RAG benchmark.
#[test]
fn curated_bilingual_retrieval_recall() {
    let root = tempfile::tempdir().unwrap();
    let corpus = [
        ("coast", "沿海城市", "# 气候观察\n\n海平面上升影响沿海城市。Coastal cities track sea level rise and flooding."),
        ("orchard", "果园笔记", "# 苹果树\n\n春季修剪果树枝条，有利于通风。Prune apple trees in early spring."),
        ("rust", "Rust ownership", "# Memory safety\n\nOwnership and borrowing prevent data races. Rust 内存安全与所有权。"),
        ("writing", "写作节奏", "# 具体的文字\n\n用简洁短句描写光影。Concrete observations and short sentences keep prose clear."),
        ("photo", "摄影笔记", "# 暮色\n\n黄昏拍摄降低快门速度。Use a tripod for long exposure photography."),
        ("meeting", "会议纪要", "# 决策\n\n会议安排在周四，先回顾计划，再讨论发布。Review the release agenda on Thursday."),
    ];
    let mut ids = std::collections::HashMap::new();
    let indexing = Instant::now();
    for (key, title, content) in corpus {
        let entry = save(
            root.path(),
            MemoryEntry {
                id: uuid::Uuid::new_v4().to_string(),
                title: title.into(),
                content: content.into(),
                kind: "knowledge".into(),
                document_id: "".into(),
                source: format!("{key}.md"),
                archived: false,
                revision: 0,
                updated_at: 0,
            },
        )
        .unwrap();
        ids.insert(key, entry.id);
    }
    let cases = [
        ("海平面 城市", "coast"),
        ("sea level cities", "coast"),
        ("春季 修剪", "orchard"),
        ("apple spring", "orchard"),
        ("内存安全", "rust"),
        ("ownership borrowing", "rust"),
        ("简洁 光影", "writing"),
        ("concrete sentences", "writing"),
        ("快门", "photo"),
        ("tripod exposure", "photo"),
        ("会议 周四", "meeting"),
        ("release Thursday", "meeting"),
    ];
    let index_ms = indexing.elapsed().as_secs_f64() * 1000.0;
    let searching = Instant::now();
    let mut found = 0;
    let mut first = 0;
    for (query, key) in cases {
        let hits = index::search(root.path(), query, "doc").unwrap();
        if hits.iter().take(6).any(|hit| hit.memory_id == ids[key]) {
            found += 1;
        }
        if hits.first().is_some_and(|hit| hit.memory_id == ids[key]) {
            first += 1;
        }
        for chunk in hits {
            assert_eq!(
                index::read(root.path(), &chunk.id, "doc").unwrap().content,
                chunk.content
            );
        }
    }
    println!("Curated retrieval: Recall@6={found}/12, Top1={first}/12; indexing={index_ms:.2}ms; 12 searches + source reads={:.2}ms", searching.elapsed().as_secs_f64() * 1000.0);
    assert_eq!(found, 12);
    assert_eq!(first, 12);
}
