use super::desktop::DesktopCapture;
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CaptureEnvironment {
    pub platform: String,
    pub screen_access: bool,
    pub tray_available: bool,
    pub shortcut_errors: Vec<String>,
}

pub fn screen_access() -> bool {
    #[cfg(target_os = "macos")]
    {
        core_graphics::access::ScreenCaptureAccess.preflight()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

pub fn ensure_access() -> AppResult<()> {
    if !screen_access() {
        return Err(AppError::Validation("请在 macOS 系统设置的隐私与安全性中，为 Qwriter 开启屏幕录制权限，然后退出并重新打开应用。".into()));
    }
    Ok(())
}

pub fn request_access() -> bool {
    #[cfg(target_os = "macos")]
    {
        core_graphics::access::ScreenCaptureAccess.request()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

pub fn inspect(app: &tauri::AppHandle, language: &str) -> AppResult<CaptureEnvironment> {
    if !matches!(language, "zh-CN" | "en") {
        return Err(AppError::Validation("无效的界面语言".into()));
    }
    let tray_available = super::global::update_tray(app, language).is_ok();
    Ok(CaptureEnvironment {
        platform: std::env::consts::OS.into(),
        screen_access: screen_access(),
        tray_available,
        shortcut_errors: app
            .state::<DesktopCapture>()
            .shortcuts
            .lock()
            .map_err(|_| AppError::Internal("快捷键状态不可用".into()))?
            .clone(),
    })
}
