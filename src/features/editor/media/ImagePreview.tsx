import { lazy, Suspense, useEffect, useReducer, useRef, useState } from "react";
import { Download, Pencil, Scan, Check } from "lucide-react";
import { Modal } from "../../../shared/ui/Modal";
import { exportAsset } from "../../../shared/media/assets";
import { t, errorText } from "../../../shared/i18n";
import { ImageHistoryBar } from "./ImageHistoryBar";
import {
  emptyImageHistory,
  imageEditHistory,
  type ImageEditAction,
} from "./image-edit-history";
import { useImageSource, useImageUrl } from "./useImageSource";
const AnnotationEditor = lazy(() =>
  import("../../../shared/media/annotation/AnnotationEditor").then((m) => ({
    default: m.AnnotationEditor,
  })),
);

interface ImagePreviewProps {
  source: string;
  name: string;
  onApply: (id: string) => void;
  onClose: () => void;
}
export function ImagePreview(props: ImagePreviewProps) {
  return <ImagePreviewSession key={props.source} {...props} />;
}

function ImagePreviewSession({
  source,
  name,
  onApply,
  onClose,
}: ImagePreviewProps) {
  const imageSource = useImageSource(source, name);
  const [history, dispatch] = useReducer(imageEditHistory, emptyImageHistory);
  const draft = history.versions[history.cursor] ?? null;
  const [comparing, setComparing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState(false);
  const [natural, setNatural] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const working = useRef(false);
  const current = draft ?? imageSource.original;
  const displayed = comparing ? imageSource.original : current;
  const preview = useImageUrl(source, displayed);
  const { url } = preview;
  const problem = error || imageSource.error || preview.error;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function changeHistory(action: ImageEditAction) {
    dispatch(action);
    setComparing(false);
    setNatural(false);
    setFeedback("");
    setError("");
  }
  async function act(action: "edit" | "export") {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setFeedback("");
    setComparing(false);
    try {
      const asset = current ?? (await imageSource.resolveOriginal());
      if (!alive.current) return;
      if (action === "edit") setEditing(true);
      else {
        const saved = await exportAsset(asset);
        if (alive.current)
          setFeedback(t(saved ? "图片已导出，文稿未改变" : "已取消导出"));
      }
    } catch (error) {
      if (alive.current) setError(errorText(error));
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function apply() {
    try {
      if (draft) {
        onApply(draft.id);
        onClose();
      }
    } catch (error) {
      setConfirmClose(false);
      setError(errorText(error));
    }
  }
  return (
    <Modal
      title={t("图片预览与编辑")}
      eyebrow={t("IMAGE STUDIO")}
      className="image-preview-modal"
      draggable
      dismissible={!busy && !editing}
      onClose={() => {
        if (history.versions.length > 0) setConfirmClose(true);
        else onClose();
      }}
    >
      <div className="image-preview-toolbar">
        <span title={name}>{name || t("图片")}</span>
        <button
          onClick={() => setNatural(!natural)}
          disabled={editing}
          aria-pressed={natural}
        >
          <Scan size={15} />
          {t(natural ? "适应窗口" : "原始尺寸")}
        </button>
        <button
          onClick={() => void act("edit")}
          disabled={busy || editing || !url}
        >
          <Pencil size={15} />
          {t("裁剪与标注")}
        </button>
        <button
          onClick={() => void act("export")}
          disabled={busy || editing || !url}
        >
          <Download size={15} />
          {t("另存图片")}
        </button>
      </div>
      <ImageHistoryBar
        history={history}
        asset={displayed}
        comparing={comparing}
        disabled={editing || busy}
        onChange={changeHistory}
        onCompare={() => setComparing(!comparing)}
      />
      <div
        className={`image-preview-stage ${natural && !editing ? "natural-size" : ""}`}
      >
        {editing && current ? (
          <Suspense fallback={<p role="status">{t("正在打开…")}</p>}>
            <AnnotationEditor
              source={current}
              imageMode
              onCancel={() => setEditing(false)}
              onResult={(asset) => {
                if (alive.current) {
                  changeHistory({ type: "edit", asset });
                  setEditing(false);
                  setNatural(false);
                }
              }}
            />
          </Suspense>
        ) : url ? (
          <img
            src={url}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setError(t("素材暂不可用"))}
          />
        ) : (
          <p role="status">{t("正在打开…")}</p>
        )}
      </div>
      {problem && (
        <div className="image-preview-error" role="alert">
          {problem}
        </div>
      )}
      <div className="image-preview-footer">
        <small role="status">
          {feedback || t("编辑保留原图，应用后可在文稿中撤销")}
        </small>
        <button
          className="primary"
          disabled={!draft || editing || busy}
          onClick={apply}
        >
          <Check size={15} />
          {t("应用到文稿")}
        </button>
      </div>
      {confirmClose && (
        <Modal
          title={t("保留这次图片修改？")}
          className="image-close-modal"
          onClose={() => setConfirmClose(false)}
        >
          <p>{t("关闭后将丢弃此窗口的编辑历史，文稿中的图片保持不变。")}</p>
          <div className="image-close-actions">
            <button onClick={onClose}>{t("丢弃并关闭")}</button>
            <button data-autofocus onClick={() => setConfirmClose(false)}>
              {t("继续编辑")}
            </button>
            {draft && (
              <button className="primary" onClick={apply}>
                {t("应用并关闭")}
              </button>
            )}
          </div>
        </Modal>
      )}
    </Modal>
  );
}
