import { Check, FileText, Search } from "lucide-react";
import { useState } from "react";
import { t } from "../../shared/i18n/index";
import type { Doc } from "../../shared/types";
import { Modal } from "../../shared/ui/Modal";

export function ReferencePicker({
  docs,
  currentId,
  selected,
  onChange,
  onClose,
}: {
  docs: Doc[];
  currentId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const options = docs.filter(
    (doc) =>
      doc.id !== currentId &&
      doc.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <Modal
      title={t("选择参考文稿")}
      eyebrow={t("WRITING CONTEXT")}
      onClose={onClose}
      className="reference-modal"
    >
      <p>{t("仅将选中的内容提供给本次任务，最多 10 篇。")}</p>
      <div className="reference-search">
        <Search size={16} />
        <input
          autoFocus
          aria-label={t("搜索参考文稿")}
          placeholder={t("搜索文稿…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="reference-list">
        {options.map((doc) => (
          <label
            key={doc.id}
            className={selected.includes(doc.id) ? "selected" : ""}
          >
            <input
              type="checkbox"
              checked={selected.includes(doc.id)}
              disabled={!selected.includes(doc.id) && selected.length >= 10}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, doc.id]
                    : selected.filter((id) => id !== doc.id),
                )
              }
            />
            <FileText size={16} />
            <span>{doc.title || t("未命名文稿")}</span>
            {selected.includes(doc.id) && <Check size={14} />}
          </label>
        ))}
        {!options.length && <p>{t("没有其他匹配的文稿")}</p>}
      </div>
      <div className="modal-footer">
        <small>{t("已选 {{count}} 篇", { count: selected.length })}</small>
        <button className="primary" onClick={onClose}>
          {t("完成")}
        </button>
      </div>
    </Modal>
  );
}
