use crate::{
    error::{AppError, AppResult},
    services::capture::{
        self,
        assets::{self, Asset},
        links::{self, LinkPreview},
        CaptureLock,
    },
};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
#[specta::specta]
pub async fn media_pick(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    gate: tauri::State<'_, CaptureLock>,
    kind: String,
) -> AppResult<Option<Asset>> {
    let root = capture::root(&app)?;
    let gate = gate.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let dialog = app.dialog().file().set_parent(&window);
        let dialog = if kind == "video" {
            dialog.add_filter("Video", &["mp4", "mov", "webm"])
        } else {
            dialog.add_filter("Image", &["png", "jpg", "jpeg", "gif", "webp"])
        };
        let Some(file) = dialog.blocking_pick_file() else {
            return Ok(None);
        };
        let path = file
            .into_path()
            .map_err(|_| AppError::Validation("无法访问选择的素材".into()))?;
        let _lock = gate
            .lock()
            .map_err(|_| AppError::Internal("灵感匣暂时繁忙，请重试".into()))?;
        assets::import_file(
            &root,
            &path,
            &path
                .file_name()
                .map(|n| n.to_string_lossy())
                .unwrap_or_default(),
        )
        .map(Some)
    })
    .await?
}

#[tauri::command]
#[specta::specta]
pub async fn media_import(
    app: tauri::AppHandle,
    gate: tauri::State<'_, CaptureLock>,
    bytes: Vec<u8>,
    name: String,
) -> AppResult<Asset> {
    let root = capture::root(&app)?;
    let gate = gate.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = gate
            .lock()
            .map_err(|_| AppError::Internal("灵感匣暂时繁忙，请重试".into()))?;
        assets::import_bytes(&root, &bytes, &name)
    })
    .await?
}

#[tauri::command]
#[specta::specta]
pub async fn media_asset(app: tauri::AppHandle, id: String) -> AppResult<Asset> {
    let root = capture::root(&app)?;
    tauri::async_runtime::spawn_blocking(move || assets::get(&root, &id)).await?
}

#[tauri::command]
#[specta::specta]
pub async fn media_path(app: tauri::AppHandle, id: String) -> AppResult<String> {
    let root = capture::root(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        assets::path(&root, &id).map(|p| p.to_string_lossy().into_owned())
    })
    .await?
}

#[tauri::command]
#[specta::specta]
pub async fn media_export(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    id: String,
) -> AppResult<bool> {
    let root = capture::root(&app)?;
    tauri::async_runtime::spawn_blocking(move || capture::export::save(&app, &window, &root, &id))
        .await?
}

#[tauri::command]
#[specta::specta]
pub async fn link_preview(app: tauri::AppHandle, url: String) -> AppResult<LinkPreview> {
    links::preview(capture::root(&app)?, url).await
}

#[tauri::command]
#[specta::specta]
pub async fn open_external(app: tauri::AppHandle, url: String) -> AppResult<()> {
    use tauri_plugin_opener::OpenerExt;
    let url = links::url(&url)?;
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| AppError::Internal("无法打开外部链接".into()))
}
