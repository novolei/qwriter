use super::*;
use serde_json::{json, Value};
use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
    time::Instant,
};

fn config(base_url: String, protocol: &str) -> ModelConfig {
    ModelConfig {
        base_url,
        api_key: "test-only-secret".into(),
        model: "test-model".into(),
        protocol: protocol.into(),
    }
}
fn input() -> AgentInput {
    AgentInput {
        instruction: "Write a short story from the attached note".into(),
        language: "en".into(),
        harness: None,
        notes: vec![types::AgentNote {
            id: "note-1".into(),
            title: "Garden".into(),
            markdown: "Private reference: a quiet garden.".into(),
        }],
    }
}
fn call(name: &str, args: Value) -> Value {
    json!({"choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","content":null,"reasoning_content":"","tool_calls":[{"id":"call_1","type":"function","function":{"name":name,"arguments":args.to_string()}}]}}]})
}
fn server(responses: Vec<Value>) -> (String, thread::JoinHandle<Vec<Value>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    (
        url,
        thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(20);
            let mut received = vec![];
            for response in responses {
                let mut stream = loop {
                    match listener.accept() {
                        Ok((stream, _)) => break stream,
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            assert!(Instant::now() < deadline, "mock request timed out");
                            thread::sleep(Duration::from_millis(5));
                        }
                        Err(e) => panic!("{e}"),
                    }
                };
                // Windows can inherit the listener's nonblocking mode on accepted sockets.
                stream.set_nonblocking(false).unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut bytes = Vec::new();
                let mut buffer = [0; 4096];
                loop {
                    let n = stream.read(&mut buffer).unwrap();
                    assert_ne!(n, 0);
                    bytes.extend_from_slice(&buffer[..n]);
                    if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                        let length = String::from_utf8_lossy(&bytes[..end])
                            .lines()
                            .find_map(|line| {
                                line.to_lowercase()
                                    .strip_prefix("content-length:")
                                    .and_then(|v| v.trim().parse::<usize>().ok())
                            })
                            .unwrap_or(0);
                        if bytes.len() >= end + 4 + length {
                            received.push(
                                serde_json::from_slice(&bytes[end + 4..end + 4 + length]).unwrap(),
                            );
                            break;
                        }
                    }
                }
                let body = response.to_string();
                write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
            }
            received
        }),
    )
}

#[test]
fn tools_cannot_read_unattached_documents_or_execute_commands() {
    let notes = input().notes;
    assert!(!tools::execute("read_document", &json!({"id":"../private"}), &notes).success);
    assert!(!tools::execute("shell", &json!({"command":"whoami"}), &notes).success);
    assert!(!tools::execute("propose_draft", &json!({"markdown":""}), &notes).success);
    let result = tools::execute("search_documents", &json!({"query":"GARDEN"}), &notes);
    assert_eq!(result.value["matches"][0]["id"], "note-1");
}

#[test]
fn reference_limits_and_request_guards_are_enforced() {
    let mut data = input();
    data.notes.push(data.notes[0].clone());
    assert!(validate(&data, &config("http://localhost".into(), "openai")).is_err());
    let requests = AgentRequests::default();
    let (token, guard) = requests.register("one").unwrap();
    assert!(requests.register("one").is_err());
    requests.cancel("one").unwrap();
    assert!(token.is_cancelled());
    drop(guard);
    assert!(requests.register("one").is_ok());
}

#[test]
fn openai_agent_reads_then_proposes_without_writing() {
    let (url, server) = server(vec![
        call("search_documents", json!({"query":"garden"})),
        call("read_document", json!({"id":"note-1"})),
        call(
            "propose_draft",
            json!({"title":"Morning","markdown":"# Morning\n\nThe garden was quiet.","summary":"A short scene."}),
        ),
    ]);
    let events = Mutex::new(Vec::new());
    let result = tauri::async_runtime::block_on(run(
        config(url, "openai"),
        input(),
        CancellationToken::new(),
        |event| {
            events.lock().unwrap().push(event);
            Ok(())
        },
    ))
    .unwrap();
    assert!(matches!(result.status, AgentStatus::Complete));
    assert_eq!(result.read_ids, vec!["note-1"]);
    assert_eq!(result.rounds, 3);
    assert_eq!(result.draft.unwrap().title, "Morning");
    let requests = server.join().unwrap();
    assert!(!requests[0].to_string().contains("Private reference"));
    assert!(requests[2].to_string().contains("Private reference"));
    assert_eq!(requests[1]["messages"][3]["role"], "tool");
    assert_eq!(
        events
            .lock()
            .unwrap()
            .iter()
            .filter(|e| matches!(e, AgentEvent::Tool { .. }))
            .count(),
        3
    );
}

#[test]
fn anthropic_tool_results_immediately_follow_their_tool_uses() {
    let (url, server) = server(vec![
        json!({"stop_reason":"tool_use","content":[{"type":"tool_use","id":"tool_1","name":"read_document","input":{"id":"note-1"}}]}),
        json!({"stop_reason":"end_turn","content":[{"type":"text","text":"The reference describes a garden."}]}),
    ]);
    let result = tauri::async_runtime::block_on(run(
        config(url, "anthropic"),
        input(),
        CancellationToken::new(),
        |_| Ok(()),
    ))
    .unwrap();
    assert!(matches!(result.status, AgentStatus::Complete));
    let requests = server.join().unwrap();
    assert_eq!(
        requests[1]["messages"][2]["content"][0]["tool_use_id"],
        "tool_1"
    );
    assert_eq!(requests[1]["messages"][2]["role"], "user");
    assert_eq!(requests[0]["tools"][0]["input_schema"]["type"], "object");
}

#[test]
fn cancellation_and_turn_budget_cannot_produce_applicable_drafts() {
    let token = CancellationToken::new();
    token.cancel();
    let result = tauri::async_runtime::block_on(run(
        config("http://127.0.0.1:1".into(), "openai"),
        input(),
        token,
        |_| Ok(()),
    ))
    .unwrap();
    assert!(matches!(result.status, AgentStatus::Cancelled));
    assert!(result.draft.is_none());
    let (url, server) = server(vec![call("read_document", json!({"id":"missing"})); 6]);
    let result = tauri::async_runtime::block_on(run(
        config(url, "openai"),
        input(),
        CancellationToken::new(),
        |_| Ok(()),
    ))
    .unwrap();
    assert!(matches!(result.status, AgentStatus::Limit));
    assert!(result.draft.is_none());
    assert_eq!(server.join().unwrap().len(), 6);
}

#[test]
fn rejects_truncation_and_malformed_tool_arguments() {
    assert!(transport::parse(json!({"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"A normal response","tool_calls":null}}]}),false).is_ok());
    assert!(transport::parse(json!({"choices":[{"finish_reason":"length","message":{"role":"assistant","content":"partial"}}]}),false).is_err());
    let mut response = call("read_document", json!({"id":"note-1"}));
    response["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"] = json!("not JSON");
    assert!(transport::parse(response, false).is_err());
}

#[test]
fn harness_preserves_reasoning_and_preferences_before_proposing() {
    let mut first = call(
        "update_plan",
        json!({"steps":["Read preferences", "Draft"]}),
    );
    first["choices"][0]["message"]["reasoning_content"] = json!("opaque provider state");
    let (url, server) = server(vec![
        first,
        call(
            "propose_memory",
            json!({"title":"Tone","content":"Use concrete short sentences.","kind":"preference","source":"User request"}),
        ),
        call(
            "propose_draft",
            json!({"title":"Draft","markdown":"A concise draft.","summary":"Used the saved preference."}),
        ),
    ]);
    let mut input = input();
    input.harness = Some(options::HarnessOptions {
        memory_enabled: true,
        thinking: options::ThinkingMode::On,
        capabilities: options::ModelCapabilities {
            reasoning: options::ReasoningAdapter::Deepseek,
            ..Default::default()
        },
        ..Default::default()
    });
    let memory = crate::services::knowledge::MemoryEntry {
        id: "m1".into(),
        title: "Style".into(),
        content: "Keep it concise".into(),
        kind: "preference".into(),
        document_id: String::new(),
        source: "User".into(),
        archived: false,
        revision: 1,
        updated_at: 1,
    };
    let output = tauri::async_runtime::block_on(run_with_context(
        config(url, "openai"),
        input,
        CancellationToken::new(),
        context::RunContext {
            images: vec![],
            memories: vec![memory],
            retriever: None,
        },
        |_| Ok(()),
    ))
    .unwrap();
    assert_eq!(output.memories.len(), 1);
    assert_eq!(output.memory_read_ids, vec!["m1"]);
    assert!(output.draft.is_some());
    let requests = server.join().unwrap();
    assert_eq!(requests[0]["thinking"]["type"], "enabled");
    assert_eq!(
        requests[1]["messages"][2]["reasoning_content"],
        "opaque provider state"
    );
    assert!(requests[0]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v["function"]["name"] == "propose_memory"));
}

#[test]
fn images_use_correct_provider_blocks_and_unknown_capabilities_fail_closed() {
    let mut input = input();
    input.harness = Some(options::HarnessOptions {
        image_ids: vec!["example.png".into()],
        ..Default::default()
    });
    assert!(validate(&input, &config("http://localhost:1".into(), "openai")).is_err());
    let context = context::RunContext {
        images: vec!["jpeg-base64".into()],
        memories: vec![],
        retriever: None,
    };
    let openai = context::first_message(&input, &context, false);
    let anthropic = context::first_message(&input, &context, true);
    assert_eq!(
        openai["content"][1]["image_url"]["url"],
        "data:image/jpeg;base64,jpeg-base64"
    );
    assert_eq!(
        anthropic["content"][1]["source"]["media_type"],
        "image/jpeg"
    );
    assert!(!harness_tools::definitions(false)
        .iter()
        .any(|d| d["name"] == "search_memory"));
}

#[test]
fn context_compaction_preserves_protocol_pairs_and_recent_evidence() {
    let mut messages = vec![
        json!({"role":"user","content":"Goal"}),
        json!({"role":"assistant","tool_calls":[{"id":"a"}],"reasoning_content":"opaque"}),
        json!({"role":"tool","name":"read_document","tool_call_id":"a","content":"x".repeat(30000)}),
        json!({"role":"assistant","tool_calls":[{"id":"b"}]}),
        json!({"role":"tool","name":"read_document","tool_call_id":"b","content":"Recent evidence"}),
    ];
    let (tokens, compacted) = context::fit(&mut messages, 2000);
    assert!(compacted && tokens < 2000);
    assert_eq!(messages[1]["reasoning_content"], "opaque");
    assert_eq!(messages[2]["tool_call_id"], "a");
    assert_eq!(messages[4]["content"], "Recent evidence");
    let doc = types::AgentNote {
        id: "long".into(),
        title: "Long".into(),
        markdown: "文".repeat(9000),
    };
    let page = tools::execute("read_document", &json!({"id":"long","offset":4000}), &[doc]);
    assert_eq!(page.value["nextOffset"], 8000);
    assert_eq!(
        page.value["markdown"].as_str().unwrap().chars().count(),
        4000
    );
}

#[test]
fn thinking_adapters_do_not_leak_parameters_across_protocols() {
    use options::*;
    let mut settings = HarnessOptions {
        thinking: ThinkingMode::On,
        ..Default::default()
    };
    settings.capabilities.reasoning = ReasoningAdapter::Anthropic;
    assert!(settings.validate("openai").is_err());
    assert!(settings.validate("anthropic").is_ok());
    let mut payload = json!({});
    settings.apply_reasoning(&mut payload);
    assert_eq!(payload["thinking"]["budget_tokens"], 4096);
    settings.capabilities.reasoning = ReasoningAdapter::AnthropicAdaptive;
    let mut payload = json!({});
    settings.apply_reasoning(&mut payload);
    assert_eq!(payload["thinking"]["type"], "adaptive");
    assert_eq!(payload["output_config"]["effort"], "medium");
    settings.capabilities.reasoning = ReasoningAdapter::Deepseek;
    settings.thinking = ThinkingMode::Off;
    let mut payload = json!({});
    settings.apply_reasoning(&mut payload);
    assert!(payload.get("reasoning_effort").is_none());
    settings.thinking = ThinkingMode::Auto;
    let mut payload = json!({});
    settings.apply_reasoning(&mut payload);
    assert_eq!(payload, json!({}));
}

#[test]
fn local_image_preparation_and_large_image_followup_work() {
    use base64::Engine;
    let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
    std::fs::create_dir_all(&root).unwrap();
    let source = root.join("source.png");
    image::RgbImage::from_pixel(2000, 1000, image::Rgb([40, 90, 55]))
        .save(&source)
        .unwrap();
    let asset = crate::services::capture::assets::import_file(&root, &source, "fixture").unwrap();
    let mut opts = options::HarnessOptions {
        image_ids: vec![asset.id],
        ..Default::default()
    };
    opts.capabilities.vision = options::CapabilitySupport::Supported;
    let mut prepared = context::prepare(&root, &opts).unwrap();
    let data = base64::engine::general_purpose::STANDARD
        .decode(&prepared.images[0])
        .unwrap();
    let decoded = image::load_from_memory(&data).unwrap();
    assert_eq!((decoded.width(), decoded.height()), (1600, 800));
    assert_eq!(image::open(&source).unwrap().width(), 2000);
    // Large encoded payloads must not consume the text budget or stop a tool follow-up.
    prepared.images = vec!["A".repeat(2 * 1024 * 1024 + 1024)];
    let mut input = input();
    input.harness = Some(opts);
    let (url, server) = server(vec![
        call("read_document", json!({"id":"note-1"})),
        call(
            "propose_draft",
            json!({"title":"Image note","markdown":"A green reference.","summary":"Based on the attachment."}),
        ),
    ]);
    let result = tauri::async_runtime::block_on(run_with_context(
        config(url, "openai"),
        input,
        CancellationToken::new(),
        prepared,
        |_| Ok(()),
    ))
    .unwrap();
    assert!(result.draft.is_some());
    assert_eq!(server.join().unwrap().len(), 2);
    std::fs::remove_dir_all(root).unwrap();
}

mod provider_policy;
mod retrieval;
