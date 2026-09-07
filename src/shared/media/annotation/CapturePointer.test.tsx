import { createRef } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CapturePointer } from "./CapturePointer";
import type { ScreenCapture } from "../../ipc/bindings";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("releases a click before selecting a window and preserves manual drags", async () => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const host = createRef<HTMLDivElement>();
  const select = vi.fn();
  const screen: ScreenCapture = {
    id: "capture",
    path: "capture.png",
    screen: {
      id: 1,
      name: "Test",
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      scale: 1,
      primary: true,
    },
    windows: [{ x: 30, y: 40, width: 300, height: 200 }],
  };
  const { container } = render(
    <div ref={host}>
      <div className="screenshots-background" />
      <CapturePointer
        host={host}
        url="test.png"
        size={{ width: 800, height: 600 }}
        screen={screen}
        selected={false}
        onSelect={select}
      />
    </div>,
  );
  const background = container.querySelector(".screenshots-background")!;
  const released = vi.fn(() => expect(select).not.toHaveBeenCalled());
  window.addEventListener("mouseup", released, { once: true });
  fireEvent.mouseDown(background, { button: 0, clientX: 90, clientY: 80 });
  fireEvent.mouseUp(window, { button: 0, clientX: 90, clientY: 80 });
  expect(released).toHaveBeenCalledOnce();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(select).toHaveBeenCalledWith(screen.windows![0]);
  select.mockClear();
  fireEvent.mouseDown(background, { button: 0, clientX: 90, clientY: 80 });
  fireEvent.mouseUp(window, { button: 0, clientX: 180, clientY: 180 });
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(select).not.toHaveBeenCalled();
  vi.useRealTimers();
});
