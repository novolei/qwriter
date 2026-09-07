import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { editorExtensions } from "../editor-extensions";
import { assetMarkdown, mediaMarkdown } from "./content";
import { mediaContent } from "./MediaNode";
import { portableMarkdown } from "./export";

describe("persistent media Markdown", () => {
  it("exports portable paths and ordinary links alongside media assets", () => {
    const id = `${"c".repeat(64)}.png`;
    const output = portableMarkdown(
      mediaMarkdown({
        kind: "link",
        url: "https://example.com/story",
        title: "A story",
        description: "Preview",
        poster: `qwriter-asset://${id}`,
      }),
    );
    expect(output).toContain(`assets/${id}`);
    expect(output).toContain("[A story](<https://example.com/story>)");
    expect(output).not.toMatch(/qwriter-(media|asset)/);
  });
  it("round trips images and video/link cards without losing ordinary code blocks", () => {
    const id = `${"a".repeat(64)}.png`;
    const image = assetMarkdown({
      id,
      name: "A [memory]",
      mime: "image/png",
      size: 40,
      width: 4,
      height: 4,
    });
    const link = mediaMarkdown({
      kind: "video-link",
      url: "https://example.com/watch?v=1",
      title: "一段影像",
      description: "A & B",
      poster: `qwriter-asset://${id}`,
    });
    const source = `# 稿件\n\n${image}\n\n${link}\n\n\`\`\`rust\nlet x = 1;\n\`\`\``;
    const editor = new Editor({
      extensions: editorExtensions(),
      content: source,
      contentType: "markdown",
    });
    const nodes = editor.getJSON().content ?? [];
    expect(
      nodes.some(
        (node) =>
          node.type === "image" && node.attrs?.src === `qwriter-asset://${id}`,
      ),
    ).toBe(true);
    expect(nodes.find((node) => node.type === "mediaCard")?.attrs?.title).toBe(
      "一段影像",
    );
    expect(
      nodes.some(
        (node) => node.type === "codeBlock" && node.attrs?.language === "rust",
      ),
    ).toBe(true);
    const output = editor.getMarkdown();
    expect(output).toContain("qwriter-media");
    expect(output).toContain(`qwriter-asset://${id}`);
    editor.commands.setContent(output, { contentType: "markdown" });
    expect(
      editor.getJSON().content?.filter((node) => node.type === "mediaCard"),
    ).toHaveLength(1);
    editor.destroy();
  });
  it("keeps malformed or executable media data as code", () => {
    const editor = new Editor({
      extensions: editorExtensions(),
      content:
        '```qwriter-media\n{"kind":"link","url":"javascript:alert(1)"}\n```',
      contentType: "markdown",
    });
    expect(editor.getJSON().content?.[0].type).toBe("codeBlock");
    expect(editor.getMarkdown()).toContain("javascript:alert(1)");
    expect(
      mediaContent({ kind: "link", url: "https://secret@example.com" }),
    ).toBeNull();
    editor.destroy();
  });
});
