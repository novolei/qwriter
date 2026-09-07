use crate::services::knowledge::sessions::{self, AgentSession};
use crate::{
    error::{AppError, AppResult},
    services::knowledge::{self, KnowledgeLock, MemoryEntry},
};
use tauri::Manager;

#[tauri::command]
#[specta::specta]
pub async fn knowledge_search(
    app: tauri::AppHandle,
    query: String,
    document_id: String,
) -> AppResult<Vec<knowledge::chunks::KnowledgeChunk>> {
    let root = app.path().app_data_dir()?;
    tauri::async_runtime::spawn_blocking(move || {
        knowledge::index::search(&root, &query, &document_id)
    })
    .await?
}
#[tauri::command]
#[specta::specta]
pub async fn knowledge_source(
    app: tauri::AppHandle,
    memory_id: String,
    document_id: String,
) -> AppResult<Option<MemoryEntry>> {
    let root = app.path().app_data_dir()?;
    tauri::async_runtime::spawn_blocking(move || {
        knowledge::index::source(&root, &memory_id, &document_id)
    })
    .await?
}

#[tauri::command]
#[specta::specta]
pub async fn agent_session_save(app: tauri::AppHandle, session: AgentSession) -> AppResult<()> {
    let root = app.path().app_data_dir()?;
    tauri::async_runtime::spawn_blocking(move || sessions::save(&root, session)).await?
}
#[tauri::command]
#[specta::specta]
pub async fn agent_sessions(app: tauri::AppHandle) -> AppResult<Vec<AgentSession>> {
    let root = app.path().app_data_dir()?;
    tauri::async_runtime::spawn_blocking(move || sessions::list(&root)).await?
}

#[tauri::command]
#[specta::specta]
pub async fn memory_search(
    app: tauri::AppHandle,
    query: String,
    document_id: String,
) -> AppResult<Vec<MemoryEntry>> {
    let root = app.path().app_data_dir()?;
    tauri::async_runtime::spawn_blocking(move || knowledge::search(&root, &query, &document_id))
        .await?
}

#[tauri::command]
#[specta::specta]
pub async fn memory_list(
    app: tauri::AppHandle,
    gate: tauri::State<'_, KnowledgeLock>,
) -> AppResult<Vec<MemoryEntry>> {
    let root = app.path().app_data_dir()?;
    let gate = gate.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = gate
            .lock()
            .map_err(|_| AppError::Internal("记忆库暂时繁忙".into()))?;
        knowledge::list(&root)
    })
    .await?
}
#[tauri::command]
#[specta::specta]
pub async fn memory_save(
    app: tauri::AppHandle,
    gate: tauri::State<'_, KnowledgeLock>,
    entry: MemoryEntry,
) -> AppResult<MemoryEntry> {
    let root = app.path().app_data_dir()?;
    let gate = gate.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = gate
            .lock()
            .map_err(|_| AppError::Internal("记忆库暂时繁忙".into()))?;
        knowledge::save(&root, entry)
    })
    .await?
}
