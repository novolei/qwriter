use crate::{
    error::{AppError, AppResult},
    services::{
        provider::ModelConfig,
        streaming::{self, Requests, StreamEvent},
    },
};
use tauri::ipc::Channel;

#[tauri::command]
#[specta::specta]
pub async fn ai_stream(
    state: tauri::State<'_, Requests>,
    request_id: String,
    config: ModelConfig,
    instruction: String,
    context: String,
    on_event: Channel<StreamEvent>,
) -> AppResult<String> {
    streaming::ai_stream(state, request_id, config, instruction, context, on_event)
        .await
        .map_err(AppError::Network)
}
#[tauri::command]
#[specta::specta]
pub async fn ai_cancel(state: tauri::State<'_, Requests>, request_id: String) -> AppResult<()> {
    streaming::ai_cancel(state, request_id).map_err(AppError::Internal)
}
