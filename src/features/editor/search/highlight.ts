import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findRichText, MATCH_LIMIT } from "./matches";

export type SearchState = {
  query: string;
  caseSensitive: boolean;
  active: number;
};
export const searchKey = new PluginKey<SearchState>("qwriter-search");
export const SearchHighlight = Extension.create({
  name: "qwriterSearch",
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: "", caseSensitive: false, active: 0 }),
          apply: (tr, state) => tr.getMeta(searchKey) ?? state,
        },
        props: {
          decorations(state) {
            const search = searchKey.getState(state);
            if (!search?.query) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              findRichText(state.doc, search.query, search.caseSensitive)
                .slice(0, MATCH_LIMIT)
                .map((match, index) =>
                  Decoration.inline(match.from, match.to, {
                    class:
                      index === search.active
                        ? "search-match search-match-active"
                        : "search-match",
                  }),
                ),
            );
          },
        },
      }),
    ];
  },
});
