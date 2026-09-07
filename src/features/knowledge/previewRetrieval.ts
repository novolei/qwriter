import type { KnowledgeChunk, MemoryEntry } from "../../shared/ipc/bindings";

// Browser preview adapter. Native retrieval uses SQLite FTS5; anchors share the
// same Unicode-scalar contract so preview and desktop source views are identical.
export function splitMemory(entry: MemoryEntry): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  let buffer = "";
  let size = 0;
  let offset = 0;
  let lineNumber = 1;
  let startLine = 1;
  let headings: { level: number; title: string }[] = [];
  let fence: { marker: string; length: number } | null = null;
  function flush() {
    const endOffset = offset + size;
    if (buffer.trim())
      chunks.push({
        id: `${entry.id}:${entry.revision}:v1:${chunks.length}`,
        memoryId: entry.id,
        revision: entry.revision,
        title: entry.title,
        source: entry.source,
        documentId: entry.documentId,
        heading: headings.map((h) => h.title).join(" / "),
        startOffset: offset,
        endOffset,
        startLine,
        endLine:
          startLine + (buffer.replace(/\n+$/, "").match(/\n/g)?.length ?? 0),
        content: buffer,
      });
    offset = endOffset;
    buffer = "";
    size = 0;
    startLine = lineNumber;
  }
  for (const line of entry.content.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const heading = !fence && line.trimStart().match(/^(#{1,6}) (.*)/);
    if (heading) {
      flush();
      headings = headings.filter((h) => h.level < heading[1].length);
      headings.push({
        level: heading[1].length,
        title: Array.from(heading[2].trim().replace(/#+$/, "").trim())
          .slice(0, 120)
          .join(""),
      });
    }
    const marker = line.trimStart().match(/^(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = { marker: marker[1][0], length: marker[1].length };
      else if (
        fence.marker === marker[1][0] &&
        marker[1].length >= fence.length &&
        !line.trimStart().slice(marker[1].length).trim()
      )
        fence = null;
    }
    for (const character of line) {
      if (size === 1200) flush();
      buffer += character;
      size++;
      if (character === "\n") lineNumber++;
    }
    if (!line.trim() && !fence && size >= 300) flush();
  }
  flush();
  return chunks;
}

const isCjk = (c: string) =>
  /[\u3400-\u9fff\u{20000}-\u{3134f}\u3040-\u30ff\uac00-\ud7af]/u.test(c);
export function queryTerms(query: string): string[] {
  const terms: string[] = [];
  const characters = Array.from(query.toLowerCase());
  let word = "";
  characters.forEach((c, index) => {
    if (isCjk(c) || !/[\p{L}\p{N}]/u.test(c)) {
      if (word) terms.push(word);
      word = "";
      if (isCjk(c)) {
        const next = characters[index + 1];
        if (next && isCjk(next)) terms.push(c + next);
        else if (!index || !isCjk(characters[index - 1])) terms.push(c);
      }
    } else word += c;
  });
  if (word) terms.push(word);
  return [...new Set(terms)].slice(0, 24);
}

export function searchPreview(
  entries: MemoryEntry[],
  query: string,
  documentId: string,
): KnowledgeChunk[] {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const hits = entries
    .filter(
      (e) => !e.archived && (!e.documentId || e.documentId === documentId),
    )
    .flatMap(splitMemory)
    .map((chunk) => {
      const text =
        `${chunk.title} ${chunk.heading} ${chunk.content}`.toLowerCase();
      const coverage = terms.filter((word) => text.includes(word)).length;
      const titleScore = terms.filter((word) =>
        chunk.title.toLowerCase().includes(word),
      ).length;
      const phrase = text.includes(query.trim().toLowerCase()) ? 1 : 0;
      return { chunk, coverage, titleScore, phrase };
    })
    .filter((hit) => hit.coverage)
    .sort(
      (a, b) =>
        b.coverage - a.coverage ||
        b.phrase - a.phrase ||
        b.titleScore - a.titleScore ||
        a.chunk.id.localeCompare(b.chunk.id),
    );
  const counts = new Map<string, number>();
  return hits
    .filter(({ chunk }) => {
      const count = (counts.get(chunk.memoryId) ?? 0) + 1;
      counts.set(chunk.memoryId, count);
      return count <= 3;
    })
    .slice(0, 24)
    .map(({ chunk }) => chunk);
}
