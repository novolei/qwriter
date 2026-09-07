import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { SearchBar } from "./SearchBar";
import { searchKey, type SearchState } from "./highlight";
import { findRichText, MATCH_LIMIT } from "./matches";
import { replaceRichText } from "./replace";

export function RichSearch({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [state, setState] = useState<SearchState>({
    query: "",
    caseSensitive: false,
    active: 0,
  });
  const [, update] = useState(0);
  const matches = findRichText(
    editor.state.doc,
    state.query,
    state.caseSensitive,
  );
  const index = Math.min(
    state.active,
    Math.max(0, Math.min(matches.length, MATCH_LIMIT) - 1),
  );
  useEffect(() => {
    const listener = () => update((n) => n + 1);
    editor.on("update", listener);
    return () => {
      editor.off("update", listener);
    };
  }, [editor]);
  useEffect(() => {
    if (editor.isDestroyed) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(searchKey, { ...state, active: index }),
    );
    const active = editor.view.dom.querySelector(".search-match-active");
    active?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [editor, state, index]);
  useEffect(
    () => () => {
      if (!editor.isDestroyed)
        editor.view.dispatch(
          editor.state.tr.setMeta(searchKey, {
            query: "",
            caseSensitive: false,
            active: 0,
          }),
        );
    },
    [editor],
  );
  return (
    <SearchBar
      count={Math.min(matches.length, MATCH_LIMIT)}
      index={index}
      limited={matches.length > MATCH_LIMIT}
      onQuery={(query, caseSensitive) =>
        setState({ query, caseSensitive, active: 0 })
      }
      onMove={(delta) =>
        setState((s) => ({
          ...s,
          active:
            (index + delta + Math.min(matches.length, MATCH_LIMIT)) %
            Math.max(1, Math.min(matches.length, MATCH_LIMIT)),
        }))
      }
      onReplace={(replacement, all) =>
        replaceRichText(
          editor,
          state.query,
          replacement,
          state.caseSensitive,
          index,
          all,
        )
      }
      onClose={() => {
        onClose();
        editor.commands.focus();
      }}
    />
  );
}
