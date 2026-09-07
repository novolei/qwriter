import { Editor } from "@tiptap/core";
import { expect, it } from "vitest";
import { editorExtensions } from "../editor-extensions";
import { findRichText, findText, MATCH_LIMIT } from "./matches";
import { replaceRichText } from "./replace";

it("matches literals, Unicode and case without changing offsets", () => {
  expect(findText("🙂 A.b a.b [x]", "a.b", false)).toEqual([
    { from: 3, to: 6 },
    { from: 7, to: 10 },
  ]);
  expect(findText("İ A X", "x", false)).toEqual([{ from: 4, to: 5 }]);
  expect(findText("A a", "a", true)).toEqual([{ from: 2, to: 3 }]);
  expect(findText("text", "", false)).toEqual([]);
});
it("replaces across inline marks in one undo step and preserves unrelated content", () => {
  const editor = new Editor({
    extensions: editorExtensions(),
    content:
      "# Title\n\nOne **quiet** garden. Another quiet garden.\n\nKeep **this**.",
    contentType: "markdown",
  });
  const original = editor.getMarkdown();
  expect(findRichText(editor.state.doc, "quiet garden", false)).toHaveLength(2);
  expect(
    replaceRichText(editor, "quiet garden", "bright morning", false, 0, true),
  ).toBe(2);
  expect(editor.state.doc.textContent).toContain(
    "One bright morning. Another bright morning.",
  );
  expect(editor.getMarkdown()).toContain("Keep **this**.");
  editor.commands.undo();
  expect(editor.getMarkdown()).toBe(original);
  editor.commands.redo();
  expect(editor.state.doc.textContent).toContain("bright morning");
  editor.destroy();
});
it("never replaces across blocks and declines an oversized replacement set", () => {
  const editor = new Editor({
    extensions: editorExtensions(),
    content: "# First\n\nSecond",
    contentType: "markdown",
  });
  expect(findRichText(editor.state.doc, "FirstSecond", false)).toEqual([]);
  editor.commands.setContent("x ".repeat(MATCH_LIMIT + 2), {
    contentType: "markdown",
  });
  expect(replaceRichText(editor, "x", "y", false, 0, true)).toBe(0);
  expect(editor.state.doc.textContent).not.toContain("y");
  editor.destroy();
});
