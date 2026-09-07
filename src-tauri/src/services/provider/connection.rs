use super::{endpoint, ModelConfig};
use crate::error::{AppError, AppResult};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeSet,
    time::{Duration, Instant},
};

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct ModelSummary {
    pub id: String,
}
#[derive(Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ModelList {
    pub data: Vec<ModelSummary>,
    pub elapsed_ms: u32,
}

pub fn validate(config: &ModelConfig) -> AppResult<()> {
    endpoint(&config.base_url, "models").map_err(AppError::Validation)?;
    if !["openai", "anthropic"].contains(&config.protocol.as_str()) {
        return Err(AppError::Validation("不支持的模型协议".into()));
    }
    if config.api_key.len() > 8192 || config.api_key.chars().any(char::is_control) {
        return Err(AppError::Validation(
            "API Key 格式不正确，请重新粘贴".into(),
        ));
    }
    Ok(())
}

pub fn http_error(status: reqwest::StatusCode) -> AppError {
    AppError::Network(
        match status.as_u16() {
            401 => "API Key 无效或已失效，请重新填写后重试",
            402 => "账户余额不足，请在服务商账户中检查余额",
            403 => "当前密钥没有访问权限，请检查服务商的授权设置",
            404 => "未找到接口或模型，请检查服务地址；也可手动填写模型 ID 后验证",
            408 | 504 => "服务响应超时，请稍后重试或选择更快的模型",
            429 => "请求过于频繁或额度已用尽，请稍后重试并检查服务配额",
            500..=599 => "模型服务暂时不可用，请稍后重试",
            300..=399 => "服务地址发生重定向，请填写最终的 API 地址后重试",
            _ => "服务拒绝了请求，请检查协议、模型及服务商支持的功能",
        }
        .into(),
    )
}

pub async fn json_response(request: reqwest::RequestBuilder) -> AppResult<Value> {
    let response = request.send().await.map_err(|error| {
        if error.is_timeout() {
            AppError::Network("服务响应超时，请稍后重试或选择更快的模型".into())
        } else {
            AppError::Network("无法连接服务，请检查地址、网络或本地模型是否启动".into())
        }
    })?;
    if !response.status().is_success() {
        return Err(http_error(response.status()));
    }
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        if bytes.len() + chunk.len() > 2 * 1024 * 1024 {
            return Err(AppError::Network("服务响应过大，已停止接收".into()));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(serde_json::from_slice(&bytes)?)
}

pub async fn discover(config: ModelConfig) -> AppResult<ModelList> {
    validate(&config)?;
    let started = Instant::now();
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()?;
    let url = endpoint(&config.base_url, "models").map_err(AppError::Validation)?;
    let mut request = client.get(url);
    if config.protocol == "anthropic" {
        request = request
            .header("x-api-key", &config.api_key)
            .header("anthropic-version", "2023-06-01");
    } else if !config.api_key.is_empty() {
        request = request.bearer_auth(&config.api_key);
    }
    let value = json_response(request).await?;
    let items = value["data"]
        .as_array()
        .ok_or_else(|| AppError::Network("服务未返回模型列表，可手动填写模型 ID 后验证".into()))?;
    let ids: BTreeSet<_> = items
        .iter()
        .filter_map(|v| v["id"].as_str())
        .filter(|id| !id.trim().is_empty() && id.len() <= 512)
        .collect();
    if !items.is_empty() && ids.is_empty() {
        return Err(AppError::Network(
            "服务未返回模型列表，可手动填写模型 ID 后验证".into(),
        ));
    }
    Ok(ModelList {
        data: ids
            .into_iter()
            .take(2000)
            .map(|id| ModelSummary { id: id.into() })
            .collect(),
        elapsed_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
    })
}
