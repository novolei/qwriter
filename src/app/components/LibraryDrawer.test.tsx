import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { LibraryDrawer } from "./LibraryDrawer";

afterEach(cleanup);
it("focuses drawer search and restores the actual opener when dismissed", async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <div className="app">
        <button className="library-toggle">Editor toggle</button>
        <button onClick={() => setOpen(true)}>Rail library</button>
        <LibraryDrawer compact open={open} onClose={() => setOpen(false)}>
          <div className="search">
            <input aria-label="Library search" />
          </div>
        </LibraryDrawer>
      </div>
    );
  }
  render(<Example />);
  const trigger = screen.getByRole("button", { name: "Rail library" });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  const input = await screen.findByRole("textbox", { name: "Library search" });
  await waitFor(() => expect(document.activeElement).toBe(input));
  fireEvent.keyDown(input, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
