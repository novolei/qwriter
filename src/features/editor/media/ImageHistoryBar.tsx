import { Columns2, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { t } from "../../../shared/i18n";
import type { Asset } from "../../../shared/media/assets";
import type { ImageEditAction, ImageEditHistory } from "./image-edit-history";

export function ImageHistoryBar({
  history,
  asset,
  comparing,
  disabled,
  onChange,
  onCompare,
}: {
  history: ImageEditHistory;
  asset: Asset | null;
  comparing: boolean;
  disabled: boolean;
  onChange: (action: ImageEditAction) => void;
  onCompare: () => void;
}) {
  return (
    <div className="image-history-bar">
      <div
        className="image-history-actions"
        role="group"
        aria-label={t("图片编辑历史")}
      >
        <button
          title={t("撤销图片编辑")}
          disabled={disabled || history.cursor < 0}
          onClick={() => onChange({ type: "undo" })}
        >
          <Undo2 size={16} />
        </button>
        <button
          title={t("重做图片编辑")}
          disabled={disabled || history.cursor >= history.versions.length - 1}
          onClick={() => onChange({ type: "redo" })}
        >
          <Redo2 size={16} />
        </button>
        <button
          title={t("恢复原图")}
          disabled={disabled || history.cursor < 0}
          onClick={() => onChange({ type: "restore" })}
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="image-version-label" role="status" aria-live="polite">
        <span>
          {t(
            comparing
              ? "正在对比原图"
              : history.cursor < 0
                ? "原始图片"
                : "修改稿 · 未应用",
          )}
        </span>
        {asset?.width && asset.height ? (
          <small>
            {asset.width} × {asset.height}
          </small>
        ) : null}
      </div>
      <button
        aria-pressed={comparing}
        disabled={disabled || history.cursor < 0}
        onClick={onCompare}
      >
        <Columns2 size={15} />
        {t(comparing ? "返回修改稿" : "查看原图")}
      </button>
    </div>
  );
}
