import { useEffect, useState } from "react";
import {
  commands,
  type CaptureEnvironment,
} from "../../../shared/ipc/bindings";
import { t, errorText } from "../../../shared/i18n";

export function CaptureDiagnostics({
  environment,
  refresh,
}: {
  environment: CaptureEnvironment;
  refresh: () => void;
}) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  return (
    <div className="capture-diagnostics">
      <p className="capture-hint">
        {t(
          environment.trayAvailable
            ? "Qwriter 运行时，最小化后仍可通过全局快捷键或系统托盘捕捉。关闭应用后快捷键会释放。"
            : "系统托盘暂不可用，仍可使用全局快捷键和应用内入口。",
        )}
      </p>
      {environment.platform === "macos" && !environment.screenAccess && (
        <div className="capture-access" role="status">
          <strong>{t("需要屏幕录制权限")}</strong>
          <p>
            {t(
              "请在 macOS 系统设置的隐私与安全性中，为 Qwriter 开启屏幕录制权限，然后退出并重新打开应用。",
            )}
          </p>
          <button
            disabled={requesting}
            onClick={() => {
              setRequesting(true);
              setError("");
              void commands
                .captureRequestAccess()
                .then(refresh)
                .catch((e) => setError(errorText(e)))
                .finally(() => setRequesting(false));
            }}
          >
            {t("请求屏幕录制权限")}
          </button>
        </div>
      )}
      {!!environment.shortcutErrors.length && (
        <p className="capture-error" role="alert">
          {t("以下快捷键被其他应用占用，仍可使用应用内入口：")}{" "}
          {environment.shortcutErrors.join(" · ")}
        </p>
      )}
      {error && (
        <p className="capture-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
