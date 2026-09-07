import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export type ParagraphBlock = {
  pos: number;
  kind: string;
  text: string;
  heading: string;
};

/** Content positions come from the document, never from a second Markdown parse. */
export function paragraphBlocks(doc: ProseMirrorNode): ParagraphBlock[] {
  const blocks: ParagraphBlock[] = [];
  let heading = "";
  doc.descendants((node, pos) => {
    const kind = node.type.name;
    if (
      !node.isTextblock &&
      kind !== "image" &&
      kind !== "table" &&
      kind !== "mediaCard"
    )
      return;
    const text = (
      kind === "mediaCard"
        ? node.attrs.title || node.attrs.url || ""
        : kind === "image"
          ? node.attrs.alt || ""
          : node.textBetween(0, node.content.size, " ")
    )
      .replace(/\s+/g, " ")
      .trim();
    if (kind === "heading") heading = text.slice(0, 100);
    if (text || kind === "image" || kind === "table")
      blocks.push({ pos, kind, text: text.slice(0, 420), heading });
    // Tables have one summary; list / quote containers expose their paragraphs.
    return false;
  });
  return blocks;
}

export function readingBlock(tops: number[], offset: number): number {
  let low = 0;
  let high = tops.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (tops[mid] <= offset) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(0, high);
}
