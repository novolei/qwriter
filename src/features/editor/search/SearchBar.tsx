import {
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Replace,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../../../shared/i18n/index";

export type SearchActions = {
  count: number;
  index: number;
  limited: boolean;
  onQuery: (query: string, sensitive: boolean) => void;
  onMove: (delta: number) => void;
  onReplace: (replacement: string, all: boolean) => number;
  onClose: () => void;
};
export function SearchBar({
  count,
  index,
  limited,
  onQuery,
  onMove,
  onReplace,
  onClose,
}: SearchActions) {
  const [query, setQuery] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [replacement, setReplacement] = useState("");
  const [feedback, setFeedback] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  function change(value: string, exact = sensitive) {
    setQuery(value);
    setSensitive(exact);
    setFeedback("");
    onQuery(value, exact);
  }
  function replace(all: boolean) {
    const count = onReplace(replacement, all);
    setFeedback(t("已替换 {{count}} 处，可撤销", { count }));
  }
  return (
    <div
      className="document-search"
      role="search"
      aria-label={t("查找与替换")}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          if (event.target === input.current) onMove(event.shiftKey ? -1 : 1);
          else replace(false);
        }
      }}
    >
      <div className="search-row">
        <button
          title={t("展开替换")}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <input
          ref={input}
          value={query}
          onChange={(e) => change(e.target.value)}
          aria-label={t("查找内容")}
          placeholder={t("在文稿中查找…")}
          maxLength={1000}
        />
        <button
          title={t("区分大小写")}
          aria-pressed={sensitive}
          onClick={() => change(query, !sensitive)}
        >
          <CaseSensitive size={17} />
        </button>
        <span className="search-count" role="status">
          {query
            ? limited
              ? "2000+"
              : `${count ? index + 1 : 0} / ${count}`
            : "—"}
        </span>
        <button
          title={t("上一个匹配")}
          disabled={!count}
          onClick={() => onMove(-1)}
        >
          <ArrowUp size={15} />
        </button>
        <button
          title={t("下一个匹配")}
          disabled={!count}
          onClick={() => onMove(1)}
        >
          <ArrowDown size={15} />
        </button>
        <button title={t("关闭查找")} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {expanded && (
        <div className="search-row replace-row">
          <Replace size={16} />
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            aria-label={t("替换为")}
            placeholder={t("替换为…")}
            maxLength={10000}
          />
          <button disabled={!count || limited} onClick={() => replace(false)}>
            {t("替换")}
          </button>
          <button disabled={!count || limited} onClick={() => replace(true)}>
            {t("全部替换")}
          </button>
        </div>
      )}
      {(feedback || limited) && (
        <small role="status">
          {limited ? t("匹配过多，请缩小查找范围后替换。") : feedback}
        </small>
      )}
    </div>
  );
}
