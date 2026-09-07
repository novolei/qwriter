//! Opt-in native integration check. Never runs in normal tests or CI.
//! Inject QWRITER_LIVE_DEEPSEEK_KEY into this process only; never save it in a file.
use super::{types::*, *};

#[tokio::test]
#[ignore = "requires explicit authorization and a temporary DeepSeek API key"]
async fn deepseek_live_writing_flow() -> AppResult<()> {
    let key = std::env::var("QWRITER_LIVE_DEEPSEEK_KEY")
        .map_err(|_| AppError::Validation("Temporary test credential is required".into()))?;
    let mut config = ModelConfig {
        base_url: "https://api.deepseek.com/v1".into(),
        api_key: key,
        model: String::new(),
        protocol: "openai".into(),
    };
    let discovered = crate::services::provider::connection::discover(config.clone()).await?;
    let ids: Vec<_> = discovered.data.iter().map(|m| m.id.as_str()).collect();
    println!(
        "LIVE model discovery: {:?}; elapsed {} ms",
        ids, discovered.elapsed_ms
    );
    config.model = ["deepseek-v4-flash", "deepseek-chat"]
        .into_iter()
        .find(|id| ids.contains(id))
        .ok_or_else(|| {
            AppError::Validation("No known economical DeepSeek model is available".into())
        })?
        .into();
    let verified = verification::verify(config.clone()).await?;
    assert!(
        verified.tools_supported,
        "Real tool round trip was not verified"
    );
    println!(
        "LIVE connection verification: tools=true; elapsed {} ms",
        verified.elapsed_ms
    );
    let output = run(config, AgentInput {
        instruction: "先搜索与雨后有关的参考文稿，再阅读原文，将其写成一篇不超过 150 字、包含二级标题的中文散文。保留原文的纸船意象，以 propose_draft 返回草稿。".into(),
        notes: vec![AgentNote { id: "test-rain".into(), title: "雨后的窗台".into(), markdown: "雨停后，窗台上停着一只蓝色纸船。叶尖有一滴水，折射着晚霞。屋里还留着热茶的香气。".into() }],
        language: "zh-CN".into(),
    }, CancellationToken::new(), |event| {
        match event {
            AgentEvent::Tool { name, success, .. } => println!("LIVE tool: {name}; success={success}"),
            AgentEvent::Thinking { round } => println!("LIVE round: {round}"),
            AgentEvent::Started => println!("LIVE writing task started"),
        }
        Ok(())
    }).await?;
    assert!(matches!(output.status, AgentStatus::Complete));
    assert!(output.read_ids.iter().any(|id| id == "test-rain"));
    let draft = output
        .draft
        .ok_or_else(|| AppError::Validation("No draft returned".into()))?;
    assert!(draft.markdown.contains("纸船"));
    assert!(draft.markdown.contains("## "));
    println!(
        "LIVE draft verified: {} characters; {} rounds; source read=true",
        draft.markdown.chars().count(),
        output.rounds
    );
    Ok(())
}
