import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { SearchHighlight } from "./search/highlight";
import { MediaNode } from "./media/MediaNode";
import { LocalImageView } from "./media/LocalImageView";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { HeadingAnchors, type HeadingAnchorOptions } from "./heading-anchors";
import { TrailingParagraph } from "./trailing-paragraph";
import { DocumentLink } from "./document-link";

const MarkdownImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(LocalImageView);
  },
  renderMarkdown(node) {
    const alt = String(node.attrs?.alt ?? "").replace(/[\\\[\]]/g, "\\$&");
    const title = String(node.attrs?.title ?? "").replace(/[\\"]/g, "\\$&");
    const source = String(node.attrs?.src ?? "");
    const destination = /[\s()]/.test(source)
      ? `<${source.replace(/</g, "%3C").replace(/>/g, "%3E")}>`
      : source;
    return `![${alt}](${destination}${title ? ` "${title}"` : ""})`;
  },
});

// Only expose formats with a Markdown representation. Arbitrary text colors,
// alignment and per-span fonts would otherwise be lost on the next save.
export function editorExtensions(anchors: Partial<HeadingAnchorOptions> = {}) {
  return [
    StarterKit.configure({
      underline: false,
      trailingNode: false,
      link: false,
    }),
    DocumentLink.configure({ openOnClick: false, defaultProtocol: "https" }),
    TableKit.configure({ table: { resizable: false } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    MarkdownImage.configure({
      HTMLAttributes: {
        loading: "lazy",
        decoding: "async",
        referrerpolicy: "no-referrer",
      },
    }),
    Markdown,
    TrailingParagraph.configure({ node: "paragraph" }),
    HeadingAnchors.configure(anchors),
    SearchHighlight,
    MediaNode,
  ];
}

export function requiresSource(markdown: string) {
  // Code fences may contain syntax which is literal text, not extended Markdown.
  const outsideCode = markdown.replace(
    /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm,
    "",
  );
  const frontmatter = markdown.match(
    /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/,
  );
  return (
    (!!frontmatter && /^\s*[\w\u3400-\u9fff -]+\s*:/m.test(frontmatter[1])) ||
    /^\[\^|\$\$|\\\(|^\s*<[a-zA-Z!]/m.test(outsideCode)
  );
}
