use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Clone, Deserialize, Serialize, Type)]
pub struct AgentNote {
    pub id: String,
    pub title: String,
    pub markdown: String,
}

#[derive(Clone, Deserialize, Serialize, Type)]
pub struct AgentInput {
    pub instruction: String,
    pub notes: Vec<AgentNote>,
    pub language: String,
}

#[derive(Clone, Deserialize, Serialize, Type)]
pub struct AgentDraft {
    pub title: String,
    pub markdown: String,
    pub summary: String,
}

#[derive(Clone, Deserialize, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Complete,
    Cancelled,
    Limit,
}

#[derive(Clone, Deserialize, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AgentOutput {
    pub status: AgentStatus,
    pub answer: String,
    pub draft: Option<AgentDraft>,
    pub read_ids: Vec<String>,
    pub rounds: u8,
}

#[derive(Clone, Deserialize, Serialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    Started,
    Thinking {
        round: u8,
    },
    Tool {
        name: String,
        detail: String,
        success: bool,
    },
}
