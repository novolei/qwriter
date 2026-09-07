import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/** Theme tokens update colors without recreating the editor or its undo history. */
export const sourceHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading, color: "var(--text)", fontWeight: "600" },
    { tag: tags.strong, fontWeight: "700" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    {
      tag: [tags.link, tags.url],
      color: "var(--green)",
      textDecoration: "underline",
    },
    {
      tag: [
        tags.keyword,
        tags.atom,
        tags.bool,
        tags.number,
        tags.monospace,
        tags.string,
      ],
      color: "var(--green)",
    },
    {
      tag: [tags.comment, tags.meta, tags.processingInstruction],
      color: "var(--muted)",
    },
    {
      tag: tags.invalid,
      color: "var(--text)",
      textDecoration: "underline wavy",
    },
  ]),
);
