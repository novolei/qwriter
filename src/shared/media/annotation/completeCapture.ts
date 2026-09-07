import { copyImage, importAsset } from "../assets";
import { t } from "../../i18n";

export interface CaptureCopyNotice {
  copied: boolean;
  copyError?: string;
}

/** Import succeeds independently of clipboard access; a failure remains recoverable in preview. */
export async function completeCapture(
  blob: Blob,
  copy: boolean,
  active: () => boolean,
) {
  const asset = await importAsset(
    blob,
    `Qwriter-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
  );
  let notice: CaptureCopyNotice | undefined;
  if (copy && active()) {
    try {
      await copyImage(asset);
      notice = { copied: true };
    } catch {
      notice = {
        copied: false,
        copyError: t("截图已保存，但自动复制失败；请在预览中重试复制图片。"),
      };
    }
  }
  return { asset, notice };
}
