import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Tooltip } from "./Tooltip";

afterEach(cleanup);
it("shows a pointer hint without invoking the navigation action", async () => {
  const open = vi.fn();
  render(
    <Tooltip label="Open library">
      <button onClick={open}>Library</button>
    </Tooltip>,
  );
  const button = screen.getByRole("button", { name: "Library" });
  fireEvent.pointerMove(button, { pointerType: "mouse" });
  expect((await screen.findByRole("tooltip")).textContent).toBe("Open library");
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(open).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
});
it("describes a keyboard-focused icon and dismisses the hint with Escape", async () => {
  render(
    <div className="app dark">
      <Tooltip label="Open library">
        <button aria-label="Library">Library</button>
      </Tooltip>
    </div>,
  );
  const button = screen.getByRole("button", { name: "Library" });
  act(() => button.focus());
  const hint = await screen.findByRole("tooltip");
  expect(hint.textContent).toBe("Open library");
  expect(hint.closest(".app.dark")).toBeTruthy();
  expect(button.getAttribute("aria-describedby")).toBe(hint.id);
  fireEvent.keyDown(button, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  expect(document.activeElement).toBe(button);
});
