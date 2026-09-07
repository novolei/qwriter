use super::assets;
use crate::error::{AppError, AppResult};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Clone, Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: String,
    pub title: String,
    pub body: String,
    pub asset_ids: Vec<String>,
    pub source_url: String,
    pub pinned: bool,
    pub archived: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub revision: i64,
}

pub fn validate(card: &Card) -> AppResult<()> {
    if uuid::Uuid::parse_str(&card.id).is_err()
        || card.title.len() > 1000
        || card.body.len() > 256 * 1024
        || card.asset_ids.len() > 12
        || card.source_url.len() > 4096
        || card.revision < 0
    {
        return Err(AppError::Validation("速记内容无效或超过大小限制".into()));
    }
    if card.title.trim().is_empty() && card.body.trim().is_empty() && card.asset_ids.is_empty() {
        return Err(AppError::Validation("写下一点想法，或添加一份素材".into()));
    }
    if !card.source_url.is_empty() {
        let url = reqwest::Url::parse(&card.source_url)
            .map_err(|_| AppError::Validation("请输入有效的链接地址".into()))?;
        if !matches!(url.scheme(), "https" | "http")
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err(AppError::Validation("请输入有效的链接地址".into()));
        }
    }
    Ok(())
}

pub fn list(root: &Path) -> AppResult<Vec<Card>> {
    let db = super::connect(root)?;
    let mut query = db.prepare("SELECT data FROM cards ORDER BY updated DESC")?;
    let rows = query.query_map([], |row| row.get::<_, String>(0))?;
    let mut cards = Vec::new();
    for row in rows {
        cards.push(serde_json::from_str(&row?)?);
    }
    Ok(cards)
}

pub fn save(root: &Path, mut card: Card) -> AppResult<Card> {
    validate(&card)?;
    for id in &card.asset_ids {
        assets::get(root, id)?;
    }
    let mut db = super::connect(root)?;
    let tx = db.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let old: Option<(i64, String)> = tx
        .query_row(
            "SELECT revision,data FROM cards WHERE id=?1",
            [&card.id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let revision = old.as_ref().map(|x| x.0).unwrap_or(0);
    if card.revision != revision {
        return Err(AppError::Conflict(
            "这张卡片已在另一个窗口更新，请重新打开后编辑".into(),
        ));
    }
    card.created_at = if let Some((_, json)) = old {
        serde_json::from_str::<Card>(&json)?.created_at
    } else {
        super::now()
    };
    card.updated_at = super::now();
    card.revision = revision + 1;
    tx.execute("INSERT INTO cards(id,revision,updated,data) VALUES(?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,updated=excluded.updated,data=excluded.data",
        params![card.id, card.revision, card.updated_at, serde_json::to_string(&card)?])?;
    tx.commit()?;
    Ok(card)
}
