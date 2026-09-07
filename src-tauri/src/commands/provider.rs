use crate::{
    error::{AppError, AppResult},
    services::{
        agent::verification::{self, ModelVerification},
        provider::{self, connection::ModelList, ModelConfig},
    },
};

#[tauri::command]
#[specta::specta]
pub async fn ai_complete(
    config: ModelConfig,
    instruction: String,
    context: String,
) -> AppResult<String> {
    provider::ai_complete(config, instruction, context)
        .await
        .map_err(AppError::Network)
}
#[tauri::command]
#[specta::specta]
pub async fn list_models(config: ModelConfig) -> AppResult<ModelList> {
    provider::connection::discover(config).await
}
#[tauri::command]
#[specta::specta]
pub async fn model_verify(config: ModelConfig) -> AppResult<ModelVerification> {
    verification::verify(config).await
}
#[tauri::command]
#[specta::specta]
pub async fn comfy_request(
    base_url: String,
    workflow: Option<String>,
    prompt_id: Option<String>,
) -> AppResult<String> {
    if workflow
        .as_ref()
        .is_some_and(|value| value.len() > 10 * 1024 * 1024)
    {
        return Err(AppError::Validation("工作流超过 10 MB".into()));
    }
    let workflow = workflow
        .map(|value| serde_json::from_str(&value))
        .transpose()?;
    let result = provider::comfy_request(base_url, workflow, prompt_id)
        .await
        .map_err(AppError::Network)?;
    Ok(serde_json::to_string(&result)?)
}
