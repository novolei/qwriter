import { renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCaptureDismiss } from "./useCaptureDismiss";

afterEach(cleanup);

function escape(options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
}

describe("capture Escape ownership", () => {
  it("dismisses the idle surface and removes its listener on unmount", () => {
    const dismiss = vi.fn();
    const { unmount } = renderHook(() => useCaptureDismiss(true, dismiss));
    expect(escape().defaultPrevented).toBe(true);
    expect(dismiss).toHaveBeenCalledOnce();
    unmount();
    escape();
    expect(dismiss).toHaveBeenCalledOnce();
  });
  it("leaves annotation, IME composition and nested dialogs in control", () => {
    const dismiss = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useCaptureDismiss(enabled, dismiss),
      { initialProps: { enabled: false } },
    );
    escape();
    rerender({ enabled: true });
    escape({ isComposing: true });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    try {
      escape();
    } finally {
      dialog.remove();
    }
    const consumed = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    consumed.preventDefault();
    window.dispatchEvent(consumed);
    expect(dismiss).not.toHaveBeenCalled();
  });
});
