use super::{
    context::RunContext,
    types::{AgentEvent, AgentOutput},
};
use serde_json::{json, Value};

pub async fn execute(
    name: &str,
    args: &Value,
    context: &RunContext,
    output: &mut AgentOutput,
    enabled: bool,
) -> Option<(Value, AgentEvent)> {
    if !enabled || !["search_memory", "read_memory"].contains(&name) {
        return None;
    }
    let event = |detail: String, success| AgentEvent::Tool {
        name: name.into(),
        detail,
        success,
    };
    let failure = || {
        Some((
            json!({"error":"Source unavailable or changed. Search again for current in-scope chunks; do not invent missing evidence."}),
            event(String::new(), false),
        ))
    };
    let Some(retriever) = &context.retriever else {
        return failure();
    };
    let (key, limit) = if name == "search_memory" {
        ("query", 300)
    } else {
        ("id", 150)
    };
    let Some(argument) = args[key]
        .as_str()
        .filter(|s| !s.trim().is_empty() && s.len() <= limit)
    else {
        return failure();
    };
    let result = if name == "search_memory" {
        retriever.search(argument.into()).await
    } else {
        retriever
            .read(argument.into())
            .await
            .map(|entry| vec![entry])
    };
    let Ok(chunks) = result else {
        return failure();
    };
    let mut visible = Vec::new();
    let mut source_limit_reached = false;
    for chunk in chunks.into_iter().take(6) {
        let known = output.knowledge_sources.iter().any(|c| c.id == chunk.id);
        if !known && output.knowledge_sources.len() >= 48 {
            source_limit_reached = true;
            continue;
        }
        if !output.memory_read_ids.contains(&chunk.memory_id) {
            output.memory_read_ids.push(chunk.memory_id.clone());
        }
        if !known {
            output.knowledge_sources.push(chunk.clone());
        }
        visible.push(chunk);
    }
    let matches: Vec<_> = visible.iter().map(|chunk| json!({
        "id":chunk.id,"memoryId":chunk.memory_id,"revision":chunk.revision,
        "title":chunk.title,"heading":chunk.heading,"source":chunk.source,
        "citationUrl":format!("#knowledge-{}", chunk.id),
        "startLine":chunk.start_line,"endLine":chunk.end_line,
        "content":chunk.content.chars().take(if name == "search_memory" { 360 } else { 1200 }).collect::<String>(),
        "excerptOnly":name == "search_memory" && chunk.content.chars().count() > 360
    })).collect();
    Some((
        json!({"matches":matches,"sourceLimitReached":source_limit_reached,"sourcePolicy":"Cite knowledge with Markdown links using the supplied citationUrl and a short source label. Search hits are candidate evidence, not verified claims. Read the full chunk before quoting. When the source limit is reached, finish using existing evidence or ask to narrow the task."}),
        event(argument.into(), true),
    ))
}
