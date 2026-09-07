use super::{chunks::KnowledgeChunk, index};
use crate::error::AppResult;
use std::{future::Future, path::PathBuf, pin::Pin};

type RetrievalFuture<'a, T> = Pin<Box<dyn Future<Output = AppResult<T>> + Send + 'a>>;

/// The loop consumes this capability; storage and ranking remain replaceable.
pub trait KnowledgeRetriever: Send + Sync {
    fn search(&self, query: String) -> RetrievalFuture<'_, Vec<KnowledgeChunk>>;
    fn read(&self, id: String) -> RetrievalFuture<'_, KnowledgeChunk>;
}

pub struct LocalRetriever {
    pub root: PathBuf,
    pub document_id: String,
}
impl KnowledgeRetriever for LocalRetriever {
    fn search(&self, query: String) -> RetrievalFuture<'_, Vec<KnowledgeChunk>> {
        let (root, scope) = (self.root.clone(), self.document_id.clone());
        Box::pin(async move {
            tauri::async_runtime::spawn_blocking(move || index::search(&root, &query, &scope))
                .await?
        })
    }
    fn read(&self, id: String) -> RetrievalFuture<'_, KnowledgeChunk> {
        let (root, scope) = (self.root.clone(), self.document_id.clone());
        Box::pin(async move {
            tauri::async_runtime::spawn_blocking(move || index::read(&root, &id, &scope)).await?
        })
    }
}
