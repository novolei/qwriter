use crate::{
    error::AppResult,
    services::{
        agent::{
            self,
            types::{AgentEvent, AgentInput, AgentOutput},
            AgentRequests,
        },
        provider::ModelConfig,
    },
};
use tauri::ipc::Channel;
use tauri::Manager;

#[tauri::command]
#[specta::specta]
pub async fn agent_run(
    app: tauri::AppHandle,
    state: tauri::State<'_, AgentRequests>,
    request_id: String,
    config: ModelConfig,
    input: AgentInput,
    on_event: Channel<AgentEvent>,
) -> AppResult<AgentOutput> {
    let (token, _guard) = state.register(&request_id)?;
    agent::validate(&input, &config)?;
    let root = app.path().app_data_dir()?;
    let options = input.harness.clone().unwrap_or_default();
    let context =
        tauri::async_runtime::spawn_blocking(move || agent::context::prepare(&root, &options))
            .await??;
    agent::run_with_context(config, input, token, context, |event| {
        on_event.send(event).map_err(Into::into)
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn agent_cancel(
    state: tauri::State<'_, AgentRequests>,
    request_id: String,
) -> AppResult<()> {
    state.cancel(&request_id)
}
