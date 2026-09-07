use crate::{
    error::{AppError, AppResult},
    services::capture::{
        self, assets,
        desktop::{self, CaptureSeed, DesktopCapture},
        screens::{self, Screen},
    },
};
use tauri::{Emitter, Manager};

#[tauri::command]
#[specta::specta]
pub async fn capture_environment(
    app: tauri::AppHandle,
    language: String,
) -> AppResult<capture::environment::CaptureEnvironment> {
    capture::environment::inspect(&app, &language)
}

#[tauri::command]
#[specta::specta]
pub async fn capture_request_access() -> AppResult<bool> {
    Ok(capture::environment::request_access())
}

#[tauri::command]
#[specta::specta]
pub async fn capture_open(
    app: tauri::AppHandle,
    mode: String,
    monitor: Option<u32>,
) -> AppResult<()> {
    desktop::open(app, mode, monitor).await
}

#[tauri::command]
#[specta::specta]
pub async fn capture_take(app: tauri::AppHandle) -> AppResult<Option<CaptureSeed>> {
    Ok(app
        .state::<DesktopCapture>()
        .inbox
        .lock()
        .map_err(|_| AppError::Internal("捕捉状态不可用".into()))?
        .pop_front())
}

#[tauri::command]
#[specta::specta]
pub async fn capture_clipboard(app: tauri::AppHandle) -> AppResult<CaptureSeed> {
    tauri::async_runtime::spawn_blocking(move || desktop::clipboard(&app)).await?
}

#[tauri::command]
#[specta::specta]
pub async fn capture_screens() -> AppResult<Vec<Screen>> {
    tauri::async_runtime::spawn_blocking(screens::list).await?
}

#[tauri::command]
#[specta::specta]
pub async fn capture_release(app: tauri::AppHandle, id: String) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || screens::release(&app, &id)).await?
}

#[tauri::command]
#[specta::specta]
pub async fn capture_shortcut_errors(app: tauri::AppHandle) -> AppResult<Vec<String>> {
    Ok(app
        .state::<DesktopCapture>()
        .shortcuts
        .lock()
        .map_err(|_| AppError::Internal("快捷键状态不可用".into()))?
        .clone())
}

#[tauri::command]
#[specta::specta]
pub async fn capture_window(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    action: String,
) -> AppResult<()> {
    if !matches!(window.label(), "capture" | "pin") {
        return Err(AppError::Validation("此操作仅适用于捕捉浮窗".into()));
    }
    match action.as_str() {
        "hide" => {
            window.hide()?;
            if window.label() == "capture"
                && app
                    .state::<DesktopCapture>()
                    .main_hidden
                    .load(std::sync::atomic::Ordering::SeqCst)
            {
                desktop::show_main(&app)?;
            }
        }
        "main" => {
            window.hide()?;
            desktop::show_main(&app)?;
        }
        "note" => {
            desktop::resize(&window, 460.0, 600.0)?;
        }
        "review" => {
            desktop::resize(&window, 900.0, 700.0)?;
        }
        "drag" => window.start_dragging()?,
        "toggle-pin" => window.set_always_on_top(!window.is_always_on_top()?)?,
        _ => return Err(AppError::Validation("无效的浮窗操作".into())),
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn capture_insert(app: tauri::AppHandle, id: String) -> AppResult<()> {
    let root = capture::root(&app)?;
    let asset = tauri::async_runtime::spawn_blocking(move || assets::get(&root, &id)).await??;
    *app.state::<DesktopCapture>()
        .insertion
        .lock()
        .map_err(|_| AppError::Internal("素材插入状态不可用".into()))? = Some(asset.id);
    desktop::show_main(&app)?;
    if let Some(window) = app.get_webview_window("capture") {
        window.hide()?;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("capture-insert", ());
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn capture_pending_insert(app: tauri::AppHandle) -> AppResult<Option<String>> {
    Ok(app
        .state::<DesktopCapture>()
        .insertion
        .lock()
        .map_err(|_| AppError::Internal("素材插入状态不可用".into()))?
        .take())
}

#[tauri::command]
#[specta::specta]
pub async fn capture_pin(app: tauri::AppHandle, id: String) -> AppResult<()> {
    desktop::pin(&app, &id)
}

#[tauri::command]
#[specta::specta]
pub async fn capture_pinned(app: tauri::AppHandle) -> AppResult<Option<String>> {
    Ok(app
        .state::<DesktopCapture>()
        .pinned
        .lock()
        .map_err(|_| AppError::Internal("参考图窗口不可用".into()))?
        .clone())
}
