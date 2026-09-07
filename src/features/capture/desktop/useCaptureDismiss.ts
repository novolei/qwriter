import { useEffect } from "react";

/** The annotation editor and nested dialogs own their own Escape handling. */
export function useCaptureDismiss(enabled: boolean, dismiss: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const keydown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        event.isComposing ||
        document.querySelector(
          '[role="dialog"], [role="menu"], [role="listbox"]',
        )
      )
        return;
      event.preventDefault();
      dismiss();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [enabled, dismiss]);
}
