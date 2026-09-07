use crate::error::{AppError, AppResult};
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub struct CredentialLock(pub Arc<Mutex<()>>);

fn identity(id: &str, origin: &str) -> AppResult<String> {
    if id.is_empty()
        || id.len() > 100
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::Validation("无效的供应商标识".into()));
    }
    let url = reqwest::Url::parse(origin)
        .map_err(|_| AppError::Validation("服务地址格式不正确".into()))?;
    if !["http", "https"].contains(&url.scheme())
        || !url.username().is_empty()
        || url.password().is_some()
        || url.origin().ascii_serialization() != origin
        || origin.len() > 300
    {
        return Err(AppError::Validation("密钥需要绑定有效的服务来源".into()));
    }
    Ok(format!("{id}@{origin}"))
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn entry(id: &str, origin: &str) -> AppResult<keyring::Entry> {
    keyring::Entry::new("com.qwriter.model-providers", &identity(id, origin)?)
        .map_err(|_| AppError::Storage("系统凭据存储不可用，可继续使用会话密钥".into()))
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
pub fn read(id: &str, origin: &str) -> AppResult<Option<String>> {
    match entry(id, origin)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err(AppError::Storage(
            "无法读取系统保存的密钥，请重新填写或检查系统权限".into(),
        )),
    }
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
pub fn write(id: &str, origin: &str, key: &str) -> AppResult<()> {
    if key.trim().is_empty() || key.len() > 2000 || key.chars().any(char::is_control) {
        return Err(AppError::Validation(
            "API Key 格式不正确，请重新粘贴".into(),
        ));
    }
    entry(id, origin)?
        .set_password(key.trim())
        .map_err(|_| AppError::Storage("无法保存到系统凭据存储，当前密钥仍可在本次会话使用".into()))
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
pub fn remove(id: &str, origin: &str) -> AppResult<()> {
    match entry(id, origin)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err(AppError::Storage(
            "无法移除系统保存的密钥，请检查系统权限后重试".into(),
        )),
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn read(id: &str, origin: &str) -> AppResult<Option<String>> {
    identity(id, origin)?;
    Err(AppError::Storage(
        "当前平台暂不支持系统凭据存储，请使用会话密钥".into(),
    ))
}
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn write(id: &str, origin: &str, _key: &str) -> AppResult<()> {
    read(id, origin).map(|_| ())
}
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn remove(id: &str, origin: &str) -> AppResult<()> {
    read(id, origin).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn credentials_are_scoped_to_provider_and_origin() {
        assert_ne!(
            identity("account-a", "https://api.deepseek.com").unwrap(),
            identity("account-b", "https://api.deepseek.com").unwrap()
        );
        assert_ne!(
            identity("account-a", "https://api.deepseek.com").unwrap(),
            identity("account-a", "https://example.com").unwrap()
        );
        assert!(identity("../other", "https://example.com").is_err());
        assert!(identity("account", "https://key:secret@example.com").is_err());
        assert!(identity("account", "https://example.com/path").is_err());
    }
    #[test]
    #[ignore = "uses a temporary entry in the native credential store"]
    fn native_credential_roundtrip() -> AppResult<()> {
        let id = format!("qwriter-test-{}", std::process::id());
        let origin = "https://qwriter-test.invalid";
        write(&id, origin, "test-only-not-a-real-api-key")?;
        let loaded = read(&id, origin);
        let deleted = remove(&id, origin);
        assert_eq!(loaded?, Some("test-only-not-a-real-api-key".into()));
        deleted?;
        assert!(read(&id, origin)?.is_none());
        Ok(())
    }
}
