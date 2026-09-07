import { Editor } from "@tiptap/core";
import { afterEach, expect, it } from "vitest";
import { editorExtensions } from "../editor-extensions";
import { documentIdentity } from "../document-identity";
import { imageReplacement } from "./image-replacement";
import { assetReference } from "../../../shared/media/assets";
const original = assetReference(`${"a".repeat(64)}.png`);
const edited = `${"b".repeat(64)}.png`;
const editors: Editor[] = [];
function setup() {
  const editor = new Editor({
    extensions: [...editorExtensions(), documentIdentity("first")],
    content: {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: original, alt: "Caption", title: "Keep" },
        },
        { type: "paragraph", content: [{ type: "text", text: "Untouched" }] },
      ],
    },
  });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));
it("replaces only the original image and preserves its caption, with isolated undo/redo", () => {
  const editor = setup();
  const before = editor.getJSON();
  editor.commands.setTextSelection(4);
  imageReplacement(editor, () => 0, original)(edited);
  expect(editor.state.doc.nodeAt(0)?.attrs).toMatchObject({
    src: assetReference(edited),
    alt: "Caption",
    title: "Keep",
  });
  expect(editor.state.doc.textContent).toBe("Untouched");
  editor.commands.undo();
  expect(editor.getJSON()).toEqual(before);
  editor.commands.redo();
  expect(editor.state.doc.nodeAt(0)?.attrs.src).toBe(assetReference(edited));
});
it("rejects removed nodes, changed images and a changed document identity", () => {
  const editor = setup();
  const replace = imageReplacement(editor, () => 0, original);
  editor.storage.documentIdentity.id = "second";
  expect(() => replace(edited)).toThrow("原文稿已关闭");
  editor.storage.documentIdentity.id = "first";
  editor.commands.setNodeSelection(0);
  editor.commands.updateAttributes("image", {
    src: "https://example.com/replaced.png",
  });
  expect(() => replace(edited)).toThrow("原图片已改变");
  expect(() =>
    imageReplacement(editor, () => undefined, original)(edited),
  ).toThrow("原图片已改变");
});
it("resolves the live position after edits before the image", () => {
  const editor = setup();
  let position = 0;
  const replace = imageReplacement(editor, () => position, original);
  editor.commands.insertContentAt(0, {
    type: "paragraph",
    content: [{ type: "text", text: "New" }],
  });
  position = 5;
  replace(edited);
  expect(editor.state.doc.nodeAt(5)?.attrs.src).toBe(assetReference(edited));
  expect(editor.state.doc.textContent).toBe("NewUntouched");
});
