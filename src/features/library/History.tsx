import { useEffect, useState } from "react";
import { errorText, locale, t } from "../../shared/i18n/index";
import { commands } from "../../shared/ipc/bindings";
import type { Doc, Snapshot } from "../../shared/types";
import { Modal } from "../../shared/ui/Modal";
export function History({
  doc,
  flush,
  onRestore,
  onClose,
}: {
  doc: Doc;
  flush: () => Promise<void>;
  onRestore: (s: Snapshot) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Snapshot[]>([]);
  const [selected, setSelected] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("正在读取历史…");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void flush()
      .then(() => commands.libraryHistory(doc.id))
      .then((data) => {
        if (alive) {
          setItems(data);
          setSelected(data[0] ?? null);
          setMessage(
            data.length
              ? ""
              : "当前文稿还没有历史版本。修改并保存后，会自动保留上一个版本。",
          );
        }
      })
      .catch((e) => {
        if (alive) setMessage(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [doc.id]);
  return (
    <Modal
      title={t("文稿历史")}
      eyebrow={t("YOUR WORDS, KEPT SAFE")}
      onClose={onClose}
      wide
    >
      <p>{t("保留最近 50 次内容变化。恢复前会先保存当前版本。")}</p>
      {message && <p role="status">{t(message)}</p>}
      <div className="history-layout">
        <div className="history-list">
          {items.map((s) => (
            <button
              key={s.id}
              className={selected?.id === s.id ? "chosen" : ""}
              onClick={() => setSelected(s)}
            >
              <strong>{new Date(s.saved).toLocaleString(locale())}</strong>
              <small>
                {s.title} · {s.markdown.length}
                {t("字符")}
              </small>
            </button>
          ))}
        </div>
        {selected && (
          <div className="history-preview">
            <pre>{selected.markdown}</pre>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRestore(selected);
                  onClose();
                } catch (e) {
                  setMessage(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? t("正在恢复…") : t("恢复这个版本")}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
