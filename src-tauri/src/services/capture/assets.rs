use crate::error::{AppError, AppResult};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

const LIMIT: u64 = 512 * 1024 * 1024;
#[derive(Clone, Debug, Serialize, Deserialize, specta::Type)]
pub struct Asset {
    pub id: String,
    pub name: String,
    pub mime: String,
    pub size: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

pub fn valid_id(id: &str) -> bool {
    let Some((hash, ext)) = id.split_once('.') else {
        return false;
    };
    hash.len() == 64
        && hash.bytes().all(|c| c.is_ascii_hexdigit())
        && matches!(ext, "png" | "jpg" | "gif" | "webp" | "mp4" | "mov" | "webm")
}

pub fn path(root: &Path, id: &str) -> AppResult<PathBuf> {
    if !valid_id(id) {
        return Err(AppError::Validation("无效的素材标识".into()));
    }
    let file = root.join("assets").join(id);
    let metadata = fs::symlink_metadata(&file)?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(AppError::Validation("素材文件不可用".into()));
    }
    let directory = root.join("assets").canonicalize()?;
    let resolved = file.canonicalize()?;
    if resolved.parent() != Some(directory.as_path()) {
        return Err(AppError::Validation("素材路径不在应用目录内".into()));
    }
    Ok(resolved)
}

fn format(header: &[u8]) -> AppResult<(&'static str, &'static str)> {
    match infer::get(header).map(|kind| kind.mime_type()) {
        Some("image/png") => Ok(("image/png", "png")),
        Some("image/jpeg") => Ok(("image/jpeg", "jpg")),
        Some("image/gif") => Ok(("image/gif", "gif")),
        Some("image/webp") => Ok(("image/webp", "webp")),
        Some("video/mp4") => Ok(("video/mp4", "mp4")),
        Some("video/quicktime") => Ok(("video/quicktime", "mov")),
        Some("video/webm") => Ok(("video/webm", "webm")),
        _ => Err(AppError::Validation(
            "支持 PNG、JPEG、GIF、WebP 图片和 MP4、MOV、WebM 视频".into(),
        )),
    }
}

pub fn import_file(root: &Path, source: &Path, name: &str) -> AppResult<Asset> {
    let mut input = fs::File::open(source)?;
    let length = input.metadata()?.len();
    if length == 0 || length > LIMIT {
        return Err(AppError::Validation("素材应小于 512 MB 且不能为空".into()));
    }
    let mut header = [0u8; 8192];
    let count = input.read(&mut header)?;
    let (mime, ext) = format(&header[..count])?;
    let (width, height) = if mime.starts_with("image/") {
        let size = image::image_dimensions(source)
            .map_err(|_| AppError::Validation("图片无法解码".into()))?;
        if u64::from(size.0) * u64::from(size.1) > 40_000_000 {
            return Err(AppError::Validation("图片像素总量不能超过 4000 万".into()));
        }
        (Some(size.0), Some(size.1))
    } else {
        (None, None)
    };
    let directory = root.join("assets");
    fs::create_dir_all(&directory)?;
    let temporary = directory.join(format!("{}.part", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut output = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        let mut hasher = Sha256::new();
        hasher.update(&header[..count]);
        output.write_all(&header[..count])?;
        let mut total = count as u64;
        let mut buffer = [0u8; 65536];
        loop {
            let read = input.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            total += read as u64;
            if total > LIMIT {
                return Err(AppError::Validation("素材应小于 512 MB 且不能为空".into()));
            }
            hasher.update(&buffer[..read]);
            output.write_all(&buffer[..read])?;
        }
        output.sync_all()?;
        drop(output);
        let id = format!("{:x}.{ext}", hasher.finalize());
        let destination = directory.join(&id);
        if destination.exists() {
            path(root, &id)?;
        } else {
            if let Err(error) = fs::rename(&temporary, &destination) {
                // Another capture may have stored the same content meanwhile.
                if destination.exists() {
                    path(root, &id)?;
                } else {
                    return Err(error.into());
                }
            }
        }
        let asset = Asset {
            id,
            name: name.chars().take(240).collect(),
            mime: mime.into(),
            size: total,
            width,
            height,
        };
        super::connect(root)?.execute(
            "INSERT OR IGNORE INTO assets(id,data) VALUES(?1,?2)",
            params![asset.id, serde_json::to_string(&asset)?],
        )?;
        Ok(asset)
    })();
    let _ = fs::remove_file(temporary);
    result
}

pub fn import_bytes(root: &Path, bytes: &[u8], name: &str) -> AppResult<Asset> {
    if bytes.len() > 32 * 1024 * 1024 {
        return Err(AppError::Validation("剪贴板或上传图片应小于 32 MB".into()));
    }
    // A local extension is only used for image decoding; MIME is always inspected.
    let (_, ext) = format(bytes)?;
    let temp = root.join(format!("upload-{}.{}", uuid::Uuid::new_v4(), ext));
    fs::write(&temp, bytes)?;
    let result = import_file(root, &temp, name);
    let _ = fs::remove_file(temp);
    result
}

pub fn get(root: &Path, id: &str) -> AppResult<Asset> {
    path(root, id)?;
    let json: Option<String> = super::connect(root)?
        .query_row("SELECT data FROM assets WHERE id=?1", [id], |row| {
            row.get(0)
        })
        .optional()?;
    serde_json::from_str(&json.ok_or_else(|| AppError::Storage("找不到此素材".into()))?)
        .map_err(Into::into)
}

pub fn png(root: &Path, image: image::RgbaImage, name: &str) -> AppResult<Asset> {
    if u64::from(image.width()) * u64::from(image.height()) > 40_000_000 {
        return Err(AppError::Validation("图片像素总量不能超过 4000 万".into()));
    }
    let mut bytes = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(image)
        .write_to(&mut bytes, image::ImageFormat::Png)
        .map_err(|_| AppError::Storage("无法编码图片".into()))?;
    import_bytes(root, bytes.get_ref(), name)
}
