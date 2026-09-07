use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Clone, Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Screen {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f32,
    pub primary: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ScreenCapture {
    pub id: String,
    pub path: String,
    pub screen: Screen,
    #[serde(default)]
    pub windows: Vec<super::windows::CaptureWindowBounds>,
}

fn capture_error(_: impl std::fmt::Display) -> AppError {
    AppError::Internal("屏幕捕获失败，请确认显示器已连接且桌面未锁定，再重试。".into())
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn describe(monitor: &xcap::Monitor) -> AppResult<Screen> {
    Ok(Screen {
        id: monitor.id().map_err(capture_error)?,
        name: monitor.friendly_name().unwrap_or_default(),
        x: monitor.x().map_err(capture_error)?,
        y: monitor.y().map_err(capture_error)?,
        width: monitor.width().map_err(capture_error)?,
        height: monitor.height().map_err(capture_error)?,
        scale: monitor.scale_factor().unwrap_or(1.0),
        primary: monitor.is_primary().map_err(capture_error)?,
    })
}

pub fn list() -> AppResult<Vec<Screen>> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        xcap::Monitor::all()
            .map_err(capture_error)?
            .iter()
            .map(describe)
            .collect()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err(AppError::Validation("此平台暂不支持屏幕捕获".into()))
    }
}

fn directory(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let dir = app.path().app_cache_dir()?.join("capture");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn capture(app: &tauri::AppHandle, monitor_id: Option<u32>) -> AppResult<ScreenCapture> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        super::environment::ensure_access()?;
        let monitors = xcap::Monitor::all().map_err(capture_error)?;
        let monitor = monitors
            .iter()
            .find(|m| {
                monitor_id.map_or_else(
                    || m.is_primary().unwrap_or(false),
                    |id| m.id().ok() == Some(id),
                )
            })
            .or(monitors.first())
            .ok_or_else(|| capture_error("No screen"))?;
        if monitor_id.is_some() && monitor.id().ok() != monitor_id {
            return Err(AppError::Validation(
                "所选显示器已断开，请刷新显示器列表。".into(),
            ));
        }
        let screen = describe(monitor)?;
        if u64::from(screen.width) * u64::from(screen.height) > 40_000_000 {
            return Err(AppError::Validation("屏幕像素总量不能超过 4000 万".into()));
        }
        let windows = super::windows::snapshot(&screen);
        let image = monitor.capture_image().map_err(capture_error)?;
        if u64::from(image.width()) * u64::from(image.height()) > 40_000_000 {
            return Err(AppError::Validation("屏幕像素总量不能超过 4000 万".into()));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let path = directory(app)?.join(format!("{id}.png"));
        let file = std::fs::File::create(&path)?;
        let mut writer = std::io::BufWriter::new(file);
        super::encoding::write_preview(&mut writer, &image)
            .map_err(|_| AppError::Storage("截图缓存无法写入，请检查可用磁盘空间。".into()))?;
        std::io::Write::flush(&mut writer)?;
        Ok(ScreenCapture {
            id,
            path: path.to_string_lossy().into_owned(),
            screen,
            windows,
        })
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (app, monitor_id);
        Err(AppError::Validation("此平台暂不支持屏幕捕获".into()))
    }
}

pub fn release(app: &tauri::AppHandle, id: &str) -> AppResult<()> {
    if uuid::Uuid::parse_str(id).is_err() {
        return Err(AppError::Validation("无效的截图标识".into()));
    }
    let file = directory(app)?.join(format!("{id}.png"));
    if file.exists() {
        std::fs::remove_file(file)?;
    }
    Ok(())
}

pub fn cleanup(app: &tauri::AppHandle) -> AppResult<()> {
    for item in std::fs::read_dir(directory(app)?)? {
        let entry = item?;
        let path = entry.path();
        if path.extension().is_some_and(|e| e == "png") && entry.file_type()?.is_file() {
            if let Some(id) = path.file_stem().and_then(|s| s.to_str()) {
                if uuid::Uuid::parse_str(id).is_ok() {
                    std::fs::remove_file(path)?;
                }
            }
        }
    }
    Ok(())
}
