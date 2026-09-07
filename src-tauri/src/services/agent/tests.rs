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
        notes: vec![types::AgentNote {
            id: "note-1".into(),
            title: "Garden".into(),
            markdown: "Private reference: a quiet garden.".into(),
        }],
    }
}
fn call(name: &str, args: Value) -> Value {
    json!({"choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_1","type":"function","function":{"name":name,"arguments":args.to_string()}}]}}]})
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
    assert_eq!(events.lock().unwrap().len(), 7);
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
