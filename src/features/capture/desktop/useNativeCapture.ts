import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import i18n, { language } from "../../../shared/i18n";
import { commands } from "../../../shared/ipc/bindings";

export function useNativeCapture() {
  useEffect(() => {
    if (!isTauri()) return;
    const sync = () => {
      void commands.captureEnvironment(language()).catch(() => {});
    };
    sync();
    i18n.on("languageChanged", sync);
    return () => {
      i18n.off("languageChanged", sync);
    };
  }, []);
}
