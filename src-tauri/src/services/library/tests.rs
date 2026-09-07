use super::*;
#[test]
fn unsafe_js_integer_cannot_enter_the_document_store() {
    let mut db = connect(std::path::Path::new(":memory:")).unwrap();
    let mut invalid = doc("original");
    invalid.updated = 9_007_199_254_740_992;
    assert!(save(&mut db, &[invalid], 0).is_err());
    assert!(load(&db, String::new()).unwrap().docs.is_empty());
}
fn doc(text: &str) -> Document {
    Document {
        id: "test".into(),
        title: "文稿".into(),
        markdown: text.into(),
        updated: 1,
    }
}
#[test]
fn disk_roundtrip_and_previous_content_survives() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("library.db");
    let mut db = connect(&file).unwrap();
    assert_eq!(save(&mut db, &[doc("旧文")], 0).unwrap(), 1);
    save(&mut db, &[doc("新文")], 1).unwrap();
    drop(db);
    let db = connect(&file).unwrap();
    let state = load(&db, String::new()).unwrap();
    assert_eq!(state.docs[0].markdown, "新文");
    assert_eq!(state.revision, 2);
    assert_eq!(
        db.query_row("SELECT markdown FROM snapshots", [], |r| r
            .get::<_, String>(0))
            .unwrap(),
        "旧文"
    );
}
#[test]
fn stale_writer_and_invalid_batch_cannot_overwrite() {
    let mut db = connect(std::path::Path::new(":memory:")).unwrap();
    save(&mut db, &[doc("原文")], 0).unwrap();
    assert!(save(&mut db, &[doc("覆盖")], 0).is_err());
    assert!(save(&mut db, &[doc("覆盖"), doc("重复")], 1).is_err());
    assert_eq!(load(&db, String::new()).unwrap().docs[0].markdown, "原文");
}
#[test]
fn history_is_bounded_and_missing_docs_are_preserved() {
    let mut db = connect(std::path::Path::new(":memory:")).unwrap();
    for i in 0..55 {
        save(&mut db, &[doc(&format!("v{i}"))], i).unwrap();
    }
    assert_eq!(
        db.query_row("SELECT COUNT(*) FROM snapshots", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        50
    );
    let mut other = doc("另一篇");
    other.id = "other".into();
    save(&mut db, &[other], 55).unwrap();
    assert_eq!(load(&db, String::new()).unwrap().docs.len(), 2);
}
