use super::{
    chunks::{self, KnowledgeChunk},
    MemoryEntry,
};
use crate::error::{AppError, AppResult};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use std::{
    collections::{HashMap, HashSet},
    path::Path,
};

pub fn schema(db: &Connection) -> AppResult<()> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS knowledge_index(memory_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS knowledge_chunks(id TEXT PRIMARY KEY, memory_id TEXT NOT NULL, document_id TEXT NOT NULL, data TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS knowledge_chunk_memory ON knowledge_chunks(memory_id);
        CREATE INDEX IF NOT EXISTS knowledge_chunk_scope ON knowledge_chunks(document_id);
        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(id UNINDEXED, title, heading, content, tokenize='unicode61');")?;
    Ok(())
}
pub fn replace(tx: &Transaction<'_>, entry: &MemoryEntry) -> AppResult<()> {
    tx.execute("DELETE FROM knowledge_fts WHERE id IN (SELECT id FROM knowledge_chunks WHERE memory_id=?1)", [&entry.id])?;
    tx.execute(
        "DELETE FROM knowledge_chunks WHERE memory_id=?1",
        [&entry.id],
    )?;
    if !entry.archived {
        let mut insert = tx.prepare_cached(
            "INSERT INTO knowledge_chunks(id,memory_id,document_id,data) VALUES(?1,?2,?3,?4)",
        )?;
        let mut fts = tx.prepare_cached(
            "INSERT INTO knowledge_fts(id,title,heading,content) VALUES(?1,?2,?3,?4)",
        )?;
        for chunk in chunks::split(entry) {
            insert.execute(params![
                chunk.id,
                entry.id,
                entry.document_id,
                serde_json::to_string(&chunk)?
            ])?;
            fts.execute(params![
                chunk.id,
                chunks::tokens(&chunk.title, false).join(" "),
                chunks::tokens(&chunk.heading, false).join(" "),
                chunks::tokens(&chunk.content, false).join(" ")
            ])?;
        }
    }
    tx.execute("INSERT INTO knowledge_index(memory_id,revision,version) VALUES(?1,?2,?3) ON CONFLICT(memory_id) DO UPDATE SET revision=excluded.revision,version=excluded.version",
        params![entry.id, entry.revision, chunks::INDEX_VERSION])?;
    Ok(())
}

/// First-use migration only. Subsequent saves maintain the index in the same transaction.
fn ready(root: &Path) -> AppResult<Connection> {
    let mut db = super::connect(root)?;
    let missing = db.query_row("SELECT count(*) FROM memories m LEFT JOIN knowledge_index i ON m.id=i.memory_id WHERE i.version IS NULL OR i.version<>?1 OR i.revision<>m.revision", [chunks::INDEX_VERSION], |r| r.get::<_, u32>(0))?;
    if missing > 0 {
        let tx = db.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let entries = {
            let mut stmt = tx.prepare("SELECT m.data FROM memories m LEFT JOIN knowledge_index i ON m.id=i.memory_id WHERE i.version IS NULL OR i.version<>?1 OR i.revision<>m.revision")?;
            let rows = stmt.query_map([chunks::INDEX_VERSION], |r| r.get::<_, String>(0))?;
            rows.map(|r| Ok(serde_json::from_str::<MemoryEntry>(&r?)?))
                .collect::<AppResult<Vec<_>>>()?
        };
        for entry in entries {
            replace(&tx, &entry)?;
        }
        tx.commit()?;
    }
    Ok(db)
}

pub fn search(root: &Path, query: &str, document_id: &str) -> AppResult<Vec<KnowledgeChunk>> {
    if query.len() > 300 || document_id.len() > 200 {
        return Err(AppError::Validation("搜索内容不能超过 300 字节".into()));
    }
    let mut seen = HashSet::new();
    let terms: Vec<_> = chunks::tokens(query, true)
        .into_iter()
        .filter(|s| seen.insert(s.clone()))
        .take(24)
        .collect();
    if terms.is_empty() {
        return Ok(vec![]);
    }
    let expression = terms
        .iter()
        .map(|s| format!("\"{}\"", s.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" OR ");
    let db = ready(root)?;
    // Filter scope before ranking/candidate limit; titles and section names carry more weight.
    let mut stmt = db.prepare("SELECT c.data, bm25(knowledge_fts,0,8,4,1) AS relevance FROM knowledge_fts f JOIN knowledge_chunks c ON c.id=f.id WHERE knowledge_fts MATCH ?1 AND (c.document_id='' OR c.document_id=?2) ORDER BY relevance LIMIT 256")?;
    let rows = stmt.query_map(params![expression, document_id], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?))
    })?;
    let mut candidates = rows
        .map(|r| {
            let (data, rank) = r?;
            let chunk: KnowledgeChunk = serde_json::from_str(&data)?;
            let text =
                format!("{} {} {}", chunk.title, chunk.heading, chunk.content).to_lowercase();
            let coverage = terms
                .iter()
                .filter(|term| text.contains(term.as_str()))
                .count();
            let phrase = text.contains(&query.trim().to_lowercase());
            Ok((chunk, coverage, phrase, rank))
        })
        .collect::<AppResult<Vec<_>>>()?;
    candidates.sort_by(|a, b| {
        b.1.cmp(&a.1)
            .then(b.2.cmp(&a.2))
            .then(a.3.total_cmp(&b.3))
            .then(a.0.id.cmp(&b.0.id))
    });
    let mut per_source = HashMap::<String, usize>::new();
    Ok(candidates
        .into_iter()
        .filter_map(|(chunk, _, _, _)| {
            let count = per_source.entry(chunk.memory_id.clone()).or_default();
            *count += 1;
            (*count <= 3).then_some(chunk)
        })
        .take(24)
        .collect())
}

pub fn read(root: &Path, id: &str, document_id: &str) -> AppResult<KnowledgeChunk> {
    if id.len() > 150 || document_id.len() > 200 {
        return Err(AppError::Validation("知识片段不可用，请重新检索".into()));
    }
    let db = ready(root)?;
    let data = db
        .query_row(
            "SELECT data FROM knowledge_chunks WHERE id=?1 AND (document_id='' OR document_id=?2)",
            params![id, document_id],
            |r| r.get::<_, String>(0),
        )
        .optional()?;
    data.map(|data| serde_json::from_str(&data).map_err(AppError::from))
        .unwrap_or_else(|| Err(AppError::Conflict("知识片段不可用，请重新检索".into())))
}

pub fn source(root: &Path, memory_id: &str, document_id: &str) -> AppResult<Option<MemoryEntry>> {
    if uuid::Uuid::parse_str(memory_id).is_err() || document_id.len() > 200 {
        return Err(AppError::Validation("知识片段不可用，请重新检索".into()));
    }
    let db = super::connect(root)?;
    let data = db.query_row("SELECT data FROM memories WHERE id=?1 AND (json_extract(data,'$.documentId')='' OR json_extract(data,'$.documentId')=?2) AND json_extract(data,'$.archived')=0", params![memory_id, document_id], |r| r.get::<_, String>(0)).optional()?;
    data.map(|data| serde_json::from_str(&data).map_err(AppError::from))
        .transpose()
}

pub fn preferences(root: &Path, document_id: &str) -> AppResult<Vec<MemoryEntry>> {
    let db = super::connect(root)?;
    let mut stmt = db.prepare("SELECT data FROM memories WHERE json_extract(data,'$.archived')=0 AND json_extract(data,'$.kind')='preference' AND (json_extract(data,'$.documentId')='' OR json_extract(data,'$.documentId')=?1) ORDER BY rowid DESC LIMIT 6")?;
    let rows = stmt.query_map([document_id], |r| r.get::<_, String>(0))?;
    rows.map(|r| Ok(serde_json::from_str(&r?)?)).collect()
}
