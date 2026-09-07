use super::{assets, screens::ScreenCapture};
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_clipboard_manager::ClipboardExt;

#[derive(Clone, Default, Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSeed {
    pub id: String,
    pub mode: String,
    pub text: String,
    pub asset_ids: Vec<String>,
    pub screenshot: Option<ScreenCapture>,
}

#[derive(Default)]
pub struct DesktopCapture {
    pub inbox: Mutex<VecDeque<CaptureSeed>>,
    pub shortcuts: Mutex<Vec<String>>,
    pub busy: Arc<Mutex<bool>>,
    pub insertion: Mutex<Option<String>>,
    pub pinned: Mutex<Option<String>>,
    pub temporary: Mutex<Option<String>>,
    pub main_hidden: std::sync::atomic::AtomicBool,
}

pub fn clipboard(app: &tauri::AppHandle) -> AppResult<CaptureSeed> {
    let mut result = CaptureSeed {
        id: uuid::Uuid::new_v4().to_string(),
        mode: "note".into(),
        ..Default::default()
    };
    if let Ok(text) = app.clipboard().read_text() {
        if text.len() > 256 * 1024 {
            return Err(AppError::Validation("剪贴板文字应小于 256 KB".into()));
        }
        result.text = text;
    }
    if let Ok(image) = app.clipboard().read_image() {
        if u64::from(image.width()) * u64::from(image.height()) > 40_000_000 {
            return Err(AppError::Validation("图片像素总量不能超过 4000 万".into()));
        }
        let rgba = image::RgbaImage::from_raw(image.width(), image.height(), image.rgba().to_vec())
            .ok_or_else(|| AppError::Validation("剪贴板图片无效".into()))?;
        result
            .asset_ids
            .push(assets::png(&super::root(app)?, rgba, "Clipboard.png")?.id);
    }
    if result.text.is_empty() && result.asset_ids.is_empty() {
        return Err(AppError::Validation("剪贴板中没有可用的文字或图片".into()));
    }
    Ok(result)
}

pub fn capture_window(app: &tauri::AppHandle) -> AppResult<WebviewWindow> {
    if let Some(window) = app.get_webview_window("capture") {
        return Ok(window);
    }
    Ok(WebviewWindowBuilder::new(
        app,
        "capture",
        WebviewUrl::App("index.html?surface=capture".into()),
    )
    .title("Qwriter · Capture")
    .inner_size(460.0, 600.0)
    .min_inner_size(360.0, 380.0)
    .decorations(false)
    .skip_taskbar(true)
    .visible(false)
    .center()
    .build()?)
}

pub fn resize(window: &WebviewWindow, width: f64, height: f64) -> AppResult<()> {
    window.set_resizable(true)?;
    let (width, height) = if let Some(monitor) = window.current_monitor()? {
        let factor = monitor.scale_factor();
        (
            width.min((f64::from(monitor.size().width) / factor - 32.0).max(240.0)),
            height.min((f64::from(monitor.size().height) / factor - 80.0).max(260.0)),
        )
    } else {
        (width, height)
    };
    window.set_min_size(Some(tauri::LogicalSize::new(
        width.min(360.0),
        height.min(380.0),
    )))?;
    window.set_size(tauri::LogicalSize::new(width, height))?;
    window.center()?;
    Ok(())
}

pub fn show(app: &tauri::AppHandle, seed: CaptureSeed) -> AppResult<()> {
    let state = app.state::<DesktopCapture>();
    let window = capture_window(app)?;
    let screenshot = seed.screenshot.clone();
    {
        let mut queue = state
            .inbox
            .lock()
            .map_err(|_| AppError::Internal("灵感匣暂时繁忙，请重试".into()))?;
        if queue.len() >= 12 {
            return Err(AppError::Validation("请先处理已捕捉的灵感".into()));
        }
        queue.push_back(seed);
    }
    if let Some(capture) = screenshot {
        *state
            .temporary
            .lock()
            .map_err(|_| AppError::Internal("捕捉任务状态不可用".into()))? =
            Some(capture.id.clone());
        window.set_min_size(Some(tauri::LogicalSize::new(100.0, 100.0)))?;
        window.set_resizable(false)?;
        window.set_always_on_top(true)?;
        // xcap returns macOS display bounds in points, Windows bounds in pixels.
        #[cfg(target_os = "macos")]
        {
            window.set_position(tauri::LogicalPosition::new(
                capture.screen.x,
                capture.screen.y,
            ))?;
            window.set_size(tauri::LogicalSize::new(
                capture.screen.width,
                capture.screen.height,
            ))?;
        }
        #[cfg(not(target_os = "macos"))]
        {
            window.set_position(tauri::PhysicalPosition::new(
                capture.screen.x,
                capture.screen.y,
            ))?;
            window.set_size(tauri::PhysicalSize::new(
                capture.screen.width,
                capture.screen.height,
            ))?;
        }
    } else {
        window.set_always_on_top(true)?;
        resize(&window, 460.0, 600.0)?;
    }
    window.show()?;
    window.unminimize()?;
    window.set_focus()?;
    let _ = window.emit("capture-seed", ());
    Ok(())
}

pub fn initialize(app: &tauri::AppHandle) -> AppResult<()> {
    let _ = super::screens::cleanup(app);
    super::global::initialize(app)?;
    // Prepare the hidden WebView after startup, never on the shortcut's critical path.
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(600)).await;
        let task = handle.clone();
        let _ = handle.run_on_main_thread(move || {
            let _ = capture_window(&task);
        });
    });
    Ok(())
}

pub async fn open(app: tauri::AppHandle, mode: String, monitor: Option<u32>) -> AppResult<()> {
    if !matches!(mode.as_str(), "note" | "clipboard" | "screenshot") {
        return Err(AppError::Validation("无效的捕捉方式".into()));
    }
    if let Some(window) = app.get_webview_window("capture") {
        if window.is_visible()? {
            window.set_focus()?;
            let _ = window.emit("capture-busy", ());
            return Ok(());
        }
    }
    let busy = app.state::<DesktopCapture>().busy.clone();
    {
        let mut locked = busy
            .lock()
            .map_err(|_| AppError::Internal("捕捉任务状态不可用".into()))?;
        if *locked {
            return Err(AppError::Validation("正在准备捕捉，请稍候".into()));
        }
        *locked = true;
    }
    struct Guard(Arc<Mutex<bool>>);
    impl Drop for Guard {
        fn drop(&mut self) {
            if let Ok(mut value) = self.0.lock() {
                *value = false;
            }
        }
    }
    let _guard = Guard(busy);
    if mode == "screenshot" {
        super::environment::ensure_access()?;
        let mut hidden = false;
        if let Some(window) = app.get_webview_window("capture") {
            if window.is_visible()? {
                window.hide()?;
                hidden = true;
            }
        }
        if let Some(window) = app.get_webview_window("main") {
            if window.is_focused()? {
                window.hide()?;
                hidden = true;
                app.state::<DesktopCapture>()
                    .main_hidden
                    .store(true, std::sync::atomic::Ordering::SeqCst);
            }
        }
        // Only wait for the compositor if we actually removed a visible Qwriter window.
        if hidden {
            // A shorter delay can capture Windows' hide animation as a ghost image.
            tokio::time::sleep(std::time::Duration::from_millis(180)).await;
        }
    }
    let handle = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        if mode == "clipboard" {
            clipboard(&handle)
        } else {
            Ok(CaptureSeed {
                id: uuid::Uuid::new_v4().to_string(),
                mode: mode.clone(),
                screenshot: if mode == "screenshot" {
                    Some(super::screens::capture(&handle, monitor)?)
                } else {
                    None
                },
                ..Default::default()
            })
        }
    })
    .await
    .map_err(AppError::from)
    .and_then(|result| result);
    let capture_id = result
        .as_ref()
        .ok()
        .and_then(|seed| seed.screenshot.as_ref())
        .map(|shot| shot.id.clone());
    let result = result.and_then(|seed| show(&app, seed));
    if result.is_err() {
        if let Some(window) = app.get_webview_window("capture") {
            let _ = window.hide();
        }
        closed(&app);
        if let Some(id) = capture_id {
            let handle = app.clone();
            let _ =
                tauri::async_runtime::spawn_blocking(move || super::screens::release(&handle, &id))
                    .await;
        }
    }
    result
}

pub fn show_main(app: &tauri::AppHandle) -> AppResult<()> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| AppError::Internal("文稿窗口不可用".into()))?;
    window.show()?;
    window.unminimize()?;
    window.set_focus()?;
    app.state::<DesktopCapture>()
        .main_hidden
        .store(false, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

pub fn closed(app: &tauri::AppHandle) {
    let state = app.state::<DesktopCapture>();
    if let Ok(mut queue) = state.inbox.lock() {
        queue.clear();
    }
    if state
        .main_hidden
        .swap(false, std::sync::atomic::Ordering::SeqCst)
    {
        let _ = show_main(app);
    }
    let temporary = state
        .temporary
        .lock()
        .ok()
        .and_then(|mut value| value.take());
    if let Some(id) = temporary {
        let app = app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _ = super::screens::release(&app, &id);
        });
    }
}

pub fn pin(app: &tauri::AppHandle, asset: &str) -> AppResult<()> {
    assets::get(&super::root(app)?, asset)?;
    *app.state::<DesktopCapture>()
        .pinned
        .lock()
        .map_err(|_| AppError::Internal("参考图窗口不可用".into()))? = Some(asset.into());
    let window = match app.get_webview_window("pin") {
        Some(window) => window,
        None => {
            WebviewWindowBuilder::new(app, "pin", WebviewUrl::App("index.html?surface=pin".into()))
                .title("Qwriter · Reference")
                .inner_size(520.0, 420.0)
                .min_inner_size(240.0, 180.0)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .build()?
        }
    };
    window.show()?;
    window.set_focus()?;
    let _ = window.emit("pin-changed", ());
    Ok(())
}
