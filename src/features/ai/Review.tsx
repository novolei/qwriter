import { diffLines } from "diff";
import { useMemo } from "react";
import { t } from "../../shared/i18n/index";
import { Modal } from "../../shared/ui/Modal";
export function Review({
  before,
  after,
  onApply,
  onClose,
  busy,
}: {
  before: string;
  after: string;
  onApply: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const changes = useMemo(
    () =>
      diffLines(before, after, {
        timeout: 150,
        maxEditLength: 4000,
      }),
    [before, after],
  );
  return (
    <Modal
      title={t("审阅文稿修改")}
      eyebrow={t("YOUR VOICE, YOUR CHOICE")}
      wide
      onClose={onClose}
    >
      <p>{t("绿色为新增，红色为删除。应用前会保留当前文稿的历史版本。")}</p>
      {changes ? (
        <div className="diff-preview">
          {changes.map((part, i) => (
            <div
              key={i}
              className={
                part.added
                  ? "diff-add"
                  : part.removed
                    ? "diff-remove"
                    : "diff-same"
              }
            >
              <span
                aria-label={
                  part.added
                    ? t("新增")
                    : part.removed
                      ? t("删除")
                      : t("未变化")
                }
              >
                {part.added ? "+" : part.removed ? "−" : " "}
              </span>
              <pre>{part.value}</pre>
            </div>
          ))}
        </div>
      ) : (
        <div className="diff-columns">
          <section>
            <h3>{t("修改前")}</h3>
            <pre>{before}</pre>
          </section>
          <section>
            <h3>{t("修改后")}</h3>
            <pre>{after}</pre>
          </section>
        </div>
      )}
      <div className="modal-footer">
        <button onClick={onClose}>{t("继续斟酌")}</button>
        <button className="primary" disabled={busy} onClick={onApply}>
          {busy ? t("正在保存…") : t("采纳修改")}
        </button>
      </div>
    </Modal>
  );
}
