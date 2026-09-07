import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";
afterEach(cleanup);
it("only opens explicitly registered source references and never model-supplied external links", () => {
  const open = vi.fn();
  render(
    <MarkdownPreview
      markdown="[Field notes](#knowledge-allowed) [Invented source](#knowledge-missing) [Outside](https://example.com) ![](https://example.com/tracker.png)"
      references={{ "#knowledge-allowed": open }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Field notes" }));
  expect(open).toHaveBeenCalledOnce();
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.queryByRole("link")).toBeNull();
  expect(document.querySelector("img[src]")).toBeNull();
});
