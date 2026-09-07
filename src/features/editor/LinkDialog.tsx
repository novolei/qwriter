import { t } from "../../shared/i18n/index";
import { Modal } from "../../shared/ui/Modal";

import type { ToolbarState } from "./useToolbar";
export function LinkDialog({
  dialog,
  setDialog,
  url,
  setUrl,
  label,
  setLabel,
  error,
  range,
  state,
  editor,
  submitLink,
}: Pick<
  ToolbarState,
  | "dialog"
  | "setDialog"
  | "url"
  | "setUrl"
  | "label"
  | "setLabel"
  | "error"
  | "range"
  | "state"
  | "editor"
  | "submitLink"
>) {
  return (
    <>
      {" "}
      {dialog && (
        <Modal
          title={t(dialog === "image" ? "插入图片" : "编辑链接")}
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitLink();
            }}
          >
            <label>
              {t(dialog === "image" ? "图片地址" : "链接地址")}
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t(
                  dialog === "image" ? "https://…" : "https://… 或 #标题锚点",
                )}
              />
            </label>
            <label>
              {t(dialog === "image" ? "图片替代文本" : "链接文字")}
              <input
                value={label}
                disabled={
                  dialog === "link" &&
                  (range.current.from !== range.current.to || !!state?.link)
                }
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            {dialog === "image" && (
              <small>
                {t("图片通过所填地址加载，Markdown 中保留地址和替代文本。")}
              </small>
            )}
            {dialog === "link" && (
              <small>
                {t("以 # 开头的链接可跳转到文内标题；中文标题可直接填写。")}
              </small>
            )}
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => {
                  if (dialog === "link" && state?.link)
                    editor
                      ?.chain()
                      .focus()
                      .setTextSelection(range.current)
                      .extendMarkRange("link")
                      .unsetLink()
                      .run();
                  setDialog(null);
                }}
              >
                {t(dialog === "link" && state?.link ? "移除链接" : "取消")}
              </button>
              <button className="primary" type="submit">
                {t("应用")}
              </button>
            </div>
          </form>
        </Modal>
      )}{" "}
    </>
  );
}
