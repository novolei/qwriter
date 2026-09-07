import { Command } from "cmdk";
import { ArrowUpRight, FileText, Search, type LucideIcon } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { t } from "../../shared/i18n/index";
import type { Doc } from "../../shared/types";
import { Modal } from "../../shared/ui/Modal";
import { searchDocuments } from "./search";

export type WorkspaceAction = {
  id: string;
  label: string;
  keywords?: string;
  icon: LucideIcon;
  shortcut?: string;
  run: () => void;
};
type Props = {
  docs: Doc[];
  active: string;
  actions: WorkspaceAction[];
  onSelect: (doc: Doc) => void;
  onClose: () => void;
};
export function CommandPalette({
  docs,
  active,
  actions,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const hits = searchDocuments(docs, deferred);
  const terms = deferred.toLocaleLowerCase().trim().split(/\s+/);
  const filtered = actions.filter((action) =>
    terms.every((term) =>
      `${action.label} ${action.keywords ?? ""}`
        .toLocaleLowerCase()
        .includes(term),
    ),
  );
  const first = hits[0]
    ? `doc:${hits[0].doc.id}`
    : filtered[0]
      ? `action:${filtered[0].id}`
      : "";
  const [selected, setSelected] = useState(first);
  useEffect(() => setSelected(first), [deferred, first]);
  function perform(action: () => void) {
    onClose();
    // Let the dialog restore focus before the selected action opens another surface.
    requestAnimationFrame(action);
  }
  return (
    <Modal
      title={t("快速抵达")}
      eyebrow={t("QWRITER · GO TO")}
      onClose={onClose}
      className="command-modal"
    >
      <Command
        label={t("搜索文稿与操作")}
        shouldFilter={false}
        value={selected}
        onValueChange={setSelected}
        loop
      >
        <div className="command-search">
          <Search size={19} />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={t("搜索文稿，或输入一个操作…")}
            aria-label={t("搜索文稿与操作")}
          />
          <kbd>Esc</kbd>
        </div>
        <Command.List>
          {!hits.length && !filtered.length && (
            <Command.Empty>
              <Search size={25} />
              <p>{t("暂时没有找到")}</p>
              <small>{t("试试文稿中的词句，或输入「设置」「专注」。")}</small>
            </Command.Empty>
          )}
          {!!hits.length && (
            <Command.Group
              heading={t(deferred.trim() ? "匹配文稿" : "最近写作")}
            >
              {hits.map(({ doc, excerpt }) => (
                <Command.Item
                  key={doc.id}
                  value={`doc:${doc.id}`}
                  onSelect={() => perform(() => onSelect(doc))}
                >
                  <span className="command-icon">
                    <FileText size={17} />
                  </span>
                  <span className="command-copy">
                    <strong>{doc.title || t("未命名文稿")}</strong>
                    <small>{excerpt || t("在这里开始你的故事")}</small>
                  </span>
                  {doc.id === active ? (
                    <span className="command-current">{t("当前")}</span>
                  ) : (
                    <ArrowUpRight size={14} />
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          )}
          {!!filtered.length && (
            <Command.Group heading={t("快捷操作")}>
              {filtered.map(({ id, label, icon: Icon, shortcut, run }) => (
                <Command.Item
                  key={id}
                  value={`action:${id}`}
                  onSelect={() => perform(run)}
                >
                  <span className="command-icon">
                    <Icon size={17} />
                  </span>
                  <span className="command-copy">
                    <strong>{label}</strong>
                  </span>
                  {shortcut && <kbd>{shortcut}</kbd>}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
        <div className="command-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t("选择")}
          </span>
          <span>
            <kbd>↵</kbd> {t("打开")}
          </span>
          <span>{t("文稿搜索仅在本机进行")}</span>
        </div>
      </Command>
    </Modal>
  );
}
