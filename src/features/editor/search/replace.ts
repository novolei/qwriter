import type { Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { findRichText, MATCH_LIMIT } from "./matches";

/** One undoable transaction; preserves marks outside the replacement and block structure. */
export function replaceRichText(
  editor: Editor,
  query: string,
  replacement: string,
  caseSensitive: boolean,
  index: number,
  all: boolean,
) {
  const matches = findRichText(editor.state.doc, query, caseSensitive);
  if (
    !matches.length ||
    matches.length > MATCH_LIMIT ||
    replacement.includes("\n")
  )
    return 0;
  const selected = all ? matches : matches.slice(index, index + 1);
  const tr = closeHistory(editor.state.tr);
  for (const match of [...selected].reverse())
    tr.insertText(replacement, match.from, match.to);
  if (selected.length) {
    editor.view.dispatch(tr);
    editor.view.dispatch(closeHistory(editor.state.tr));
  }
  return selected.length;
}
