use super::options::{HarnessOptions, ReasoningAdapter, ThinkingMode};
use crate::{
    error::{AppError, AppResult},
    services::provider::ModelConfig,
};
use serde_json::{json, Value};

pub fn deepseek(config: &ModelConfig, options: &HarnessOptions) -> bool {
    config.protocol == "openai"
        && (options.capabilities.reasoning == ReasoningAdapter::Deepseek
            || reqwest::Url::parse(&config.base_url)
                .ok()
                .and_then(|u| u.host_str().map(str::to_owned))
                .as_deref()
                == Some("api.deepseek.com"))
}
fn reasoning_required(config: &ModelConfig, options: &HarnessOptions) -> bool {
    deepseek(config, options)
        && match options.thinking {
            ThinkingMode::On => true,
            ThinkingMode::Off => false,
            ThinkingMode::Auto => {
                config.model == "deepseek-reasoner" || config.model.starts_with("deepseek-v4")
            }
        }
}

/// Effort is a provider-specific preference. Output capacity is a separate,
/// context-bounded budget, never blindly increased after context assembly.
pub fn output_budget(config: &ModelConfig, options: &HarnessOptions) -> u32 {
    if reasoning_required(config, options) {
        32768.min(options.capabilities.context_window / 2)
    } else {
        8192
    }
}

pub fn prepare(
    payload: &mut Value,
    config: &ModelConfig,
    options: &HarnessOptions,
) -> AppResult<()> {
    if !deepseek(config, options) {
        return Ok(());
    }
    let thinking = reasoning_required(config, options);
    let budget = output_budget(config, options);
    let Some(body) = payload.as_object_mut() else {
        return Ok(());
    };
    let previous = body
        .get("max_tokens")
        .or_else(|| body.get("max_completion_tokens"))
        .and_then(Value::as_u64);
    body.remove("max_completion_tokens");
    body.insert(
        "max_tokens".into(),
        json!(previous.map_or(u64::from(budget), |cap| cap.min(u64::from(budget)))),
    );
    if thinking {
        body.remove("tool_choice");
        for name in [
            "temperature",
            "top_p",
            "presence_penalty",
            "frequency_penalty",
        ] {
            body.remove(name);
        }
    }
    if let Some(messages) = body.get_mut("messages").and_then(Value::as_array_mut) {
        for message in messages {
            if message["role"] != "assistant" {
                continue;
            }
            if thinking {
                validate_replay(message)?;
            }
            if let Some(fields) = message.as_object_mut() {
                if options.thinking == ThinkingMode::Off {
                    fields.remove("reasoning_content");
                }
                if fields.get("content").is_none_or(Value::is_null) {
                    fields.insert("content".into(), json!(""));
                }
            }
        }
    }
    Ok(())
}

fn validate_replay(message: &Value) -> AppResult<()> {
    // A real empty string is valid; an absent/null field is not interchangeable.
    if !message["reasoning_content"].is_string() {
        return Err(AppError::Network(
            "DeepSeek 思考续轮缺少原始思考数据，请重新开始任务或关闭思考".into(),
        ));
    }
    Ok(())
}

pub fn validate_turn(
    message: &Value,
    has_tools: bool,
    config: &ModelConfig,
    options: &HarnessOptions,
) -> AppResult<()> {
    // Validate before any side effect/tool execution. Final answers need no further replay.
    if has_tools && reasoning_required(config, options) {
        validate_replay(message)?;
    }
    Ok(())
}
