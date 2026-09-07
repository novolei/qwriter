use super::*;
use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
};

pub(crate) fn mock(
    body: &'static str,
    status: &'static str,
) -> (String, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(10)))
            .unwrap();
        let mut data = Vec::new();
        let mut buffer = [0; 4096];
        loop {
            let n = stream.read(&mut buffer).unwrap();
            if n == 0 {
                break;
            }
            data.extend_from_slice(&buffer[..n]);
            if let Some(end) = data.windows(4).position(|w| w == b"\r\n\r\n") {
                let headers = String::from_utf8_lossy(&data[..end]);
                let length = headers
                    .lines()
                    .find_map(|l| {
                        l.to_ascii_lowercase()
                            .strip_prefix("content-length:")
                            .and_then(|v| v.trim().parse::<usize>().ok())
                    })
                    .unwrap_or(0);
                if data.len() >= end + 4 + length {
                    break;
                }
            }
        }
        write!(stream, "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", status, body.len(), body).unwrap();
        String::from_utf8(data).unwrap()
    });
    (base, handle)
}

#[test]
fn validates_endpoint() {
    assert_eq!(
        endpoint("http://localhost:11434/v1/", "models").unwrap(),
        "http://localhost:11434/v1/models"
    );
    for bad in [
        "file:///tmp/test",
        "https://key:secret@example.com",
        "https://example.com?key=secret",
    ] {
        assert!(endpoint(bad, "models").is_err());
    }
}

#[test]
fn openai_request_and_text_response() {
    let (base, server) = mock(
        r#"{"choices":[{"message":{"content":"修改建议"}}]}"#,
        "200 OK",
    );
    let output = tauri::async_runtime::block_on(ai_complete(
        ModelConfig {
            base_url: format!("{}/v1", base),
            api_key: "test-secret".into(),
            model: "test-model".into(),
            protocol: "openai".into(),
        },
        "润色".into(),
        "原文".into(),
    ))
    .unwrap();
    assert_eq!(output, "修改建议");
    let request = server.join().unwrap();
    assert!(request.starts_with("POST /v1/chat/completions"));
    assert!(request.contains("Bearer test-secret"));
    assert!(request.contains("原文"));
}

#[test]
fn anthropic_request_and_blocks() {
    let (base, server) = mock(
        r#"{"content":[{"type":"text","text":"第一段"},{"type":"text","text":"第二段"}]}"#,
        "200 OK",
    );
    let output = tauri::async_runtime::block_on(ai_complete(
        ModelConfig {
            base_url: base,
            api_key: "test-secret".into(),
            model: "test-model".into(),
            protocol: "anthropic".into(),
        },
        "润色".into(),
        "原文".into(),
    ))
    .unwrap();
    assert_eq!(output, "第一段\n第二段");
    let request = server.join().unwrap();
    assert!(request.starts_with("POST /messages"));
    assert!(request.contains("anthropic-version: 2023-06-01"));
}

#[test]
fn comfy_prompt_envelope() {
    let (base, server) = mock(r#"{"prompt_id":"job-123"}"#, "200 OK");
    let output = tauri::async_runtime::block_on(comfy_request(
        base,
        Some(json!({"1":{"class_type":"KSampler","inputs":{}}})),
        None,
    ))
    .unwrap();
    assert_eq!(output["prompt_id"], "job-123");
    let request = server.join().unwrap();
    assert!(request.starts_with("POST /prompt"));
    assert!(request.contains(r#""prompt":{"1""#));
}

#[test]
fn service_error_does_not_echo_body_or_key() {
    let (base, server) = mock(r#"{"error":"test-secret"}"#, "401 Unauthorized");
    let error = tauri::async_runtime::block_on(connection::discover(ModelConfig {
        base_url: base,
        api_key: "test-secret".into(),
        model: "test".into(),
        protocol: "openai".into(),
    }))
    .unwrap_err()
    .to_string();
    assert!(error.contains("API Key"));
    assert!(!error.contains("test-secret"));
    server.join().unwrap();
}
