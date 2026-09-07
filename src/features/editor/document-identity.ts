import { Extension } from "@tiptap/core";
declare module "@tiptap/core" {
  interface Storage {
    documentIdentity: { id: string };
  }
}
/** Bind transactions to the document that created this editor, including during tab changes. */
export function documentIdentity(id: string) {
  return Extension.create({
    name: "documentIdentity",
    addStorage: () => ({ id }),
  });
}
