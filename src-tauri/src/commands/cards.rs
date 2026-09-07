use crate::{
    error::{AppError, AppResult},
    services::capture::{
        self,
        cards::{self, Card},
        CaptureLock,
    },
};
use tauri::Emitter;

#[tauri::command]
#[specta::specta]
pub async fn cards_list(
    app: tauri::AppHandle,
    gate: tauri::State<'_, CaptureLock>,
) -> AppResult<Vec<Card>> {
    let root = capture::root(&app)?;
    let gate = gate.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = gate
            .lock()
            .map_err(|_| AppError::Internal("灵感匣暂时繁忙，请重试".into()))?;
        cards::list(&root)
    })
    .await?
}

#[tauri::command]
#[specta::specta]
pub async fn card_save(
    app: tauri::AppHandle,
    gate: tauri::State<'_, CaptureLock>,
    card: Card,
) -> AppResult<Card> {
    let root = capture::root(&app)?;
    let gate = gate.0.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _lock = gate
            .lock()
            .map_err(|_| AppError::Internal("灵感匣暂时繁忙，请重试".into()))?;
        cards::save(&root, card)
    })
    .await??;
    let _ = app.emit("cards-changed", ());
    Ok(result)
}
