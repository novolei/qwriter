import { TrailingNode } from "@tiptap/extensions";
import { Plugin } from "@tiptap/pm/state";

/** Retain Tiptap's editable trailing paragraph after changes, without turning
 * focus or navigation into a document edit on a freshly opened Markdown file. */
export const TrailingParagraph = TrailingNode.extend({
  addProseMirrorPlugins() {
    return (this.parent?.() ?? []).map((plugin) => {
      const append = plugin.spec.appendTransaction;
      return new Plugin({
        ...plugin.spec,
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((transaction) => transaction.docChanged))
            return null;
          return append?.call(this, transactions, oldState, newState);
        },
      });
    });
  },
});
