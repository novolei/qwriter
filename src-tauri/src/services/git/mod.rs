//! Local Git operations use libgit2. No shell, credential storage, hooks or network.
use git2::{
    DiffFormat, DiffOptions, Repository, RepositoryState, Signature, Status, StatusOptions,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    path::{Component, Path},
    sync::{Arc, Mutex},
};

#[derive(Default)]
pub struct GitLock(pub Arc<Mutex<()>>);
#[derive(Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub path: String,
    pub kind: String,
    pub staged: bool,
}
#[derive(Serialize, serde::Deserialize, specta::Type)]
pub struct Commit {
    pub id: String,
    pub summary: String,
    pub author: String,
    pub time: i64,
}
#[derive(Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub path: String,
    pub branch: String,
    pub head: String,
    pub changes: Vec<Change>,
    pub history: Vec<Commit>,
    pub truncated: bool,
    pub author_name: String,
    pub author_email: String,
    pub state: String,
}
#[derive(Serialize, serde::Deserialize, specta::Type)]
pub struct Patch {
    pub text: String,
    pub truncated: bool,
}
#[derive(Deserialize, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitInput {
    pub path: String,
    pub files: Vec<String>,
    pub message: String,
    pub name: String,
    pub email: String,
    pub expected_head: String,
}
pub(crate) fn failure(e: git2::Error) -> String {
    format!("Git: {}", e.message())
}
pub(crate) fn open(path: &str) -> Result<Repository, String> {
    let repo = Repository::open(path).map_err(failure)?;
    if repo.is_bare() {
        return Err("请选择包含工作文件的 Git 仓库".into());
    }
    Ok(repo)
}
pub(crate) fn head_id(repo: &Repository) -> Result<String, String> {
    match repo.head() {
        Ok(head) => Ok(head.peel_to_commit().map_err(failure)?.id().to_string()),
        Err(e)
            if e.code() == git2::ErrorCode::UnbornBranch
                || e.code() == git2::ErrorCode::NotFound =>
        {
            Ok(String::new())
        }
        Err(e) => Err(failure(e)),
    }
}
pub(crate) fn status_options() -> StatusOptions {
    let mut options = StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true);
    options
}
pub(crate) fn inspect(repo: &Repository) -> Result<RepoInfo, String> {
    let head = head_id(repo)?;
    let statuses = repo
        .statuses(Some(&mut status_options()))
        .map_err(failure)?;
    let changes = statuses
        .iter()
        .take(500)
        .filter_map(|entry| {
            let flags = entry.status();
            let path = entry.path().ok()?.to_string();
            let kind = if flags.contains(Status::CONFLICTED) {
                "conflicted"
            } else if flags.intersects(Status::WT_DELETED | Status::INDEX_DELETED) {
                "deleted"
            } else if flags.intersects(Status::WT_NEW | Status::INDEX_NEW) {
                "added"
            } else if flags.intersects(Status::WT_RENAMED | Status::INDEX_RENAMED) {
                "renamed"
            } else {
                "modified"
            };
            Some(Change {
                path,
                kind: kind.into(),
                staged: flags.intersects(
                    Status::INDEX_NEW
                        | Status::INDEX_MODIFIED
                        | Status::INDEX_DELETED
                        | Status::INDEX_RENAMED
                        | Status::INDEX_TYPECHANGE,
                ),
            })
        })
        .collect();
    let mut history = Vec::new();
    if !head.is_empty() {
        let mut walk = repo.revwalk().map_err(failure)?;
        walk.push_head().map_err(failure)?;
        walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
            .map_err(failure)?;
        for id in walk.take(30) {
            let commit = repo.find_commit(id.map_err(failure)?).map_err(failure)?;
            history.push(Commit {
                id: commit.id().to_string(),
                summary: commit.summary().ok().flatten().unwrap_or("").into(),
                author: commit.author().name().unwrap_or("").into(),
                time: commit.time().seconds(),
            });
        }
    }
    let signature = repo.signature().ok();
    let branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().ok().map(str::to_string))
        .unwrap_or_else(|| {
            repo.find_reference("HEAD")
                .ok()
                .and_then(|r| {
                    r.symbolic_target()
                        .ok()
                        .flatten()
                        .map(|v| v.trim_start_matches("refs/heads/").into())
                })
                .unwrap_or_else(|| "HEAD".into())
        });
    Ok(RepoInfo {
        path: repo
            .workdir()
            .ok_or("请选择包含工作文件的 Git 仓库")?
            .to_string_lossy()
            .into(),
        branch,
        head,
        changes,
        history,
        truncated: statuses.len() > 500,
        author_name: signature
            .as_ref()
            .and_then(|s| s.name().ok())
            .unwrap_or("")
            .into(),
        author_email: signature
            .as_ref()
            .and_then(|s| s.email().ok())
            .unwrap_or("")
            .into(),
        state: format!("{:?}", repo.state()),
    })
}
pub(crate) fn safe_relative(file: &str) -> Result<(), String> {
    if file.is_empty()
        || Path::new(file)
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
        || file
            .split(['/', '\\'])
            .any(|c| c.eq_ignore_ascii_case(".git"))
    {
        return Err("无效的仓库文件路径".into());
    }
    Ok(())
}
pub(crate) fn file_diff(repo: &Repository, file: &str) -> Result<Patch, String> {
    safe_relative(file)?;
    let head = head_id(repo)?;
    let tree = if head.is_empty() {
        None
    } else {
        Some(
            repo.head()
                .map_err(failure)?
                .peel_to_tree()
                .map_err(failure)?,
        )
    };
    let mut options = DiffOptions::new();
    options
        .pathspec(file)
        .disable_pathspec_match(true)
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .show_untracked_content(true)
        .max_size(1024 * 1024);
    let diff = repo
        .diff_tree_to_workdir_with_index(tree.as_ref(), Some(&mut options))
        .map_err(failure)?;
    let mut text = String::new();
    let mut truncated = false;
    let result = diff.print(DiffFormat::Patch, |_, _, line| {
        if text.len() + line.content().len() > 256_000 {
            truncated = true;
            return false;
        }
        if ['+', '-', ' '].contains(&line.origin()) {
            text.push(line.origin());
        }
        text.push_str(&String::from_utf8_lossy(line.content()));
        true
    });
    if !truncated {
        result.map_err(failure)?;
    }
    Ok(Patch { text, truncated })
}
pub(crate) fn commit_selected(
    repo: &Repository,
    files: &[String],
    message: &str,
    name: &str,
    email: &str,
    expected_head: &str,
) -> Result<String, String> {
    if repo.state() != RepositoryState::Clean {
        return Err("仓库正在合并或变基，请先在 Git 工具中完成操作".into());
    }
    if files.is_empty() || files.len() > 500 || message.trim().is_empty() || message.len() > 4000 {
        return Err("请选择文件并填写提交说明".into());
    }
    if name.trim().is_empty() || email.trim().is_empty() {
        return Err("请填写提交署名与邮箱".into());
    }
    if head_id(repo)? != expected_head {
        return Err("仓库版本已变化，请刷新后重新审阅".into());
    }
    for path in files {
        safe_relative(path)?;
    }
    let selected: HashSet<&str> = files.iter().map(String::as_str).collect();
    let statuses = repo
        .statuses(Some(&mut status_options()))
        .map_err(failure)?;
    for entry in statuses.iter() {
        let s = entry.status();
        if s.contains(Status::CONFLICTED) {
            return Err("仓库有冲突，请先解决冲突".into());
        }
        if s.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) && !entry.path().is_ok_and(|p| selected.contains(p))
        {
            return Err("暂存区包含未选择的文件，请先处理这些暂存更改".into());
        }
        // Rename pairs require both paths; delegate this operation to a full Git client.
        if s.intersects(Status::INDEX_RENAMED | Status::WT_RENAMED)
            && entry.path().is_ok_and(|p| selected.contains(p))
        {
            return Err("重命名提交请先在 Git 工具中处理".into());
        }
    }
    let signature = Signature::now(name.trim(), email.trim()).map_err(failure)?;
    let mut index = repo.index().map_err(failure)?;
    for file in files {
        if !statuses
            .iter()
            .any(|e| e.path().ok() == Some(file.as_str()))
        {
            return Err("文件状态已变化，请刷新后重试".into());
        }
        match std::fs::symlink_metadata(
            repo.workdir()
                .ok_or("请选择包含工作文件的 Git 仓库")?
                .join(file),
        ) {
            Ok(_) => index.add_path(Path::new(file)).map_err(failure)?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                if let Err(e) = index.remove_path(Path::new(file)) {
                    if e.code() != git2::ErrorCode::NotFound {
                        return Err(failure(e));
                    }
                }
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    let tree_id = index.write_tree().map_err(failure)?;
    let tree = repo.find_tree(tree_id).map_err(failure)?;
    let parent = if expected_head.is_empty() {
        None
    } else {
        Some(
            repo.find_commit(git2::Oid::from_str(expected_head).map_err(failure)?)
                .map_err(failure)?,
        )
    };
    if parent.as_ref().is_some_and(|p| p.tree_id() == tree_id) {
        return Err("没有可提交的内容变化".into());
    }
    if head_id(repo)? != expected_head {
        return Err("仓库版本已变化，请刷新后重新审阅".into());
    }
    index.write().map_err(failure)?;
    let parents: Vec<_> = parent.iter().collect();
    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message.trim(),
        &tree,
        &parents,
    )
    .map(|id| id.to_string())
    .map_err(failure)
}

#[cfg(test)]
mod tests;
