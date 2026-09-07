import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Screenshots from "react-screenshots";

afterEach(cleanup);
it("the pinned vendor adapter accepts a window selection and reports its bounds", async () => {
  const selected = vi.fn();
  const bounds = { x: 40, y: 30, width: 400, height: 300 };
  const { rerender } = render(
    <Screenshots
      width={800}
      height={600}
      selectionRequest={bounds}
      onSelectionChange={selected}
    />,
  );
  await waitFor(() => expect(selected).toHaveBeenCalledWith(bounds));
  const next = { x: 80, y: 50, width: 320, height: 240 };
  rerender(
    <Screenshots
      width={800}
      height={600}
      selectionRequest={next}
      onSelectionChange={selected}
    />,
  );
  await waitFor(() => expect(selected).toHaveBeenLastCalledWith(next));
});
