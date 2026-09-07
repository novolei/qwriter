import { useEffect, useRef } from "react";
import type { MemoryEntry } from "../../shared/ipc/bindings";
import { t } from "../../shared/i18n";
import { Select } from "../../shared/ui/Select";

export function MemoryEditor({
  entry,
  onChange,
  onSave,
  onCancel,
  busy,
  documentId,
  isCurrentDocument = true,
}: {
  entry: MemoryEntry;
  onChange: (entry: MemoryEntry) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  documentId: string;
  isCurrentDocument?: boolean;
}) {
  const title = useRef<HTMLInputElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, []);
  return (
    <form
      className="memory-editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <label>
        {t("记忆标题")}
        <input
          data-autofocus
          ref={title}
          value={entry.title}
          maxLength={200}
          onChange={(e) => onChange({ ...entry, title: e.target.value })}
          disabled={busy}
        />
      </label>
      <div className="memory-editor-options">
        <label>
          {t("记忆类型")}
          <Select
            value={entry.kind}
            onValueChange={(kind) => onChange({ ...entry, kind })}
            disabled={busy}
            aria-label={t("记忆类型")}
          >
            <option value="preference">{t("写作偏好")}</option>
            <option value="fact">{t("事实与约定")}</option>
            <option value="knowledge">{t("知识素材")}</option>
          </Select>
        </label>
        <label>
          {t("使用范围")}
          <Select
            value={entry.documentId ? "document" : "global"}
            onValueChange={(scope) =>
              onChange({
                ...entry,
                documentId: scope === "global" ? "" : documentId,
              })
            }
            disabled={busy}
            aria-label={t("使用范围")}
          >
            <option value="global">{t("整个写作空间")}</option>
            <option value="document">
              {t(isCurrentDocument ? "仅当前文稿" : "指定文稿")}
            </option>
          </Select>
        </label>
      </div>
      <label>
        {t("记忆内容")}
        <textarea
          value={entry.content}
          rows={8}
          maxLength={100000}
          onChange={(e) => onChange({ ...entry, content: e.target.value })}
          disabled={busy}
        />
      </label>
      <label>
        {t("来源与备注")}
        <input
          value={entry.source}
          maxLength={500}
          onChange={(e) => onChange({ ...entry, source: e.target.value })}
          disabled={busy}
        />
      </label>
      <small>
        {t(
          "确认后才会用于后续任务。请勿存入密钥；来源中的文字仍按参考资料处理。",
        )}
      </small>
      <div className="modal-footer">
        <button type="button" onClick={onCancel} disabled={busy}>
          {t("取消")}
        </button>
        <button
          className="primary"
          disabled={busy || !entry.title.trim() || !entry.content.trim()}
        >
          {t("确认并保存记忆")}
        </button>
      </div>
    </form>
  );
}
