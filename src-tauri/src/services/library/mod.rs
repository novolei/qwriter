//! Transactional local library. No caller-supplied filesystem paths.
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::Manager;

#[derive(Default)]
pub struct LibraryLock(pub Arc<Mutex<()>>);

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, specta::Type)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub markdown: String,
    pub updated: i64,
}

#[derive(Serialize, serde::Deserialize, specta::Type)]
pub struct Library {
    pub revision: i64,
    pub docs: Vec<Document>,
    pub location: String,
}

#[derive(Serialize, serde::Deserialize, specta::Type)]
pub struct Snapshot {
    pub id: i64,
    pub title: String,
    pub markdown: String,
    pub saved: i64,
}

pub(crate) fn connect(path: &std::path::Path) -> Result<Connection, String> {
    let db = Connection::open(path).map_err(|e| format!("文稿库无法打开：{e}"))?;
    db.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
        INSERT OR IGNORE INTO meta VALUES(1,0);
        CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, title TEXT NOT NULL, markdown TEXT NOT NULL, updated INTEGER NOT NULL, position INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, doc_id TEXT NOT NULL, title TEXT NOT NULL, markdown TEXT NOT NULL, saved INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS snapshot_doc ON snapshots(doc_id,id);")
        .map_err(|e| e.to_string())?;
    Ok(db)
}

pub(crate) fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root.join("library.sqlite3"))
}

pub(crate) fn load(db: &Connection, location: String) -> Result<Library, String> {
    // One read transaction provides a consistent document set and revision.
    let tx = db.unchecked_transaction().map_err(|e| e.to_string())?;
    let revision = tx
        .query_row("SELECT revision FROM meta WHERE id=1", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let docs = {
        let mut stmt = tx
            .prepare("SELECT id,title,markdown,updated FROM documents ORDER BY position")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok(Document {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    markdown: r.get(2)?,
                    updated: r.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    tx.commit().map_err(|e| e.to_string())?;
    Ok(Library {
        revision,
        docs,
        location,
    })
}

pub(crate) fn save(db: &mut Connection, docs: &[Document], expected: i64) -> Result<i64, String> {
    if docs.is_empty() || docs.len() > 10000 || !(0..9_007_199_254_740_991).contains(&expected) {
        return Err("文稿数量超出有效范围".into());
    }
    let mut ids = HashSet::new();
    for d in docs {
        if d.id.is_empty()
            || !(0..=9_007_199_254_740_991).contains(&d.updated)
            || d.id.len() > 128
            || !ids.insert(&d.id)
            || d.title.len() > 4096
            || d.markdown.len() > 10 * 1024 * 1024
        {
            return Err("文稿格式无效或单篇超过 10 MB".into());
        }
    }
    let tx = db
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    let revision: i64 = tx
        .query_row("SELECT revision FROM meta WHERE id=1", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if revision != expected {
        return Err("文稿库已被另一个窗口修改。当前草稿仍在本机缓存，请导出当前文稿后重新打开应用，避免覆盖。".into());
    }
    // Preserve removed documents as well; a partial frontend payload must not delete content.
    for (position, d) in docs.iter().enumerate() {
        let old: Option<(String, String)> = tx
            .query_row(
                "SELECT title,markdown FROM documents WHERE id=?1",
                [&d.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some((title, markdown)) = old {
            if title != d.title || markdown != d.markdown {
                tx.execute("INSERT INTO snapshots(doc_id,title,markdown,saved) VALUES(?1,?2,?3,CAST(unixepoch('subsec')*1000 AS INTEGER))", params![d.id,title,markdown]).map_err(|e| e.to_string())?;
                tx.execute("DELETE FROM snapshots WHERE doc_id=?1 AND id NOT IN (SELECT id FROM snapshots WHERE doc_id=?1 ORDER BY id DESC LIMIT 50)", [&d.id]).map_err(|e| e.to_string())?;
            }
        }
        tx.execute("INSERT INTO documents VALUES(?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET title=excluded.title,markdown=excluded.markdown,updated=excluded.updated,position=excluded.position", params![d.id,d.title,d.markdown,d.updated,position]).map_err(|e| e.to_string())?;
    }
    tx.execute("UPDATE meta SET revision=revision+1 WHERE id=1", [])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(revision + 1)
}

pub(crate) fn history(db: &Connection, doc_id: &str) -> crate::error::AppResult<Vec<Snapshot>> {
    let mut stmt = db.prepare(
        "SELECT id,title,markdown,saved FROM snapshots WHERE doc_id=?1 ORDER BY id DESC LIMIT 50",
    )?;
    let rows = stmt.query_map([doc_id], |r| {
        Ok(Snapshot {
            id: r.get(0)?,
            title: r.get(1)?,
            markdown: r.get(2)?,
            saved: r.get(3)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[cfg(test)]
mod tests;
