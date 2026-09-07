use crate::{
    error::{AppError, AppResult},
    services::credentials::{self, CredentialLock},
};

#[tauri::command]
#[specta::specta]
pub async fn credential_read(
    id: String,
    origin: String,
    state: tauri::State<'_, CredentialLock>,
) -> AppResult<Option<String>> {
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock
            .lock()
            .map_err(|_| AppError::Internal("凭据存储繁忙，请重试".into()))?;
        credentials::read(&id, &origin)
    })
    .await?
}
#[tauri::command]
#[specta::specta]
pub async fn credential_write(
    id: String,
    origin: String,
    key: String,
    state: tauri::State<'_, CredentialLock>,
) -> AppResult<()> {
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock
            .lock()
            .map_err(|_| AppError::Internal("凭据存储繁忙，请重试".into()))?;
        credentials::write(&id, &origin, &key)
    })
    .await?
}
#[tauri::command]
#[specta::specta]
pub async fn credential_remove(
    id: String,
    origin: String,
    state: tauri::State<'_, CredentialLock>,
) -> AppResult<()> {
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock
            .lock()
            .map_err(|_| AppError::Internal("凭据存储繁忙，请重试".into()))?;
        credentials::remove(&id, &origin)
    })
    .await?
}
