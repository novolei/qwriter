import { Check, X } from "lucide-react";
import { Review } from "../../features/ai/Review";
import { GitWorkspace } from "../../features/git/GitWorkspace";
import { History } from "../../features/library/History";
import { ModelSettings } from "../../features/models/ModelSettings";
import { t } from "../../shared/i18n/index";
import type { Workspace } from "../useWorkspace";
type Props = Pick<
  Workspace,
  | "notice"
  | "setNotice"
  | "settings"
  | "modelStore"
  | "setSettings"
  | "setAppearance"
  | "history"
  | "current"
  | "library"
  | "restoreVersion"
  | "setHistory"
  | "gitWorkspace"
  | "setGitWorkspace"
  | "review"
  | "resultSelection"
  | "resultBase"
  | "proposed"
  | "applying"
  | "applyResult"
  | "setReview"
>;
export function WorkspaceDialogs(props: Props) {
  const {
    notice,
    setNotice,
    settings,
    modelStore,
    setSettings,
    setAppearance,
    history,
    current,
    library,
    restoreVersion,
    setHistory,
    gitWorkspace,
    setGitWorkspace,
    review,
    resultSelection,
    resultBase,
    proposed,
    applying,
    applyResult,
    setReview,
  } = props;
  return (
    <>
      {notice && (
        <div role="status" className="toast">
          <Check size={16} />
          {t(notice)}
          <button title={t("关闭提示")} onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {settings && (
        <ModelSettings
          models={modelStore}
          onClose={() => setSettings(false)}
          onAppearance={() => {
            setSettings(false);
            setAppearance(true);
          }}
        />
      )}
      {history && (
        <History
          doc={current}
          flush={library.flush}
          onRestore={restoreVersion}
          onClose={() => setHistory(false)}
        />
      )}
      {gitWorkspace && (
        <GitWorkspace doc={current} onClose={() => setGitWorkspace(false)} />
      )}
      {review && (
        <Review
          before={resultSelection?.markdown ?? resultBase}
          after={proposed}
          busy={applying}
          onApply={() => void applyResult()}
          onClose={() => setReview(false)}
        />
      )}
    </>
  );
}
