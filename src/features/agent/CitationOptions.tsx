import { BookOpenCheck } from "lucide-react";
import { t } from "../../shared/i18n";
import type { PreparedCitations } from "../knowledge/citations";
import "./citations.css";

export function CitationOptions({
  citations,
  retain,
  disabled,
  onChange,
}: {
  citations: PreparedCitations;
  retain: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  if (!citations.sourceCount && !citations.unresolved) return null;
  return (
    <div className="agent-citation-options">
      {!!citations.sourceCount && (
        <>
          <label>
            <BookOpenCheck size={16} aria-hidden="true" />
            <span>{t("随文稿保留引用来源")}</span>
            <input
              type="checkbox"
              checked={retain}
              disabled={disabled}
              onChange={(event) => onChange(event.target.checked)}
            />
          </label>
          <small>
            {t(
              retain
                ? "{{count}} 个来源快照将随文稿保存和导出，请在分享前审阅。"
                : "仅保留正文，知识引用将转为普通文字。",
              { count: citations.sourceCount },
            )}
          </small>
        </>
      )}
      {!!citations.unresolved && (
        <small role="status">
          {t("{{count}} 处引用无法匹配本次来源，已转为普通文字，请核对内容。", {
            count: citations.unresolved,
          })}
        </small>
      )}
    </div>
  );
}
