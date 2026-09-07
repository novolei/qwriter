import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GitWorkspace } from "./GitWorkspace";
const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: mock.invoke,
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  mock.invoke.mockReset();
});
it("only submits explicitly selected files and includes the reviewed repository revision", async () => {
  localStorage.setItem("qwriter.git.path", JSON.stringify("fixture"));
  const repo = {
    path: "fixture",
    branch: "main",
    head: "abc",
    changes: [
      { path: "a.md", kind: "modified", staged: false },
      { path: "b.md", kind: "added", staged: false },
    ],
    history: [],
    truncated: false,
    authorName: "Writer",
    authorEmail: "writer@example.test",
    state: "Clean",
  };
  mock.invoke.mockImplementation(async (command) =>
    command === "git_inspect"
      ? repo
      : command === "git_file_diff"
        ? { text: "-before\n+after", truncated: false }
        : "commit-id",
  );
  render(
    <GitWorkspace
      doc={{ id: "doc", title: "文稿", markdown: "正文", updated: 1 }}
      onClose={() => {}}
    />,
  );
  const a = await screen.findByRole("checkbox", { name: "选择文件 a.md" });
  expect((a as HTMLInputElement).checked).toBe(false);
  expect(
    (
      screen.getByRole("checkbox", {
        name: "选择文件 b.md",
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /a.md/ }));
  await screen.findByText("+after");
  fireEvent.click(a);
  fireEvent.change(screen.getByRole("textbox", { name: "提交说明" }), {
    target: { value: "修订第一段" },
  });
  fireEvent.click(screen.getByRole("button", { name: /提交所选更改/ }));
  await waitFor(() =>
    expect(mock.invoke).toHaveBeenCalledWith("git_commit", {
      input: {
        path: "fixture",
        files: ["a.md"],
        message: "修订第一段",
        name: "Writer",
        email: "writer@example.test",
        expectedHead: "abc",
      },
    }),
  );
});
