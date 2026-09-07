import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "./Modal";
import { Select } from "./Select";
afterEach(cleanup);

it("closes the topmost select on Escape and returns focus without dismissing its dialog", async () => {
  const close = vi.fn();
  function Example() {
    const [value, setValue] = useState("sans");
    return (
      <div className="app dark">
        <Modal title="Fonts" onClose={close}>
          <Select aria-label="Font" value={value} onValueChange={setValue}>
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
          </Select>
        </Modal>
      </div>
    );
  }
  render(<Example />);
  const trigger = screen.getByRole("combobox", { name: "Font" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const selected = await screen.findByRole("option", { name: "Sans" });
  expect(selected.closest(".app.dark")).toBeTruthy();
  fireEvent.keyDown(selected, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  expect(close).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(screen.getByRole("dialog", { name: "Fonts" })).toBeTruthy();
});
