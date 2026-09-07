#[path = "src/registry.rs"]
mod registry;
macro_rules! command_names {
    ($($module:ident::$name:ident),* $(,)?) => { &[$(stringify!($name)),*] };
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Embed one manifest through the linker for every native target, including
    // tests/exporter. Disable Tauri's duplicate binary-only manifest resource.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest())
            .app_manifest(
                tauri_build::AppManifest::new()
                    .commands(registry::registered_commands!(command_names)),
            ),
    )?;
    println!("cargo:rerun-if-changed=src/registry.rs");
    if std::env::var("CARGO_CFG_TARGET_OS")? == "windows" {
        let manifest =
            std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR")?).join("windows.manifest");
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
        println!("cargo:rerun-if-changed=windows.manifest");
    }
    Ok(())
}
