import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import GithubSlugger from "github-slugger";

type AnchorIndex = {
  positions: Map<string, number>;
  decorations: DecorationSet;
};
const key = new PluginKey<AnchorIndex>("headingAnchors");

function indexHeadings(doc: Node): AnchorIndex {
  const slugger = new GithubSlugger();
  const positions = new Map<string, number>();
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const text = node.textBetween(0, node.content.size, "", (leaf) =>
      leaf.type.name === "image" ? String(leaf.attrs.alt ?? "") : "\n",
    );
    const id = slugger.slug(text);
    positions.set(id, pos);
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { id }));
  });
  return { positions, decorations: DecorationSet.create(doc, decorations) };
}

export type HeadingAnchorOptions = { onMissingTarget: () => void };

export const HeadingAnchors = Extension.create<HeadingAnchorOptions>({
  name: "headingAnchors",
  addOptions() {
    return { onMissingTarget: () => {} };
  },
  addProseMirrorPlugins() {
    const navigate = (view: EditorView, event: MouseEvent | KeyboardEvent) => {
      if (event instanceof MouseEvent && event.button !== 0) return false;
      if (event.altKey || event.shiftKey) return false;
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href^='#']")
          : null;
      if (!target || !view.dom.contains(target)) return false;
      const href = target.getAttribute("href") ?? "";
      let id: string;
      try {
        id = decodeURIComponent(href.slice(1));
      } catch {
        id = "";
      }
      event.preventDefault();
      const position = key.getState(view.state)?.positions.get(id);
      if (position === undefined) {
        this.options.onMissingTarget();
        return true;
      }
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.near(view.state.doc.resolve(position + 1)),
        ),
      );
      view.focus();
      const heading = view.nodeDOM(position);
      if (heading instanceof HTMLElement)
        heading.scrollIntoView({
          block: "center",
          behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      return true;
    };
    return [
      new Plugin<AnchorIndex>({
        key,
        state: {
          init: (_, state) => indexHeadings(state.doc),
          apply: (transaction, previous) =>
            transaction.docChanged ? indexHeadings(transaction.doc) : previous,
        },
        props: {
          decorations: (state) => key.getState(state)?.decorations,
          handleDOMEvents: {
            click: navigate,
            keydown: (view, event) =>
              event.key === "Enter" && navigate(view, event),
          },
        },
      }),
    ];
  },
});
