use super::assets::{self, valid_id, Asset};
use crate::error::{AppError, AppResult};
use std::path::{Path, PathBuf};

fn with_extension(name: &str, extension: &str) -> String {
    let name = name.trim().trim_end_matches(['.', ' ']);
    let name = if name.is_empty() { "Qwriter" } else { name };
    let suffix = format!(".{extension}");
    if name.to_lowercase().ends_with(&suffix)
        || (extension == "jpg" && name.to_lowercase().ends_with(".jpeg"))
    {
        return name.to_owned();
    }
    let stem = name.rsplit_once('.').map_or(name, |(stem, ext)| {
        if matches!(
            ext.to_lowercase().as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "mp4" | "mov" | "webm"
        ) {
            stem
        } else {
            name
        }
    });
    format!("{stem}{suffix}")
}

/// Correct only the selected filename; never change its parent directory.
pub fn destination(selected: &Path, extension: &str) -> AppResult<PathBuf> {
    let name = selected
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::Validation("无法写入选择的位置".into()))?;
    Ok(selected.with_file_name(with_extension(name, extension)))
}

pub fn suggested_name(asset: &Asset) -> AppResult<(String, String)> {
    if !valid_id(&asset.id) {
        return Err(AppError::Validation("无效的素材标识".into()));
    }
    let (_, extension) = asset
        .id
        .rsplit_once('.')
        .ok_or_else(|| AppError::Validation("无效的素材标识".into()))?;
    let name = asset
        .name
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or_default()
        .trim();
    let name = with_extension(name, extension);
    Ok((name, extension.to_owned()))
}

/// False means the corrected filename needs a native overwrite confirmation.
fn copy_new(source: &Path, target: &Path) -> AppResult<bool> {
    let mut input = std::fs::File::open(source)?;
    let mut output = match std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(target)
    {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => return Ok(false),
        Err(error) => return Err(error.into()),
    };
    let result =
        std::io::copy(&mut input, &mut output).and_then(|_| std::io::Write::flush(&mut output));
    drop(output);
    if result.is_err() {
        let _ = std::fs::remove_file(target);
    }
    result?;
    Ok(true)
}

// Native dialogs retain overwrite confirmation when a filename is corrected.
pub fn save(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    root: &Path,
    id: &str,
) -> AppResult<bool> {
    use tauri_plugin_dialog::DialogExt;
    let asset = assets::get(root, id)?;
    let (name, extension) = suggested_name(&asset)?;
    let mut suggested = std::path::PathBuf::from(name);
    loop {
        let mut dialog = app
            .dialog()
            .file()
            .set_parent(window)
            .set_file_name(suggested.file_name().unwrap_or_default().to_string_lossy())
            .add_filter(extension.to_uppercase(), &[extension.as_str()]);
        if let Some(parent) = suggested.parent().filter(|p| !p.as_os_str().is_empty()) {
            dialog = dialog.set_directory(parent);
        }
        let Some(file) = dialog.blocking_save_file() else {
            return Ok(false);
        };
        let selected = file
            .into_path()
            .map_err(|_| AppError::Validation("无法写入选择的位置".into()))?;
        let target = destination(&selected, &extension)?;
        if target != selected {
            // The dialog did not confirm overwriting this corrected path.
            // create_new also protects files created between selection and writing.
            if copy_new(&assets::path(root, id)?, &target)? {
                return Ok(true);
            }
            suggested = target;
            continue;
        }
        std::fs::copy(assets::path(root, id)?, target)?;
        return Ok(true);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn corrected_path_never_silently_overwrites_an_existing_file() {
        let root = tempfile::tempdir().unwrap();
        let source = root.path().join("source.png");
        let target = root.path().join("capture.png");
        std::fs::write(&source, b"new picture").unwrap();
        std::fs::write(&target, b"existing picture").unwrap();
        assert!(!copy_new(&source, &target).unwrap());
        assert_eq!(std::fs::read(&target).unwrap(), b"existing picture");
        let fresh = destination(&root.path().join("new capture"), "png").unwrap();
        assert!(copy_new(&source, &fresh).unwrap());
        assert_eq!(std::fs::read(fresh).unwrap(), b"new picture");
    }

    #[test]
    fn exports_with_actual_format_and_without_directory_components() {
        let mut asset = Asset {
            id: format!("{}.png", "a".repeat(64)),
            name: "Qwriter-2026-09-07".into(),
            mime: "image/png".into(),
            size: 12,
            width: Some(1),
            height: Some(1),
        };
        assert_eq!(suggested_name(&asset).unwrap().0, "Qwriter-2026-09-07.png");
        asset.name = "C:\\images\\Capture.PNG".into();
        assert_eq!(suggested_name(&asset).unwrap().0, "Capture.PNG");
        asset.name = "photo.jpg".into();
        assert_eq!(suggested_name(&asset).unwrap().0, "photo.png");
        asset.id = "invalid".into();
        assert!(suggested_name(&asset).is_err());
    }

    #[test]
    fn selected_names_keep_the_real_format_and_directory() {
        for (name, expected) in [
            ("Screenshot", "Screenshot.png"),
            ("截图.", "截图.png"),
            ("截图.PNG", "截图.PNG"),
            ("截图.jpeg", "截图.png"),
            ("notes.v2", "notes.v2.png"),
        ] {
            let parent = Path::new("exports");
            assert_eq!(
                destination(&parent.join(name), "png").unwrap(),
                parent.join(expected)
            );
        }
        assert_eq!(
            destination(Path::new("photo.jpeg"), "jpg").unwrap(),
            Path::new("photo.jpeg")
        );
    }
}
