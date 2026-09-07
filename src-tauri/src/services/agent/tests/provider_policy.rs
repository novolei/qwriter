use super::*;
use options::{HarnessOptions, ReasoningAdapter, ThinkingEffort, ThinkingMode};

fn settings() -> HarnessOptions {
    let mut options = HarnessOptions {
        thinking: ThinkingMode::On,
        ..Default::default()
    };
    options.capabilities.reasoning = ReasoningAdapter::Deepseek;
    options
}

#[test]
fn deepseek_replay_fails_closed_and_preserves_real_empty_or_opaque_content() {
    let config = config("http://localhost:1".into(), "openai");
    let options = settings();
    let missing = json!({"role":"assistant","content":null,"tool_calls":[{"id":"1"}]});
    assert!(
        transport::payload(&config, "System", std::slice::from_ref(&missing), &options).is_err()
    );
    assert!(
        super::super::provider_policy::validate_turn(&missing, true, &config, &options).is_err()
    );
    for reasoning in ["", "opaque provider continuation"] {
        let mut message = missing.clone();
        message["reasoning_content"] = json!(reasoning);
        let body = transport::payload(&config, "System", &[message.clone()], &options).unwrap();
        assert_eq!(body["messages"][1]["reasoning_content"], reasoning);
        assert_eq!(body["messages"][1]["content"], "");
        assert!(message["content"].is_null()); // persisted/original history is not mutated
    }
}

#[test]
fn explicit_effort_and_output_budget_are_independent() {
    let config = config("http://localhost:1".into(), "openai");
    let mut options = settings();
    options.capabilities.context_window = 16384;
    for (effort, expected) in [
        (ThinkingEffort::Low, "low"),
        (ThinkingEffort::Medium, "high"),
        (ThinkingEffort::High, "high"),
        (ThinkingEffort::Max, "max"),
    ] {
        options.effort = effort;
        let body = transport::payload(&config, "System", &[], &options).unwrap();
        assert_eq!(body["reasoning_effort"], expected);
        assert_eq!(body["max_tokens"], 8192);
        assert!(body.get("tool_choice").is_none());
    }
    options.thinking = ThinkingMode::Off;
    let body = transport::payload(
        &config,
        "System",
        &[json!({"role":"assistant","content":"Answer","reasoning_content":"opaque"})],
        &options,
    )
    .unwrap();
    assert_eq!(body["thinking"]["type"], "disabled");
    assert!(body["messages"][1].get("reasoning_content").is_none());
    assert!(body.get("reasoning_effort").is_none());
}

#[test]
fn official_host_is_matched_exactly_and_other_providers_are_untouched() {
    let options = HarnessOptions::default();
    let mut config = config("https://api.deepseek.com/v1".into(), "openai");
    config.model = "deepseek-v4-flash".into();
    let body = transport::payload(&config, "System", &[], &options).unwrap();
    assert_eq!(body["max_tokens"], 16384);
    assert!(body.get("thinking").is_none()); // Auto preserves the service default
    config.base_url = "https://api.deepseek.com.example.org".into();
    let body = transport::payload(&config, "System", &[], &options).unwrap();
    assert_eq!(body["max_tokens"], 8192);
}
