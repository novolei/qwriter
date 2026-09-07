import { t } from "../../shared/i18n";

/** CodeMirror's phrase names are its external localization protocol. */
export function sourcePhrases(): Record<string, string> {
  return {
    Find: t("source.Find"),
    Replace: t("source.Replace"),
    next: t("source.next"),
    previous: t("source.previous"),
    all: t("source.all"),
    "match case": t("source.match case"),
    regexp: t("source.regexp"),
    "by word": t("source.by word"),
    replace: t("source.replace"),
    "replace all": t("source.replace all"),
    close: t("source.close"),
    "No matches found": t("source.No matches found"),
    "Go to line": t("source.Go to line"),
    go: t("source.go"),
    "current match": t("source.current match"),
    "replaced $ matches": t("source.replaced $ matches"),
    "replaced match on line $": t("source.replaced match on line $"),
    "on line": t("source.on line"),
    "Selection deleted": t("source.Selection deleted"),
    "Folded lines": t("source.Folded lines"),
    "Unfolded lines": t("source.Unfolded lines"),
    to: t("source.to"),
    "folded code": t("source.folded code"),
    unfold: t("source.unfold"),
    "Fold line": t("source.Fold line"),
    "Unfold line": t("source.Unfold line"),
    "Control character": t("source.Control character"),
  };
}
