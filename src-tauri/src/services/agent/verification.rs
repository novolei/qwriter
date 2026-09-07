use super::{
    run,
    types::{AgentInput, AgentNote, AgentStatus},
};
use crate::{
    error::{AppError, AppResult},
    services::provider::{connection, ModelConfig},
};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

#[derive(Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ModelVerification {
    pub elapsed_ms: u32,
    pub tools_supported: bool,
}

/// Exercise the same bounded runtime as writing tasks, with built-in test data only.
pub async fn verify(config: ModelConfig) -> AppResult<ModelVerification> {
    connection::validate(&config)?;
    let started = Instant::now();
    let marker = format!(
        "QWRITER-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| AppError::Internal("无法创建连接测试".into()))?
            .as_nanos()
    );
    let input = AgentInput {
        instruction: "This is a connection test. Read the attached test document using read_document, then call propose_draft with title 'Connection test' and markdown containing ONLY the exact verification code from that document. No commentary is needed.".into(),
        notes: vec![AgentNote { id: "qwriter:connection-test".into(), title: "Connection test".into(), markdown: format!("Verification code: {marker}") }],
        language: "en".into(),
    };
    let output = tokio::time::timeout(
        Duration::from_secs(90),
        run(config, input, CancellationToken::new(), |_| Ok(())),
    )
    .await
    .map_err(|_| {
        AppError::Network("验证耗时较长，已停止测试；可稍后重试或选择更快的模型".into())
    })??;
    let tools_supported = matches!(output.status, AgentStatus::Complete)
        && output
            .read_ids
            .iter()
            .any(|id| id == "qwriter:connection-test")
        && output
            .draft
            .is_some_and(|draft| draft.markdown.contains(&marker));
    Ok(ModelVerification {
        elapsed_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
        tools_supported,
    })
}
