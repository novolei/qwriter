import { basicSetup, EditorView } from "codemirror";
import { markdown as markdownLanguage } from "@codemirror/lang-markdown";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import {
  closeSearchPanel,
  openSearchPanel,
  searchPanelOpen,
  search,
} from "@codemirror/search";
import { useEffect, useRef } from "react";
import { language, t } from "../../shared/i18n/index";
import { undo, redo, undoDepth, redoDepth } from "@codemirror/commands";
import type { SourceHistory } from "./source-history";
import { sourcePhrases } from "./source-locale";
import { sourceHighlighting } from "./source-highlight";

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  find: boolean;
  onCloseFind: () => void;
  onHistory?: (history: SourceHistory | null) => void;
};
export function MarkdownSource({
  value,
  onChange,
  find,
  onCloseFind,
  onHistory,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ onChange, onCloseFind, find, onHistory });
  latest.current = { onChange, onCloseFind, find, onHistory };
  const localeConfig = useRef(new Compartment());
  const uiLanguage = language();
  useEffect(() => {
    if (!host.current) return;
    function reportHistory(instance: EditorView) {
      latest.current.onHistory?.({
        canUndo: undoDepth(instance.state) > 0,
        canRedo: redoDepth(instance.state) > 0,
        undo: () => {
          instance.focus();
          undo(instance);
        },
        redo: () => {
          instance.focus();
          redo(instance);
        },
      });
    }
    const instance = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          sourceHighlighting,
          search({ top: true }),
          EditorState.lineSeparator.of(value.includes("\r\n") ? "\r\n" : "\n"),
          markdownLanguage(),
          EditorView.lineWrapping,
          localeConfig.current.of([
            EditorState.phrases.of(sourcePhrases()),
            EditorView.contentAttributes.of({
              "aria-label": t("Markdown 源码"),
              spellcheck: "false",
            }),
          ]),
          EditorView.updateListener.of((update) => {
            if (
              undoDepth(update.state) !== undoDepth(update.startState) ||
              redoDepth(update.state) !== redoDepth(update.startState)
            )
              reportHistory(update.view);
            if (
              update.docChanged &&
              !update.transactions.some(
                (tr) => tr.annotation(Transaction.addToHistory) === false,
              )
            )
              latest.current.onChange(update.state.sliceDoc());
            if (
              searchPanelOpen(update.startState) &&
              !searchPanelOpen(update.state) &&
              latest.current.find
            )
              latest.current.onCloseFind();
          }),
        ],
      }),
    });
    view.current = instance;
    reportHistory(instance);
    return () => {
      view.current = null;
      instance.destroy();
      latest.current.onHistory?.(null);
    };
    // The parent keys this component by document ID; updates below preserve undo history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const instance = view.current;
    if (instance && instance.state.sliceDoc() !== value)
      instance.dispatch({
        changes: { from: 0, to: instance.state.doc.length, insert: value },
        annotations: Transaction.addToHistory.of(false),
      });
  }, [value]);
  useEffect(() => {
    if (view.current)
      view.current.dispatch({
        effects: localeConfig.current.reconfigure([
          EditorState.phrases.of(sourcePhrases()),
          EditorView.contentAttributes.of({
            "aria-label": t("Markdown 源码"),
            spellcheck: "false",
          }),
        ]),
      });
  }, [uiLanguage]);
  useEffect(() => {
    if (view.current) {
      if (find) openSearchPanel(view.current);
      else closeSearchPanel(view.current);
    }
  }, [find]);
  return <div className="markdown-source" ref={host} />;
}
