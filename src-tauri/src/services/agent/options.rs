use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use specta::Type;

#[derive(Clone, Default, Deserialize, Serialize, Type, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilitySupport {
    #[default]
    Unknown,
    Supported,
    Unsupported,
}
#[derive(Clone, Default, Deserialize, Serialize, Type, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ReasoningAdapter {
    #[default]
    None,
    Openai,
    Deepseek,
    Anthropic,
    AnthropicAdaptive,
}
#[derive(Clone, Deserialize, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ModelCapabilities {
    pub vision: CapabilitySupport,
    pub tools: CapabilitySupport,
    pub reasoning: ReasoningAdapter,
    pub context_window: u32,
}
impl Default for ModelCapabilities {
    fn default() -> Self {
        Self {
            vision: CapabilitySupport::Unknown,
            tools: CapabilitySupport::Unknown,
            reasoning: ReasoningAdapter::None,
            context_window: 32768,
        }
    }
}
#[derive(Clone, Default, Deserialize, Serialize, Type, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ThinkingMode {
    #[default]
    Auto,
    On,
    Off,
}
#[derive(Clone, Default, Deserialize, Serialize, Type, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ThinkingEffort {
    Low,
    #[default]
    Medium,
    High,
    Max,
}
#[derive(Clone, Deserialize, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HarnessOptions {
    pub capabilities: ModelCapabilities,
    pub thinking: ThinkingMode,
    pub effort: ThinkingEffort,
    pub max_rounds: u8,
    pub memory_enabled: bool,
    pub document_id: String,
    pub image_ids: Vec<String>,
}
impl Default for HarnessOptions {
    fn default() -> Self {
        Self {
            capabilities: ModelCapabilities::default(),
            thinking: ThinkingMode::Auto,
            effort: ThinkingEffort::Medium,
            max_rounds: 6,
            memory_enabled: false,
            document_id: String::new(),
            image_ids: vec![],
        }
    }
}
impl HarnessOptions {
    pub fn validate(&self, protocol: &str) -> AppResult<()> {
        if !(16384..=2_000_000).contains(&self.capabilities.context_window)
            || !(2..=16).contains(&self.max_rounds)
            || self.document_id.len() > 200
            || self.image_ids.len() > 4
        {
            return Err(AppError::Validation("Agent 配置超出允许范围".into()));
        }
        if self.capabilities.tools == CapabilitySupport::Unsupported {
            return Err(AppError::Validation(
                "此模型标记为不支持工具调用，请切换模型".into(),
            ));
        }
        if !self.image_ids.is_empty() && self.capabilities.vision != CapabilitySupport::Supported {
            return Err(AppError::Validation(
                "请先确认模型支持图片理解，再发送图片".into(),
            ));
        }
        if self.thinking != ThinkingMode::Auto {
            if self.effort == ThinkingEffort::Max
                && self.capabilities.reasoning != ReasoningAdapter::Deepseek
            {
                return Err(AppError::Validation(
                    "最高思考强度仅适用于 DeepSeek 思考协议".into(),
                ));
            }
            let compatible = match self.capabilities.reasoning {
                ReasoningAdapter::None => false,
                ReasoningAdapter::Openai | ReasoningAdapter::Deepseek => protocol == "openai",
                _ => protocol == "anthropic",
            };
            if !compatible {
                return Err(AppError::Validation("请为此模型配置匹配的思考协议".into()));
            }
        }
        Ok(())
    }
    pub fn apply_reasoning(&self, body: &mut Value) {
        if self.thinking == ThinkingMode::Auto {
            return;
        }
        let enabled = self.thinking == ThinkingMode::On;
        let effort = match self.effort {
            ThinkingEffort::Low => "low",
            ThinkingEffort::Medium => "medium",
            ThinkingEffort::High => "high",
            ThinkingEffort::Max => "max",
        };
        match self.capabilities.reasoning {
            ReasoningAdapter::Openai => {
                body["reasoning_effort"] = json!(if enabled { effort } else { "none" })
            }
            ReasoningAdapter::Deepseek => {
                body["thinking"] = json!({"type":if enabled { "enabled" } else { "disabled" }});
                if enabled {
                    body["reasoning_effort"] = json!(match self.effort {
                        ThinkingEffort::Low => "low",
                        ThinkingEffort::Max => "max",
                        _ => "high",
                    });
                }
            }
            ReasoningAdapter::Anthropic => {
                body["thinking"] = if enabled {
                    json!({"type":"enabled","budget_tokens":match self.effort { ThinkingEffort::Low => 1024, ThinkingEffort::Medium => 4096, _ => 6144 }})
                } else {
                    json!({"type":"disabled"})
                };
            }
            ReasoningAdapter::AnthropicAdaptive => {
                body["thinking"] = json!({"type":if enabled { "adaptive" } else { "disabled" }});
                if enabled {
                    body["output_config"] = json!({"effort":effort});
                }
            }
            ReasoningAdapter::None => {}
        }
    }
}
