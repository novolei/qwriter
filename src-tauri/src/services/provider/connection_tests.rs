use super::{connection::*, tests::mock, ModelConfig};

fn config(base: String) -> ModelConfig {
    ModelConfig {
        base_url: base,
        api_key: "test-key".into(),
        model: String::new(),
        protocol: "openai".into(),
    }
}
#[test]
fn discovery_deduplicates_and_sorts_without_requiring_a_model() {
    let (base, server) = mock(
        r#"{"data":[{"id":"z"},{"id":"a"},{"id":"a"},{"id":""},{}]}"#,
        "200 OK",
    );
    let result = tauri::async_runtime::block_on(discover(config(base))).unwrap();
    assert_eq!(
        result
            .data
            .iter()
            .map(|m| m.id.as_str())
            .collect::<Vec<_>>(),
        vec!["a", "z"]
    );
    assert!(server.join().unwrap().contains("Bearer test-key"));
}
#[test]
fn distinguishes_empty_catalog_from_malformed_success_body() {
    let (base, server) = mock(r#"{"data":[]}"#, "200 OK");
    assert!(tauri::async_runtime::block_on(discover(config(base)))
        .unwrap()
        .data
        .is_empty());
    server.join().unwrap();
    let (base, server) = mock(r#"{"message":"test-key"}"#, "200 OK");
    let error = tauri::async_runtime::block_on(discover(config(base)))
        .unwrap_err()
        .to_string();
    assert!(error.contains("模型列表"));
    assert!(!error.contains("test-key"));
    server.join().unwrap();
}
#[test]
fn errors_distinguish_auth_quota_and_rate_limits_without_echoing_provider_body() {
    for (status, expected) in [
        ("401 Unauthorized", "API Key"),
        ("402 Payment Required", "余额"),
        ("429 Too Many Requests", "配额"),
        ("302 Found", "重定向"),
    ] {
        let (base, server) = mock(r#"{"error":"test-key should never be displayed"}"#, status);
        let error = tauri::async_runtime::block_on(discover(config(base)))
            .unwrap_err()
            .to_string();
        assert!(error.contains(expected));
        assert!(!error.contains("test-key"));
        server.join().unwrap();
    }
}
