import type { Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { assetReference } from "../../../shared/media/assets";

/** Resolve the live node position only at apply time; never replace the current selection. */
export function imageReplacement(
  editor: Editor,
  getPos: () => number | undefined,
  source: string,
) {
  const documentId = editor.storage.documentIdentity?.id;
  return (id: string) => {
    if (
      editor.isDestroyed ||
      editor.storage.documentIdentity?.id !== documentId
    )
      throw new Error("原文稿已关闭，请重新打开图片");
    const position = getPos();
    const node =
      typeof position === "number" ? editor.state.doc.nodeAt(position) : null;
    if (!node || node.type.name !== "image" || node.attrs.src !== source)
      throw new Error("原图片已改变，请重新打开预览");
    const transaction = closeHistory(editor.state.tr).setNodeMarkup(
      position!,
      undefined,
      {
        ...node.attrs,
        src: assetReference(id),
      },
    );
    editor.view.dispatch(transaction);
    editor.view.dispatch(closeHistory(editor.state.tr));
  };
}
