import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
export type Match = { from: number; to: number };
export const MATCH_LIMIT = 2000;

// Literal Unicode matching keeps offsets intact (case folding can change length).
export function findText(
  text: string,
  query: string,
  caseSensitive: boolean,
): Match[] {
  if (!query) return [];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, caseSensitive ? "gu" : "giu");
  const matches: Match[] = [];
  for (const match of text.matchAll(pattern)) {
    matches.push({ from: match.index, to: match.index + match[0].length });
    if (matches.length > MATCH_LIMIT) break;
  }
  return matches;
}

export function findRichText(
  doc: ProseMirrorNode,
  query: string,
  caseSensitive: boolean,
): Match[] {
  const matches: Match[] = [];
  doc.descendants((node, position) => {
    if (matches.length > MATCH_LIMIT) return false;
    if (!node.isTextblock) return true;
    // Each inline atom is a boundary. Never search through an image or a hard break.
    let run = "";
    let start = position + 1;
    function flush() {
      for (const match of findText(run, query, caseSensitive)) {
        matches.push({ from: start + match.from, to: start + match.to });
        if (matches.length > MATCH_LIMIT) break;
      }
      run = "";
    }
    node.forEach((child, offset) => {
      if (child.isText) {
        if (!run) start = position + 1 + offset;
        run += child.text;
      } else flush();
    });
    flush();
    return false;
  });
  return matches.slice(0, MATCH_LIMIT + 1);
}
