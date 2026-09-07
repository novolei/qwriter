use super::*;
#[test]
fn local_workflow_and_unselected_staging_protection() {
    let dir = tempfile::tempdir().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    std::fs::write(dir.path().join("文稿.md"), "# 中文\n\n第一版\n").unwrap();
    let state = inspect(&repo).unwrap();
    assert_eq!(state.changes.len(), 1);
    assert!(state.head.is_empty());
    assert!(file_diff(&repo, "文稿.md").unwrap().text.contains("第一版"));
    let id = commit_selected(
        &repo,
        &["文稿.md".into()],
        "初稿",
        "Writer",
        "writer@example.test",
        "",
    )
    .unwrap();
    assert!(inspect(&repo).unwrap().changes.is_empty());
    std::fs::write(dir.path().join("文稿.md"), "# 中文\n\n第二版\n").unwrap();
    std::fs::write(dir.path().join("另一个.md"), "单独暂存").unwrap();
    let mut index = repo.index().unwrap();
    index.add_path(Path::new("另一个.md")).unwrap();
    index.write().unwrap();
    assert!(commit_selected(
        &repo,
        &["文稿.md".into()],
        "修改",
        "Writer",
        "writer@example.test",
        &id
    )
    .unwrap_err()
    .contains("未选择"));
    assert_eq!(head_id(&repo).unwrap(), id);
    assert_eq!(inspect(&repo).unwrap().history.len(), 1);
}
#[test]
fn rejects_parent_paths_and_stale_head() {
    for file in ["../secret", "/absolute", ".git/config", "a/../../b"] {
        assert!(safe_relative(file).is_err());
    }
    let dir = tempfile::tempdir().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    assert!(commit_selected(
        &repo,
        &["a.md".into()],
        "message",
        "Writer",
        "writer@example.test",
        "stale"
    )
    .unwrap_err()
    .contains("版本已变化"));
}
#[test]
fn commits_a_previously_staged_deletion() {
    let dir = tempfile::tempdir().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    std::fs::write(dir.path().join("draft.md"), "draft").unwrap();
    let head = commit_selected(
        &repo,
        &["draft.md".into()],
        "create",
        "Writer",
        "writer@example.test",
        "",
    )
    .unwrap();
    std::fs::remove_file(dir.path().join("draft.md")).unwrap();
    let mut index = repo.index().unwrap();
    index.remove_path(Path::new("draft.md")).unwrap();
    index.write().unwrap();
    commit_selected(
        &repo,
        &["draft.md".into()],
        "remove",
        "Writer",
        "writer@example.test",
        &head,
    )
    .unwrap();
    assert!(inspect(&repo).unwrap().changes.is_empty());
    assert_eq!(inspect(&repo).unwrap().history.len(), 2);
}
