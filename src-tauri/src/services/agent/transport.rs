use super::tools;
use crate::{
    error::{AppError, AppResult},
    services::provider::{endpoint, ModelConfig},
};
use futures_util::StreamExt;
use serde_json::{json, Value};

pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}
pub struct Turn {
    pub message: Value,
    pub text: String,
    pub calls: Vec<ToolCall>,
}

pub fn body(config: &ModelConfig, system: &str, messages: &[Value]) -> Value {
    let definitions = tools::definitions();
    if config.protocol == "anthropic" {
        let tools: Vec<Value> = definitions.iter().map(|d| json!({"name":d["name"],"description":d["description"],"input_schema":d["parameters"]})).collect();
        json!({"model":config.model,"max_tokens":8192,"system":system,"messages":messages,"tools":tools})
    } else {
        let mut history = vec![json!({"role":"system","content":system})];
        history.extend_from_slice(messages);
        let tools: Vec<Value> = definitions
            .iter()
            .map(|d| json!({"type":"function","function":d}))
            .collect();
        json!({"model":config.model,"stream":false,"messages":history,"tools":tools})
    }
}

fn invalid() -> AppError {
    AppError::Network("Agent 响应格式无效，请确认模型支持工具调用".into())
}

pub fn parse(value: Value, anthropic: bool) -> AppResult<Turn> {
    let mut calls = Vec::new();
    let (message, text) = if anthropic {
        if !matches!(value["stop_reason"].as_str(), Some("end_turn" | "tool_use")) {
            return Err(AppError::Network(
                "Agent 输出未完成，请缩短任务后重试".into(),
            ));
        }
        let blocks = value["content"].as_array().ok_or_else(invalid)?;
        let mut text = String::new();
        for block in blocks {
            if block["type"] == "text" {
                text.push_str(block["text"].as_str().unwrap_or(""));
            }
            if block["type"] == "tool_use" {
                calls.push(ToolCall {
                    id: block["id"].as_str().ok_or_else(invalid)?.into(),
                    name: block["name"].as_str().ok_or_else(invalid)?.into(),
                    arguments: block["input"].clone(),
                });
            }
        }
        (json!({"role":"assistant","content":blocks}), text)
    } else {
        let choice = &value["choices"][0];
        if !matches!(
            choice["finish_reason"].as_str(),
            Some("stop" | "tool_calls")
        ) {
            return Err(AppError::Network(
                "Agent 输出未完成，请缩短任务后重试".into(),
            ));
        }
        let message = choice["message"].clone();
        if message["role"] != "assistant" {
            return Err(invalid());
        }
        if let Some(items) = message.get("tool_calls").filter(|value| !value.is_null()) {
            for call in items.as_array().ok_or_else(invalid)? {
                if call["type"] != "function" {
                    return Err(invalid());
                }
                let arguments = call["function"]["arguments"].as_str().ok_or_else(invalid)?;
                calls.push(ToolCall {
                    id: call["id"].as_str().ok_or_else(invalid)?.into(),
                    name: call["function"]["name"]
                        .as_str()
                        .ok_or_else(invalid)?
                        .into(),
                    arguments: serde_json::from_str(arguments).map_err(|_| invalid())?,
                });
            }
        }
        let text = message["content"].as_str().unwrap_or("").to_owned();
        (message, text)
    };
    let mut ids = std::collections::HashSet::new();
    if calls.len() > 8
        || calls.iter().any(|c| {
            c.id.is_empty() || c.id.len() > 256 || c.name.len() > 100 || !ids.insert(&c.id)
        })
        || (calls.is_empty() && text.trim().is_empty())
    {
        return Err(invalid());
    }
    Ok(Turn {
        message,
        text,
        calls,
    })
}

pub fn tool_reply(id: &str, name: &str, value: Value, success: bool, anthropic: bool) -> Value {
    if anthropic {
        json!({"type":"tool_result","tool_use_id":id,"content":value.to_string(),"is_error":!success})
    } else {
        json!({"role":"tool","tool_call_id":id,"name":name,"content":value.to_string()})
    }
}

pub async fn request_with_options(
    client: &reqwest::Client,
    config: &ModelConfig,
    system: &str,
    messages: &[Value],
    options: &super::options::HarnessOptions,
) -> AppResult<Turn> {
    let anthropic = config.protocol == "anthropic";
    let url = endpoint(
        &config.base_url,
        if anthropic {
            "messages"
        } else {
            "chat/completions"
        },
    )
    .map_err(AppError::Validation)?;
    let mut payload = body(config, system, messages);
    let extra = super::harness_tools::definitions(options.memory_enabled);
    if let Some(tools) = payload["tools"].as_array_mut() {
        tools.extend(extra.iter().map(|d| if anthropic { json!({"name":d["name"],"description":d["description"],"input_schema":d["parameters"]}) } else { json!({"type":"function","function":d}) }));
    }
    options.apply_reasoning(&mut payload);
    let mut request = client.post(url).json(&payload);
    if anthropic {
        request = request
            .header("x-api-key", &config.api_key)
            .header("anthropic-version", "2023-06-01");
    } else if !config.api_key.is_empty() {
        request = request.bearer_auth(&config.api_key);
    }
    let response = request.send().await?;
    if !response.status().is_success() {
        return Err(crate::services::provider::connection::http_error(
            response.status(),
        ));
    }
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        if bytes.len() + chunk.len() > 2 * 1024 * 1024 {
            return Err(AppError::Network("Agent 响应超过 2 MB，已停止接收".into()));
        }
        bytes.extend_from_slice(&chunk);
    }
    parse(
        serde_json::from_slice(&bytes).map_err(|_| invalid())?,
        anthropic,
    )
}
