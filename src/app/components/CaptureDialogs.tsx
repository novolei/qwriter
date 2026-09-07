import { lazy, Suspense, useState } from "react";
import type { CaptureCopyNotice } from "../../shared/media/annotation/completeCapture";
import { Modal } from "../../shared/ui/Modal";
import { FeatureBoundary } from "../../shared/ui/FeatureBoundary";
import { t } from "../../shared/i18n";
import { newCard } from "../../features/capture/cards";
import { quickDraftKey } from "../../features/capture/drafts";
import { QuickComposer } from "../../features/capture/QuickComposer";
import { InspirationInbox } from "../../features/capture/InspirationInbox";
import { CaptureLauncher } from "../../features/capture/CaptureLauncher";
import { MediaDialog } from "../../features/editor/media/MediaDialog";
import type { useCaptureWorkspace } from "../useCaptureWorkspace";
const ScreenshotEditor = lazy(() =>
  import("../../features/capture/screenshot/ScreenshotEditor").then(
    (module) => ({ default: module.ScreenshotEditor }),
  ),
);
const ScreenshotResult = lazy(() =>
  import("../../features/capture/screenshot/ScreenshotResult").then(
    (module) => ({ default: module.ScreenshotResult }),
  ),
);
export function CaptureDialogs({
  capture,
}: {
  capture: ReturnType<typeof useCaptureWorkspace>;
}) {
  const [copyNotice, setCopyNotice] = useState<CaptureCopyNotice>();
  const close = () => capture.setPanel(null);
  const screenshot = () => capture.open("screenshot");
  return (
    <FeatureBoundary onClose={close} resetKey={capture.panel}>
      <Suspense
        fallback={
          <Modal title={t("正在打开…")} onClose={close}>
            <p role="status">{t("正在打开…")}</p>
          </Modal>
        }
      >
        {capture.panel === "inbox" && (
          <InspirationInbox
            store={capture.cards}
            onClose={close}
            onNew={() => capture.quickNote()}
            onEdit={capture.quickNote}
            onInsert={capture.insertCard}
            onScreenshot={screenshot}
          />
        )}
        {capture.panel === "note" && (
          <Modal
            title={t("随手速记")}
            eyebrow={t("LET AN IDEA LAND")}
            onClose={close}
            className="quick-note-modal"
          >
            <QuickComposer
              key={capture.card.id}
              initial={capture.card}
              draftKey={
                capture.card.revision
                  ? `qwriter.capture.edit.${capture.card.id}`
                  : quickDraftKey
              }
              onDismiss={close}
              onScreenshot={screenshot}
              onSaved={() => {
                void capture.cards.reload();
                capture.open("inbox");
              }}
            />
          </Modal>
        )}
        {capture.panel === "media" && (
          <MediaDialog
            initial={capture.asset}
            onClose={close}
            onInsert={capture.insert}
            target={capture.targetTitle}
          />
        )}
        {capture.panel === "screenshot" && (
          <CaptureLauncher
            onClose={close}
            onImage={(asset) => {
              capture.setAsset(asset);
              capture.setPanel("annotate");
            }}
          />
        )}
        {capture.panel === "annotate" && capture.asset && (
          <Modal
            title={t("截图与标注")}
            className="annotation-modal"
            wide
            onClose={close}
          >
            <ScreenshotEditor
              source={capture.asset}
              onCancel={close}
              onResult={(asset, notice) => {
                setCopyNotice(notice);
                capture.setAsset(asset);
                capture.setPanel("result");
              }}
            />
          </Modal>
        )}
        {capture.panel === "result" && capture.asset && (
          <Modal
            title={t("这一刻，已留住")}
            className="screenshot-modal"
            wide
            onClose={close}
          >
            <ScreenshotResult
              asset={capture.asset}
              notice={copyNotice}
              onNote={(text, asset) =>
                capture.quickNote(newCard({ text, assetIds: [asset.id] }))
              }
              onInsert={async (asset) => {
                capture.reviewAsset(asset);
              }}
              onEdit={(asset) => {
                capture.setAsset(asset);
                capture.setPanel("annotate");
              }}
            />
          </Modal>
        )}
      </Suspense>
    </FeatureBoundary>
  );
}
