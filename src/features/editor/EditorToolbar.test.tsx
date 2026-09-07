import { chooseOption } from "../../test/select";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, expect, it, vi } from "vitest";
import { normalizeTypography } from "../settings/typography";
import { EditorToolbar } from "./EditorToolbar";
import { editorExtensions } from "./editor-extensions";
const editors: Editor[] = [];
afterEach(() => {
  cleanup();
  editors.splice(0).forEach((e) => e.destroy());
});
it("formats the selected text, supports undo, and changes display fonts without altering Markdown", async () => {
  const editor = new Editor({
    extensions: editorExtensions(),
    content: "Before target after",
    contentType: "markdown",
  });
  editors.push(editor);
  editor.commands.setTextSelection({ from: 8, to: 14 });
  const typography = vi.fn();
  render(
    <EditorToolbar
      editor={editor}
      source={false}
      onSource={() => {}}
      typography={normalizeTypography({})}
      onTypography={typography}
      onAppearance={() => {}}
      onSelectionAi={() => {}}
      aiBusy={false}
      paragraphFocus={false}
      typewriter={false}
      onParagraphFocus={() => {}}
      onTypewriter={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "粗体" }));
  expect(editor.getMarkdown()).toBe("Before **target** after");
  fireEvent.click(screen.getByRole("button", { name: "撤销" }));
  expect(editor.getMarkdown()).toBe("Before target after");
  await chooseOption("快捷字号", "20");
  expect(typography.mock.calls.at(-1)?.[0].fontSize).toBe(20);
  fireEvent.click(screen.getByRole("button", { name: "切换为无衬线" }));
  expect(typography.mock.calls.at(-1)?.[0].documentFont).toBe("noto-sans");
  expect(editor.getMarkdown()).toBe("Before target after");
});
