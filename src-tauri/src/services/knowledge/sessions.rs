use super::connect;
use crate::{
    error::{AppError, AppResult},
    services::agent::types::AgentOutput,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AgentSession {
    pub id: String,
    pub instruction: String,
    pub model: String,
    pub document_id: String,
    pub created_at: i64,
    pub output: AgentOutput,
}
pub fn save(root: &Path, session: AgentSession) -> AppResult<()> {
    if uuid::Uuid::parse_str(&session.id).is_err()
        || session.instruction.len() > 16000
        || session.model.len() > 600
        || session.document_id.len() > 200
    {
        return Err(AppError::Validation("任务记录无效".into()));
    }
    let data = serde_json::to_string(&session)?;
    if data.len() > 1024 * 1024 {
        return Err(AppError::Validation("任务记录过大".into()));
    }
    let mut db = connect(root)?;
    let tx = db.transaction()?;
    tx.execute(
        "INSERT OR IGNORE INTO agent_sessions(id,data) VALUES(?1,?2)",
        rusqlite::params![session.id, data],
    )?;
    tx.execute("DELETE FROM agent_sessions WHERE rowid NOT IN (SELECT rowid FROM agent_sessions ORDER BY rowid DESC LIMIT 100)",[])?;
    tx.commit()?;
    Ok(())
}
pub fn list(root: &Path) -> AppResult<Vec<AgentSession>> {
    let db = connect(root)?;
    let mut stmt = db.prepare("SELECT data FROM agent_sessions ORDER BY rowid DESC LIMIT 100")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    rows.map(|r| Ok(serde_json::from_str(&r?)?)).collect()
}
