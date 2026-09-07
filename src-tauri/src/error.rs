use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

/// Stable IPC codes. Provider bodies and credentials must never enter these messages.
#[derive(Debug, Error, Serialize, Deserialize, Type)]
#[serde(tag = "code", content = "message", rename_all = "snake_case")]
pub enum AppError {
    #[error("{0}")]
    Validation(String),
    #[error("{0}")]
    Storage(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    Network(String),
    #[error("{0}")]
    Git(String),
    #[error("{0}")]
    Internal(String),
}
pub type AppResult<T> = Result<T, AppError>;
#[cfg(test)]
#[path = "error_tests.rs"]
mod tests;
impl From<tauri::Error> for AppError {
    fn from(_: tauri::Error) -> Self {
        Self::Internal("后台任务未能完成，请重试".into())
    }
}
impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::Storage(error.to_string())
    }
}
impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Storage(error.to_string())
    }
}
impl From<git2::Error> for AppError {
    fn from(error: git2::Error) -> Self {
        Self::Git(error.message().to_owned())
    }
}
impl From<reqwest::Error> for AppError {
    fn from(_: reqwest::Error) -> Self {
        Self::Network("无法连接服务，请检查配置及网络".into())
    }
}
impl From<serde_json::Error> for AppError {
    fn from(_: serde_json::Error) -> Self {
        Self::Validation("服务未返回有效 JSON".into())
    }
}
impl From<tokio::task::JoinError> for AppError {
    fn from(_: tokio::task::JoinError) -> Self {
        Self::Internal("后台任务未能完成，请重试".into())
    }
}
