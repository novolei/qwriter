import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { Modal } from "./Modal";
afterEach(cleanup);

it("focuses the new composer when switching from a result dialog", async () => {
  function Flow() {
    const [step, setStep] = useState(0);
    return (
      <div className="app">
        {step === 0 ? (
          <Modal key="result" title="Result" onClose={() => {}}>
            <button onClick={() => setStep(1)}>Keep as note</button>
          </Modal>
        ) : (
          <Modal key="composer" title="Note" onClose={() => {}}>
            <textarea data-autofocus aria-label="Idea" />
          </Modal>
        )}
      </div>
    );
  }
  render(<Flow />);
  fireEvent.click(await screen.findByRole("button", { name: "Keep as note" }));
  const input = await screen.findByRole("textbox", { name: "Idea" });
  await waitFor(() => expect(document.activeElement).toBe(input));
});

it("returns focus to the opener after the dialog is dismissed", async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <div className="app">
        <button onClick={() => setOpen(true)}>Settings</button>
        {open && (
          <Modal title="Preferences" onClose={() => setOpen(false)}>
            <input aria-label="Name" />
          </Modal>
        )}
      </div>
    );
  }
  render(<Example />);
  const trigger = screen.getByRole("button", { name: "Settings" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog");
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
