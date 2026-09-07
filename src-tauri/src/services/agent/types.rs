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
    #[serde(default)]
    pub harness: Option<super::options::HarnessOptions>,
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
    pub memories: Vec<MemoryProposal>,
    pub memory_read_ids: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize, specta::Type)]
pub struct MemoryProposal {
    pub title: String,
    pub content: String,
    pub kind: String,
    pub source: String,
}

#[derive(Clone, Deserialize, Serialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    Started,
    Context {
        estimated_tokens: u32,
        budget: u32,
        compacted: bool,
    },
    Plan {
        steps: Vec<String>,
    },
    Thinking {
        round: u8,
    },
    Tool {
        name: String,
        detail: String,
        success: bool,
    },
}
