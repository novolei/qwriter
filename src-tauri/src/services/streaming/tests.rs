use super::*;
fn config(base: String) -> ModelConfig {
    ModelConfig {
        base_url: base,
        api_key: String::new(),
        model: "test".into(),
        protocol: "openai".into(),
    }
}
#[test]
fn real_http_stream_delivers_deltas_and_rejects_truncation() {
    let (base, server) = crate::services::provider::tests::mock(
        "data: {\"choices\":[{\"delta\":{\"content\":\"你好\"}}]}\n\ndata: [DONE]\n\n",
        "200 OK",
    );
    let received = std::sync::Arc::new(Mutex::new(Vec::new()));
    let copy = received.clone();
    let channel = Channel::new(move |body| {
        copy.lock().unwrap().push(body);
        Ok(())
    });
    assert!(tauri::async_runtime::block_on(generate(
        config(base),
        "润色".into(),
        "原文".into(),
        channel
    ))
    .is_ok());
    assert_eq!(received.lock().unwrap().len(), 1);
    let request = server.join().unwrap();
    assert!(request.contains("\"stream\":true"));
    let (base, server) = crate::services::provider::tests::mock(
        "data: {\"choices\":[{\"delta\":{\"content\":\"不完整\"}}]}\n\n",
        "200 OK",
    );
    let result = tauri::async_runtime::block_on(generate(
        config(base),
        String::new(),
        String::new(),
        Channel::new(|_| Ok(())),
    ));
    assert!(result.unwrap_err().contains("提前结束"));
    server.join().unwrap();
}
#[test]
fn cancelling_a_stalled_request_closes_the_socket() {
    use std::{io::Read, net::TcpListener, thread};
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let token = CancellationToken::new();
    let server_token = token.clone();
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let mut buf = [0; 8192];
        assert!(stream.read(&mut buf).unwrap() > 0);
        server_token.cancel();
        // Buffered request bytes can still arrive; EOF must follow without a response.
        loop {
            match stream.read(&mut buf) {
                Ok(0) => return true,
                Ok(_) => continue,
                Err(e) => return e.kind() == std::io::ErrorKind::ConnectionReset,
            }
        }
    });
    let status = tauri::async_runtime::block_on(run_cancellable(
        token,
        config(base),
        String::new(),
        String::new(),
        Channel::new(|_| Ok(())),
    ))
    .unwrap();
    assert_eq!(status, "cancelled");
    assert!(server.join().unwrap());
}
#[test]
fn unicode_and_crlf_can_split_at_every_byte() {
    let bytes="event: delta\r\ndata: {\"choices\":[{\"delta\":{\"content\":\"中文🌿\"}}]}\r\n\r\ndata: [DONE]\n\n".as_bytes();
    let mut decoder = SseDecoder::default();
    let mut events = Vec::new();
    for byte in bytes {
        events.extend(decoder.push(&[*byte]).unwrap());
    }
    assert_eq!(events.len(), 2);
    assert_eq!(delta(&events[0], "openai").unwrap().0.unwrap(), "中文🌿");
    assert!(delta(&events[1], "openai").unwrap().1);
}
#[test]
fn anthropic_events_and_error_do_not_leak_provider_details() {
    assert_eq!(
        delta(
            r#"{"type":"content_block_delta","delta":{"text":"你好"}}"#,
            "anthropic"
        )
        .unwrap()
        .0
        .unwrap(),
        "你好"
    );
    assert!(delta(r#"{"type":"message_stop"}"#, "anthropic").unwrap().1);
    assert!(!delta(r#"{"error":{"message":"SECRET"}}"#, "openai")
        .unwrap_err()
        .contains("SECRET"));
}
