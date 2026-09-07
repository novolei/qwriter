use crate::{
    error::{AppError, AppResult},
    services::git::{self, CommitInput, GitLock, Patch, RepoInfo},
};
use git2::Repository;

#[tauri::command]
#[specta::specta]
pub async fn git_inspect(path: String) -> AppResult<RepoInfo> {
    tauri::async_runtime::spawn_blocking(move || git::inspect(&git::open(&path)?))
        .await?
        .map_err(AppError::Git)
}
#[tauri::command]
#[specta::specta]
pub async fn git_file_diff(path: String, file: String) -> AppResult<Patch> {
    tauri::async_runtime::spawn_blocking(move || git::file_diff(&git::open(&path)?, &file))
        .await?
        .map_err(AppError::Git)
}
#[tauri::command]
#[specta::specta]
pub async fn git_init(path: String, lock: tauri::State<'_, GitLock>) -> AppResult<RepoInfo> {
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock
            .lock()
            .map_err(|_| AppError::Internal("Git 工作区正在使用".into()))?;
        if Repository::discover(&path).is_ok() {
            return Err(AppError::Validation(
                "此目录已属于 Git 仓库，请直接打开仓库".into(),
            ));
        }
        let repo = Repository::init(path)?;
        git::inspect(&repo).map_err(AppError::Git)
    })
    .await?
}
#[tauri::command]
#[specta::specta]
pub async fn git_commit(input: CommitInput, lock: tauri::State<'_, GitLock>) -> AppResult<String> {
    let lock = lock.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock
            .lock()
            .map_err(|_| AppError::Internal("Git 工作区正在使用".into()))?;
        git::commit_selected(
            &git::open(&input.path).map_err(AppError::Git)?,
            &input.files,
            &input.message,
            &input.name,
            &input.email,
            &input.expected_head,
        )
        .map_err(AppError::Git)
    })
    .await?
}
