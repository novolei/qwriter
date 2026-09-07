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

#[tauri::command]
#[specta::specta]
pub async fn agent_run(
    state: tauri::State<'_, AgentRequests>,
    request_id: String,
    config: ModelConfig,
    input: AgentInput,
    on_event: Channel<AgentEvent>,
) -> AppResult<AgentOutput> {
    let (token, _guard) = state.register(&request_id)?;
    agent::run(config, input, token, |event| {
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
