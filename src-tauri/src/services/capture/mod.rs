pub mod assets;
pub mod cards;
pub mod desktop;
pub mod encoding;
pub mod environment;
pub mod export;
pub mod global;
pub mod links;
pub mod screens;
pub mod windows;

use crate::error::AppResult;
use rusqlite::Connection;
use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tauri::Manager;

#[derive(Default)]
pub struct CaptureLock(pub Arc<Mutex<()>>);

pub fn root(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let path = app.path().app_data_dir()?;
    std::fs::create_dir_all(path.join("assets"))?;
    Ok(path)
}

pub fn connect(root: &Path) -> AppResult<Connection> {
    let db = Connection::open(root.join("captures.sqlite3"))?;
    db.busy_timeout(std::time::Duration::from_secs(5))?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cards(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, updated INTEGER NOT NULL, data TEXT NOT NULL);")?;
    Ok(db)
}

pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests;

#[cfg(all(test, any(target_os = "windows", target_os = "macos")))]
mod performance;
