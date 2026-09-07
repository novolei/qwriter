#![cfg_attr(
    not(test),
    deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)
)]
mod commands;
pub mod error;
mod protocol;
mod registry;
mod services;
use tauri::Manager;

pub use protocol::export_bindings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .setup(|app| {
            app.manage(services::library::LibraryLock::default());
            app.manage(services::streaming::Requests::default());
            app.manage(services::agent::AgentRequests::default());
            app.manage(services::credentials::CredentialLock::default());
            app.manage(services::git::GitLock::default());
            app.manage(services::capture::CaptureLock::default());
            app.manage(services::capture::desktop::DesktopCapture::default());
            #[cfg(any(target_os = "windows", target_os = "macos"))]
            app.handle()
                .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
            services::capture::desktop::initialize(app.handle())?;
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if window.label() == "capture" && matches!(event, tauri::WindowEvent::Destroyed) {
                services::capture::desktop::closed(window.app_handle());
            }
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                // The frontend destroys main only after the document flush succeeds.
                window.app_handle().exit(0);
            }
        })
        .invoke_handler(protocol::invoke_handler())
        .run(tauri::generate_context!());
    if let Err(error) = result {
        eprintln!("Qwriter could not start: {error}");
    }
}
