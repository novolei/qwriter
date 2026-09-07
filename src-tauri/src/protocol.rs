use crate::commands::{
    agent, capture, cards, credentials, git, library, media, provider, streaming,
};
use tauri_specta::{collect_commands, Builder, ErrorHandlingMode};

use crate::registry::registered_commands;

pub(crate) fn builder() -> Builder<tauri::Wry> {
    Builder::new()
        .commands(registered_commands!(collect_commands))
        .error_handling(ErrorHandlingMode::Throw)
}

pub(crate) fn invoke_handler(
) -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    registered_commands!(tauri::generate_handler)
}

/// Generated from the runtime command registry; no filesystem writes during app startup.
pub fn export_bindings(path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    builder()
        .disable_serde_phases()
        .dangerously_cast_bigints_to_number()
        .export(specta_typescript::Typescript::default(), path)?;
    Ok(())
}
