import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AnnotationBoundary } from "./AnnotationBoundary";
it("retains an exit and retries the original editor after a canvas crash", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const exit = vi.fn();
  let failing = true;
  function Vendor() {
    if (failing) throw new DOMException("Canvas is tainted", "SecurityError");
    return <span>Recovered editor</span>;
  }
  render(
    <AnnotationBoundary onCancel={exit}>
      <Vendor />
    </AnnotationBoundary>,
  );
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "退出截图" }));
  expect(exit).toHaveBeenCalledOnce();
  failing = false;
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  expect(screen.getByText("Recovered editor")).toBeTruthy();
});
