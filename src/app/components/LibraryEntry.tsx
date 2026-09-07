import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useId } from "react";
import { t } from "../../shared/i18n/index";

export function LibraryEntry({
  compact,
  open,
  hint,
  onToggle,
  onDismiss,
}: {
  compact: boolean;
  open: boolean;
  hint: boolean;
  onToggle: () => void;
  onDismiss: () => void;
}) {
  const hintId = useId();
  const showHint = compact && !open && hint;
  return (
    <div className="library-entry">
      <button
        className="library-toggle"
        title={t("切换文稿库")}
        aria-label={t("切换文稿库")}
        aria-expanded={open}
        aria-describedby={showHint ? hintId : undefined}
        onClick={() => {
          onDismiss();
          onToggle();
        }}
      >
        {open ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        {compact && <span>{t("文稿库")}</span>}
      </button>
      {showHint && (
        <div className="library-collapse-hint">
          <span role="status" id={hintId}>
            {t("窗口变窄时，文稿库会自动收起。点击这里，随时展开。")}
          </span>
          <button
            aria-label={t("知道了，不再提示")}
            title={t("知道了，不再提示")}
            onClick={onDismiss}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
