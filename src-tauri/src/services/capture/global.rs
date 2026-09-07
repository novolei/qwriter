use super::desktop::{self, CaptureSeed, DesktopCapture};
use crate::error::{AppError, AppResult};
use tauri::Manager;

pub fn dispatch(app: &tauri::AppHandle, mode: &str) {
    let app = app.clone();
    let mode = mode.to_owned();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = desktop::open(app.clone(), mode, None).await {
            let _ = desktop::show(
                &app,
                CaptureSeed {
                    id: uuid::Uuid::new_v4().to_string(),
                    mode: "error".into(),
                    text: error.to_string(),
                    ..Default::default()
                },
            );
        }
    });
}

pub fn initialize(app: &tauri::AppHandle) -> AppResult<()> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
        for (shortcut, mode) in [
            ("CommandOrControl+Alt+N", "note"),
            ("CommandOrControl+Shift+Space", "clipboard"),
            ("CommandOrControl+Alt+S", "screenshot"),
        ] {
            if app
                .global_shortcut()
                .on_shortcut(shortcut, move |app, _, event| {
                    if event.state == ShortcutState::Pressed {
                        dispatch(app, mode);
                    }
                })
                .is_err()
            {
                app.state::<DesktopCapture>()
                    .shortcuts
                    .lock()
                    .map_err(|_| AppError::Internal("快捷键状态不可用".into()))?
                    .push(shortcut.into());
            }
        }
        // A missing tray must not prevent writing or the global shortcuts from working.
        let _ = update_tray(app, "zh-CN");
    }
    Ok(())
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
pub fn update_tray(app: &tauri::AppHandle, language: &str) -> AppResult<()> {
    use tauri::{
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::TrayIconBuilder,
    };
    let labels = if language == "en" {
        [
            "Capture screen",
            "Capture clipboard",
            "Quick note",
            "Open Qwriter",
        ]
    } else {
        ["框选截图", "复制后捕捉", "随手速记", "打开 Qwriter"]
    };
    let screenshot = MenuItem::with_id(app, "capture.screenshot", labels[0], true, None::<&str>)?;
    let clipboard = MenuItem::with_id(app, "capture.clipboard", labels[1], true, None::<&str>)?;
    let note = MenuItem::with_id(app, "capture.note", labels[2], true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let main = MenuItem::with_id(app, "capture.main", labels[3], true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&screenshot, &clipboard, &note, &separator, &main])?;
    if let Some(tray) = app.tray_by_id("qwriter.capture") {
        tray.set_menu(Some(menu))?;
    } else {
        let icon = app
            .default_window_icon()
            .cloned()
            .ok_or_else(|| AppError::Internal("系统托盘暂不可用".into()))?;
        TrayIconBuilder::with_id("qwriter.capture")
            .icon(icon)
            .tooltip("Qwriter")
            .menu(&menu)
            .show_menu_on_left_click(true)
            .on_menu_event(|app, event| match event.id.as_ref() {
                "capture.screenshot" => dispatch(app, "screenshot"),
                "capture.clipboard" => dispatch(app, "clipboard"),
                "capture.note" => dispatch(app, "note"),
                "capture.main" => {
                    let _ = desktop::show_main(app);
                }
                _ => {}
            })
            .build(app)?;
    }
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn update_tray(_: &tauri::AppHandle, _: &str) -> AppResult<()> {
    Err(AppError::Validation("此平台暂不支持屏幕捕获".into()))
}
