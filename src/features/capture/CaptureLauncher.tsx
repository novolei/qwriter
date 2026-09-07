import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Monitor, ImagePlus, ScanLine } from "lucide-react";
import {
  commands,
  type Screen,
  type CaptureEnvironment,
} from "../../shared/ipc/bindings";
import { chooseAsset, type Asset } from "../../shared/media/assets";
import { t, errorText, language } from "../../shared/i18n";
import { CaptureDiagnostics } from "./desktop/CaptureDiagnostics";
import { Modal } from "../../shared/ui/Modal";
export function CaptureLauncher({
  onClose,
  onImage,
}: {
  onClose: () => void;
  onImage: (asset: Asset) => void;
}) {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [error, setError] = useState("");
  const [environment, setEnvironment] = useState<CaptureEnvironment>();
  const [loading, setLoading] = useState(isTauri());
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => {
    if (!isTauri()) return;
    const run = ++generation.current;
    setLoading(true);
    setError("");
    void Promise.allSettled([
      commands.captureScreens(),
      commands.captureEnvironment(language()),
    ]).then(([screens, environment]) => {
      if (run !== generation.current) return;
      if (screens.status === "fulfilled") setScreens(screens.value);
      else {
        setScreens([]);
        setError(errorText(screens.reason));
      }
      if (environment.status === "fulfilled") setEnvironment(environment.value);
      else setError(errorText(environment.reason));
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t("捕捉此刻")}
      eyebrow={t("A MOMENT, KEPT")}
      onClose={onClose}
      className="capture-launcher"
    >
      <p className="capture-intro">
        {t("框选屏幕的一角，把看见的美好留在身边。")}
      </p>
      {isTauri() && (
        <div className="capture-displays-heading">
          <span>{t(loading ? "正在检测显示器…" : "选择要捕捉的显示器")}</span>
          <button
            className="quiet-button"
            disabled={loading || busy}
            onClick={refresh}
          >
            {t("刷新")}
          </button>
        </div>
      )}
      {!loading && isTauri() && !screens.length && (
        <p className="capture-hint">
          {t("未检测到可用显示器，请连接显示器后刷新。")}
        </p>
      )}
      <div className="screen-choices">
        {screens.map((screen) => (
          <button
            disabled={busy || loading || environment?.screenAccess === false}
            key={screen.id}
            onClick={() =>
              void run(async () => {
                await commands.captureOpen("screenshot", screen.id);
                onClose();
              })
            }
          >
            <Monitor size={24} />
            <span>
              <strong>
                {screen.name || t("显示器")}
                {screen.primary && <small> · {t("主显示器")}</small>}
              </strong>
              <small>
                {screen.width} × {screen.height}
              </small>
            </span>
            <ScanLine size={17} />
          </button>
        ))}
      </div>
      <button
        disabled={busy}
        className="capture-image-choice"
        onClick={() =>
          void run(async () => {
            const asset = await chooseAsset("image");
            if (asset) onImage(asset);
          })
        }
      >
        <ImagePlus size={21} />
        <span>
          <strong>{t("打开图片进行标注")}</strong>
          <small>{t("也可以继续处理已有截图")}</small>
        </span>
      </button>
      {!isTauri() && (
        <p className="capture-hint">
          {t(
            "系统截图和全局快捷键在桌面版可用。浏览器预览可以打开图片体验标注、识字和长图拼接。",
          )}
        </p>
      )}
      {environment && (
        <CaptureDiagnostics environment={environment} refresh={refresh} />
      )}
      {error && (
        <p className="capture-error" role="alert">
          {error}
        </p>
      )}
      <div className="capture-shortcut-list">
        <span>
          {t("随手速记")}
          <kbd>Ctrl / ⌘ + Alt + N</kbd>
        </span>
        <span>
          {t("复制后捕捉")}
          <kbd>Ctrl / ⌘ + Shift + Space</kbd>
        </span>
        <span>
          {t("框选截图")}
          <kbd>Ctrl / ⌘ + Alt + S</kbd>
        </span>
      </div>
      <p className="capture-hint">
        {t(
          "先在任意应用复制内容，再按捕捉快捷键；Qwriter 最小化时也能打开速记浮窗。",
        )}
      </p>
    </Modal>
  );
}
