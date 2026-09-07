use super::*;

fn entry(title: &str, content: &str, scope: &str) -> MemoryEntry {
    MemoryEntry {
        id: uuid::Uuid::new_v4().to_string(),
        title: title.into(),
        content: content.into(),
        kind: "knowledge".into(),
        document_id: scope.into(),
        source: "fixture.md".into(),
        archived: false,
        revision: 0,
        updated_at: 0,
    }
}

#[test]
fn chunks_preserve_unicode_crlf_fences_and_source_anchors() {
    let content = format!(
        "# 标题 🪶\r\n\r\n简洁的段落。\r\n\r\n## 章节\r\n```md\r\n# not a heading\r\n```\r\n\r\n{}",
        "🌲".repeat(2500)
    );
    let entry = entry("Source", &content, "doc");
    let chunks = chunks::split(&entry);
    assert_eq!(chunks, chunks::split(&entry));
    let scalars: Vec<_> = content.chars().collect();
    for chunk in &chunks {
        assert_eq!(
            chunk.content,
            scalars[chunk.start_offset as usize..chunk.end_offset as usize]
                .iter()
                .collect::<String>()
        );
        assert!(chunk.content.chars().count() <= 1200);
        assert_eq!(
            chunk.start_line,
            scalars[..chunk.start_offset as usize]
                .iter()
                .filter(|c| **c == '\n')
                .count() as u32
                + 1
        );
    }
    assert!(chunks
        .iter()
        .any(|c| c.content.contains("# not a heading") && c.heading == "标题 🪶 / 章节"));
    assert!(chunks.last().unwrap().content.contains('🌲'));
}

#[test]
fn bilingual_relevance_scope_archive_and_revisions() {
    let root = tempfile::tempdir().unwrap();
    let best = save(
        root.path(),
        entry(
            "森林写作",
            "# 森林\n\n森林里的光影让写作变得具体。\n\n短句能够承载观察。",
            "doc-a",
        ),
    )
    .unwrap();
    save(
        root.path(),
        entry("Writing", "A writing guide for concrete sentences.", ""),
    )
    .unwrap();
    save(
        root.path(),
        entry("Forest", "A forest grows with quiet light.", ""),
    )
    .unwrap();
    save(
        root.path(),
        entry("Secret", "森林写作 forest writing secret", "doc-b"),
    )
    .unwrap();
    let hits = index::search(root.path(), "森林 写作", "doc-a").unwrap();
    assert_eq!(hits[0].memory_id, best.id);
    assert!(hits.iter().all(|c| c.document_id != "doc-b"));
    assert!(!index::search(root.path(), "短", "doc-a")
        .unwrap()
        .is_empty());
    let english = index::search(root.path(), "concrete sentences", "doc-a").unwrap();
    assert_eq!(english[0].title, "Writing");
    assert!(index::search(root.path(), "\" OR *", "doc-a")
        .unwrap()
        .is_empty());
    let chunk = hits[0].clone();
    assert_eq!(index::read(root.path(), &chunk.id, "doc-a").unwrap(), chunk);
    assert!(index::read(root.path(), &chunk.id, "doc-b").is_err());
    let updated = save(
        root.path(),
        MemoryEntry {
            title: "新资料".into(),
            content: "已经修改，只有新资料。".into(),
            ..best
        },
    )
    .unwrap();
    assert!(index::read(root.path(), &chunk.id, "doc-a").is_err());
    assert!(index::search(root.path(), "森林", "doc-a")
        .unwrap()
        .is_empty());
    // Old task snapshots keep the exact evidence even when current anchors expire.
    assert!(chunk.content.contains("森林"));
    let archived = save(
        root.path(),
        MemoryEntry {
            archived: true,
            ..updated
        },
    )
    .unwrap();
    assert!(index::source(root.path(), &archived.id, "doc-a")
        .unwrap()
        .is_none());
    assert!(index::search(root.path(), "资料", "doc-a")
        .unwrap()
        .is_empty());
    save(
        root.path(),
        MemoryEntry {
            archived: false,
            ..archived
        },
    )
    .unwrap();
    assert!(!index::search(root.path(), "资料", "doc-a")
        .unwrap()
        .is_empty());
}

#[test]
fn legacy_index_backfill_is_atomic_and_does_not_change_records() {
    let root = tempfile::tempdir().unwrap();
    let mut legacy = entry("Legacy", "A recoverable knowledge record.", "");
    legacy.revision = 7;
    let db = connect(root.path()).unwrap();
    db.execute(
        "INSERT INTO memories(id,revision,data) VALUES(?1,?2,?3)",
        params![
            legacy.id,
            legacy.revision,
            serde_json::to_string(&legacy).unwrap()
        ],
    )
    .unwrap();
    let first = index::search(root.path(), "recoverable", "doc").unwrap();
    assert_eq!(first.len(), 1);
    assert_eq!(first[0].revision, 7);
    assert_eq!(
        index::search(root.path(), "recoverable", "doc").unwrap(),
        first
    );
    assert_eq!(list(root.path()).unwrap()[0].content, legacy.content);
    assert_eq!(
        db.query_row("SELECT count(*) FROM knowledge_index", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        1
    );
}

#[test]
fn diversity_and_preferences_remain_bounded() {
    let root = tempfile::tempdir().unwrap();
    save(
        root.path(),
        entry("Many", &"shared evidence\n\n".repeat(40), ""),
    )
    .unwrap();
    save(
        root.path(),
        entry("Another", "shared evidence from another source", ""),
    )
    .unwrap();
    let hits = index::search(root.path(), "shared evidence", "").unwrap();
    assert_eq!(hits.iter().filter(|c| c.title == "Many").count(), 3);
    assert!(hits.iter().any(|c| c.title == "Another"));
    for n in 0..9 {
        save(
            root.path(),
            MemoryEntry {
                kind: "preference".into(),
                ..entry(&format!("Preference {n}"), "Use specific language", "a")
            },
        )
        .unwrap();
    }
    assert_eq!(index::preferences(root.path(), "a").unwrap().len(), 6);
    assert!(index::preferences(root.path(), "b").unwrap().is_empty());
}
