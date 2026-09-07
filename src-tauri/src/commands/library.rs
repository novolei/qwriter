use crate::{
    error::{AppError, AppResult},
    services::library::{self, Document, Library, LibraryLock, Snapshot},
};

#[tauri::command]
#[specta::specta]
pub async fn library_load(
    app: tauri::AppHandle,
    gate: tauri::State<'_, LibraryLock>,
) -> AppResult<Library> {
    let gate = gate.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = gate
            .lock()
            .map_err(|_| AppError::Internal("文稿库锁不可用".into()))?;
        let file = library::path(&app).map_err(AppError::Storage)?;
        library::load(
            &library::connect(&file).map_err(AppError::Storage)?,
            file.display().to_string(),
        )
        .map_err(AppError::Storage)
    })
    .await?
}
#[tauri::command]
#[specta::specta]
pub async fn library_save(
    app: tauri::AppHandle,
    gate: tauri::State<'_, LibraryLock>,
    docs: Vec<Document>,
    expected_revision: i64,
) -> AppResult<i64> {
    let gate = gate.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = gate
            .lock()
            .map_err(|_| AppError::Internal("文稿库锁不可用".into()))?;
        let file = library::path(&app).map_err(AppError::Storage)?;
        library::save(
            &mut library::connect(&file).map_err(AppError::Storage)?,
            &docs,
            expected_revision,
        )
        .map_err(|message| {
            if message.starts_with("文稿库已被另一个窗口修改") {
                AppError::Conflict(message)
            } else {
                AppError::Storage(message)
            }
        })
    })
    .await?
}
#[tauri::command]
#[specta::specta]
pub async fn library_history(
    app: tauri::AppHandle,
    gate: tauri::State<'_, LibraryLock>,
    doc_id: String,
) -> AppResult<Vec<Snapshot>> {
    let gate = gate.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = gate
            .lock()
            .map_err(|_| AppError::Internal("文稿库锁不可用".into()))?;
        let file = library::path(&app).map_err(AppError::Storage)?;
        library::history(
            &library::connect(&file).map_err(AppError::Storage)?,
            &doc_id,
        )
    })
    .await?
}
