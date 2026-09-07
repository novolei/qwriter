import type { Editor } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { Typography } from "../settings/typography";

export type SelectedPassage = { from: number; to: number; markdown: string };
export function selectedPassage(editor: Editor): SelectedPassage | null {
  if (!(editor.state.selection instanceof TextSelection)) return null;
  const { from, to, empty } = editor.state.selection;
  if (empty || !editor.state.doc.textBetween(from, to).trim()) return null;
  return {
    from,
    to,
    markdown: editor.storage.markdown.manager.serialize(
      editor.state.doc.cut(from, to).toJSON(),
    ),
  };
}
export function replacePassage(
  editor: Editor,
  selection: SelectedPassage,
  markdown: string,
) {
  const parsed = editor.storage.markdown.manager.parse(markdown);
  const content = Fragment.fromArray(
    (parsed.content ?? []).map((node) => editor.schema.nodeFromJSON(node)),
  );
  // An open slice merges its edge paragraphs with the surrounding text, like
  // pasting, instead of splitting a sentence into three separate paragraphs.
  const slice = Slice.maxOpen(content);
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.replaceRange(selection.from, selection.to, slice);
      return true;
    })
    .run();
}
export function toggleDocumentSerif(value: Typography): Typography {
  const serif = value.documentFont.endsWith("serif");
  const latinSerif = ["lora", "source-serif"].includes(value.documentLatin);
  return {
    ...value,
    documentFont: serif ? "noto-sans" : "noto-serif",
    documentLatin: serif
      ? latinSerif
        ? "inter"
        : value.documentLatin
      : latinSerif
        ? value.documentLatin
        : "source-serif",
  };
}
export function validEditorUrl(value: string, image = false) {
  if (!image && /^#[^\s]+$/.test(value.trim())) {
    try {
      return !!decodeURIComponent(value.trim().slice(1));
    } catch {
      return false;
    }
  }
  try {
    const url = new URL(value.trim());
    return (
      (image ? ["https:", "http:"] : ["https:", "http:", "mailto:"]).includes(
        url.protocol,
      ) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
