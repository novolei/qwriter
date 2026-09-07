use crate::error::{AppError, AppResult};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::{
    path::Path,
    sync::{Arc, Mutex},
};

#[derive(Default)]
pub struct KnowledgeLock(pub Arc<Mutex<()>>);
#[derive(Clone, Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEntry {
    pub id: String,
    pub title: String,
    pub content: String,
    pub kind: String,
    pub document_id: String,
    pub source: String,
    pub archived: bool,
    pub revision: i64,
    pub updated_at: i64,
}
fn connect(root: &Path) -> AppResult<Connection> {
    std::fs::create_dir_all(root)?;
    let db = Connection::open(root.join("knowledge.sqlite3"))?;
    db.busy_timeout(std::time::Duration::from_secs(5))?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS agent_sessions(id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_search USING fts5(id UNINDEXED, title, content, tokenize='trigram');")?;
    index::schema(&db)?;
    Ok(db)
}
pub fn validate(entry: &MemoryEntry) -> AppResult<()> {
    if uuid::Uuid::parse_str(&entry.id).is_err()
        || entry.title.trim().is_empty()
        || entry.title.len() > 600
        || entry.content.trim().is_empty()
        || entry.content.len() > 128 * 1024
        || !["preference", "fact", "knowledge"].contains(&entry.kind.as_str())
        || entry.document_id.len() > 200
        || entry.source.len() > 1000
        || entry.revision < 0
        || entry.revision >= 9_007_199_254_740_991
    {
        return Err(AppError::Validation("记忆内容无效或超过大小限制".into()));
    }
    Ok(())
}
pub fn list(root: &Path) -> AppResult<Vec<MemoryEntry>> {
    let db = connect(root)?;
    let mut stmt = db.prepare("SELECT data FROM memories ORDER BY rowid DESC LIMIT 1000")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    rows.map(|r| Ok(serde_json::from_str(&r?)?)).collect()
}
pub fn save(root: &Path, mut entry: MemoryEntry) -> AppResult<MemoryEntry> {
    validate(&entry)?;
    let mut db = connect(root)?;
    let tx = db.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let previous = tx
        .query_row(
            "SELECT revision FROM memories WHERE id=?1",
            [&entry.id],
            |r| r.get::<_, i64>(0),
        )
        .optional()?;
    if previous.unwrap_or(0) != entry.revision {
        return Err(AppError::Conflict(
            "这条记忆已更新，请重新打开后编辑".into(),
        ));
    }
    if previous.is_none()
        && tx.query_row("SELECT count(*) FROM memories", [], |r| r.get::<_, u32>(0))? >= 1000
    {
        return Err(AppError::Validation("本地记忆已达到 1000 条上限".into()));
    }
    entry.revision += 1;
    entry.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or_default();
    tx.execute("INSERT INTO memories(id,revision,data) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data",
        params![entry.id, entry.revision, serde_json::to_string(&entry)?])?;
    tx.execute("DELETE FROM memory_search WHERE id=?1", [&entry.id])?;
    if !entry.archived {
        tx.execute(
            "INSERT INTO memory_search(id,title,content) VALUES(?1,?2,?3)",
            params![entry.id, entry.title, entry.content],
        )?;
    }
    index::replace(&tx, &entry)?;
    tx.commit()?;
    Ok(entry)
}
pub fn search(root: &Path, query: &str, document_id: &str) -> AppResult<Vec<MemoryEntry>> {
    if query.len() > 300 {
        return Err(AppError::Validation("搜索内容不能超过 300 字节".into()));
    }
    // FTS5 handles long phrases efficiently; short CJK searches use literal matching.
    let db = connect(root)?;
    let all = if query.trim().chars().count() >= 3 {
        let mut stmt = db.prepare("SELECT m.data FROM memory_search s JOIN memories m ON m.id=s.id WHERE memory_search MATCH ?1 AND (json_extract(m.data,'$.documentId')='' OR json_extract(m.data,'$.documentId')=?2) AND json_extract(m.data,'$.archived')=0 ORDER BY rank LIMIT 100")?;
        let quoted = format!("\"{}\"", query.trim().replace('"', "\"\""));
        let rows = stmt.query_map(params![quoted, document_id], |r| r.get::<_, String>(0))?;
        rows.map(|r| Ok(serde_json::from_str::<MemoryEntry>(&r?)?))
            .collect::<AppResult<Vec<_>>>()?
    } else {
        list(root)?
    };
    let needle = query.trim().to_lowercase();
    Ok(all
        .into_iter()
        .filter(|e| {
            !e.archived
                && (e.document_id.is_empty() || e.document_id == document_id)
                && (needle.is_empty()
                    || format!("{} {}", e.title, e.content)
                        .to_lowercase()
                        .contains(&needle))
        })
        .take(24)
        .collect())
}

pub mod chunks;
pub mod index;
#[cfg(test)]
mod retrieval_eval;
#[cfg(test)]
mod retrieval_tests;
pub mod retriever;
pub mod sessions;
#[cfg(test)]
mod tests;
