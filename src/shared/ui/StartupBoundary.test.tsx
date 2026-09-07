import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StartupBoundary } from "./StartupBoundary";
import { changeLanguage } from "../i18n";
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await changeLanguage("zh-CN");
});
it("provides an English recovery action after a failed resource without exposing the exception", async () => {
  await changeLanguage("en");
  vi.spyOn(console, "error").mockImplementation(() => {});
  function FailedModule(): never {
    throw new Error("Private resource details");
  }
  render(
    <StartupBoundary>
      <FailedModule />
    </StartupBoundary>,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Unable to open the workspace",
  );
  expect(screen.getByRole("button", { name: "Reopen" })).toBeTruthy();
  expect(screen.queryByText("Private resource details")).toBeNull();
});
