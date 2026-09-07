use super::MemoryEntry;
use serde::{Deserialize, Serialize};

pub const CHUNK_SIZE: usize = 1200;
pub const INDEX_VERSION: i64 = 1;

/// Offsets count Unicode scalar values, never bytes or JavaScript UTF-16 units.
/// IDs are stable within a saved revision. New revisions intentionally invalidate anchors.
#[derive(Clone, Debug, Serialize, Deserialize, specta::Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeChunk {
    pub id: String,
    pub memory_id: String,
    pub revision: i64,
    pub title: String,
    pub heading: String,
    pub source: String,
    pub document_id: String,
    pub start_offset: u32,
    pub end_offset: u32,
    pub start_line: u32,
    pub end_line: u32,
    pub content: String,
}

pub fn split(entry: &MemoryEntry) -> Vec<KnowledgeChunk> {
    let mut chunks = Vec::new();
    let mut buffer = String::new();
    let mut buffer_size = 0;
    let mut offset = 0;
    let mut line_number = 1;
    let mut start_line = 1;
    let mut headings: Vec<(usize, String)> = Vec::new();
    let mut fence: Option<(char, usize)> = None;
    let flush = |buffer: &mut String,
                 offset: &mut u32,
                 start_line: u32,
                 headings: &[(usize, String)],
                 chunks: &mut Vec<KnowledgeChunk>| {
        let content = std::mem::take(buffer);
        let end_offset = *offset + content.chars().count() as u32;
        if !content.trim().is_empty() {
            chunks.push(KnowledgeChunk {
                id: format!("{}:{}:v1:{}", entry.id, entry.revision, chunks.len()),
                memory_id: entry.id.clone(),
                revision: entry.revision,
                title: entry.title.clone(),
                source: entry.source.clone(),
                document_id: entry.document_id.clone(),
                heading: headings
                    .iter()
                    .map(|(_, h)| h.as_str())
                    .collect::<Vec<_>>()
                    .join(" / "),
                start_offset: *offset,
                end_offset,
                start_line,
                end_line: start_line + content.trim_end_matches('\n').matches('\n').count() as u32,
                content,
            });
        }
        *offset = end_offset;
    };
    for line in entry.content.split_inclusive('\n') {
        let trimmed = line.trim_start();
        let heading_level = trimmed.chars().take_while(|c| *c == '#').count();
        let is_heading = fence.is_none()
            && (1..=6).contains(&heading_level)
            && trimmed.as_bytes().get(heading_level) == Some(&b' ');
        if is_heading {
            flush(&mut buffer, &mut offset, start_line, &headings, &mut chunks);
            buffer_size = 0;
            start_line = line_number;
            headings.retain(|(level, _)| *level < heading_level);
            headings.push((
                heading_level,
                trimmed[heading_level..]
                    .trim()
                    .trim_end_matches('#')
                    .trim()
                    .chars()
                    .take(120)
                    .collect(),
            ));
        }
        if let Some(marker @ ('`' | '~')) = trimmed.chars().next() {
            let count = trimmed.chars().take_while(|c| *c == marker).count();
            if count >= 3 {
                if fence.is_none() {
                    fence = Some((marker, count));
                } else if fence.is_some_and(|(m, n)| m == marker && count >= n)
                    && trimmed[count..].trim().is_empty()
                {
                    fence = None;
                }
            }
        }
        for character in line.chars() {
            if buffer_size == CHUNK_SIZE {
                flush(&mut buffer, &mut offset, start_line, &headings, &mut chunks);
                buffer_size = 0;
                start_line = line_number;
            }
            buffer.push(character);
            buffer_size += 1;
            if character == '\n' {
                line_number += 1;
            }
        }
        if line.trim().is_empty() && fence.is_none() && buffer_size >= 300 {
            flush(&mut buffer, &mut offset, start_line, &headings, &mut chunks);
            buffer_size = 0;
            start_line = line_number;
        }
    }
    flush(&mut buffer, &mut offset, start_line, &headings, &mut chunks);
    chunks
}

fn cjk(c: char) -> bool {
    matches!(c as u32, 0x3400..=0x9fff | 0x20000..=0x3134f | 0x3040..=0x30ff | 0xac00..=0xd7af)
}

/// FTS5 handles ranking and matching. Character/bigram tokens add short CJK recall
/// without shipping a language dictionary or sending text to an embedding service.
pub fn tokens(text: &str, for_query: bool) -> Vec<String> {
    let mut result = Vec::new();
    let chars: Vec<_> = text.chars().collect();
    let mut word = String::new();
    for (i, &c) in chars.iter().enumerate() {
        if cjk(c) || !c.is_alphanumeric() {
            if !word.is_empty() {
                result.push(std::mem::take(&mut word).to_lowercase());
            }
            if cjk(c) {
                let next = chars.get(i + 1).copied().filter(|c| cjk(*c));
                let previous = i
                    .checked_sub(1)
                    .and_then(|n| chars.get(n))
                    .is_some_and(|c| cjk(*c));
                if !for_query || (next.is_none() && !previous) {
                    result.push(c.to_string());
                }
                if let Some(next) = next {
                    result.push(format!("{c}{next}"));
                }
            }
        } else {
            word.push(c);
        }
    }
    if !word.is_empty() {
        result.push(word.to_lowercase());
    }
    result
}
