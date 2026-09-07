import { Editor } from "@tiptap/core";
import { expect, it } from "vitest";
import { normalizeTypography } from "../settings/typography";
import {
  replacePassage,
  selectedPassage,
  toggleDocumentSerif,
  validEditorUrl,
} from "./editing";
import { editorExtensions, requiresSource } from "./editor-extensions";
const create = (content: string) =>
  new Editor({
    extensions: editorExtensions(),
    content,
    contentType: "markdown",
  });
it("replaces just the selected phrase while retaining surrounding text and marks", () => {
  const editor = create(
    "# 保留标题\n\n前文 **原有加粗**，认真感受生活。后文保持。\n\n另一个段落。",
  );
  let start = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text?.includes("认真感受生活"))
      start = pos + node.text.indexOf("认真感受生活");
  });
  editor.commands.setTextSelection({ from: start, to: start + 6 });
  const selection = selectedPassage(editor)!;
  expect(selection.markdown).toBe("认真感受生活");
  expect(replacePassage(editor, selection, "细心感受每一天")).toBe(true);
  const result = editor.getMarkdown();
  expect(result).toContain("前文 **原有加粗**，细心感受每一天。后文保持。");
  expect(result).toContain("# 保留标题");
  expect(result).toContain("另一个段落。");
  editor.commands.undo();
  expect(editor.getMarkdown()).toContain("认真感受生活");
  editor.destroy();
});
it("round trips links, images, numbered lists, strike and multiple separators", () => {
  const markdown =
    '### 小标题\n\n[参考](https://example.com) 与 ~~旧表达~~ 和 `code`\n\n1. 第一步\n2. 第二步\n\n---\n\n![山](https://example.com/mountain.png "图注")\n\n---\n\n结尾。';
  const editor = create(markdown);
  const output = editor.getMarkdown();
  for (const value of [
    "### 小标题",
    "[参考](https://example.com)",
    "~~旧表达~~",
    "`code`",
    "1. 第一步",
    "2. 第二步",
    '![山](https://example.com/mountain.png "图注")',
  ])
    expect(output).toContain(value);
  expect(requiresSource(output)).toBe(false);
  editor.destroy();
});
it("protects unsupported Markdown without treating code literals or normal images as unsupported", () => {
  expect(requiresSource("---\ntitle: test\n---\n\n正文")).toBe(true);
  expect(requiresSource("正文\n\n$$x^2$$")).toBe(true);
  expect(requiresSource("```html\n<div>代码示例</div>\n```")).toBe(false);
  expect(requiresSource("---\n\n分隔后的正文\n\n---")).toBe(false);
});
it("preserves image labels and destinations containing Markdown punctuation", () => {
  const editor = create("");
  const attributes = {
    src: "https://example.com/a(b).png",
    alt: "山[雨]",
    title: '摄影 "篇章"',
  };
  editor.commands.setImage(attributes);
  const restored = create(editor.getMarkdown());
  let image: Record<string, unknown> | null = null;
  restored.state.doc.descendants((node) => {
    if (node.type.name === "image") image = node.attrs;
  });
  expect(image).toMatchObject(attributes);
  editor.destroy();
  restored.destroy();
});
it("switches reading fonts without modifying UI fonts and rejects active URL schemes", () => {
  const before = normalizeTypography({
    uiLatin: "manrope",
    documentLatin: "lora",
  });
  const after = toggleDocumentSerif(before);
  expect(after.uiLatin).toBe("manrope");
  expect(after.documentFont).toBe("noto-sans");
  expect(after.documentLatin).toBe("inter");
  expect(validEditorUrl("https://example.com/a")).toBe(true);
  expect(validEditorUrl("mailto:writer@example.com")).toBe(true);
  for (const url of [
    "javascript:alert(1)",
    "file:///secret",
    "https://user:password@example.com",
    "data:text/html,x",
  ])
    expect(validEditorUrl(url)).toBe(false);
  expect(validEditorUrl("mailto:writer@example.com", true)).toBe(false);
});
