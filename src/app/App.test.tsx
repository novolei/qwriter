import { chooseOption } from "../test/select";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changeLanguage } from "../shared/i18n/index";
import { App } from "./App";
const mock = vi.hoisted(() => ({ invoke: vi.fn(), stop: () => {} }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: mock.invoke,
  Channel: class {
    onmessage = (_e: unknown) => {};
  },
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async () => () => {},
    destroy: async () => {},
  }),
}));
const doc = {
  id: "test",
  title: "测试文稿",
  markdown: "# 原文\n\n认真感受生活。",
  updated: 1,
};
beforeEach(async () => {
  await changeLanguage("zh-CN");
  localStorage.clear();
  mock.invoke.mockReset();
  mock.invoke.mockImplementation(async (command, args) => {
    if (command === "cards_list") return [];
    if (command === "memory_list") return [];
    if (command === "capture_pending_insert") return null;
    if (command === "library_load")
      return { docs: [doc], revision: 1, location: "test.db" };
    if (command === "library_save") return args.expectedRevision + 1;
    if (command === "ai_stream") {
      args.onEvent.onmessage({ type: "started" });
      args.onEvent.onmessage({
        type: "delta",
        text: "# 修改后的文稿\n\n认真感受每一天。",
      });
      return "complete";
    }
  });
});
afterEach(cleanup);
async function openApp() {
  render(<App />);
  await waitFor(() =>
    expect(document.querySelector(".boot-overlay")).toBeNull(),
  );
}
it("keeps collapsed navigation connected to the library, knowledge and preferences", async () => {
  await openApp();
  fireEvent.click(screen.getByRole("button", { name: "切换文稿库" }));
  const rail = screen.getByRole("navigation", { name: "快捷导航" });
  expect(screen.queryByRole("complementary", { name: "文稿库" })).toBeNull();
  const knowledge = within(rail).getByRole("button", { name: "记忆与知识库" });
  act(() => knowledge.focus());
  fireEvent.click(knowledge);
  const dialog = await screen.findByRole("dialog", { name: "记忆与知识库" });
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(document.activeElement).toBe(knowledge));
  fireEvent.click(within(rail).getByRole("button", { name: "切换至夜读模式" }));
  expect(document.querySelector(".app.dark")).toBeTruthy();
  await act(() => changeLanguage("en"));
  expect(screen.getByRole("navigation", { name: "Quick navigation" })).toBe(
    rail,
  );
  expect(
    within(rail).getByRole("button", { name: "Switch to light mode" }),
  ).toBeTruthy();
  await act(() => changeLanguage("zh-CN"));
  fireEvent.click(within(rail).getByRole("button", { name: "设置" }));
  await screen.findByRole("dialog", { name: "模型与连接" });
  fireEvent.click(screen.getByRole("button", { name: "关闭弹窗" }));
  fireEvent.click(within(rail).getByRole("button", { name: "打开文稿库" }));
  expect(screen.queryByRole("navigation", { name: "快捷导航" })).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "搜索文稿" }),
  );
  expect(screen.getByRole("button", { name: "测试文稿" })).toBeTruthy();
  expect(document.querySelector(".tiptap")?.textContent).toContain("原文");
});
it("requires a review before replacing the document", async () => {
  await openApp();
  fireEvent.click(screen.getByRole("button", { name: /润色文字/ }));
  await screen.findByRole("button", { name: "审阅修改" });
  expect(screen.getByRole("heading", { name: "原文" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "审阅修改" }));
  expect(screen.getByRole("dialog", { name: "审阅文稿修改" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "采纳修改" }));
  await screen.findByRole("heading", { name: "修改后的文稿" });
});
it("switches UI language and Latin fonts independently without changing manuscript content", async () => {
  await openApp();
  fireEvent.click(screen.getByRole("button", { name: "阅读与排版" }));
  await chooseOption("界面语言", "English");
  await screen.findByRole("dialog", { name: "Appearance & fonts" });
  await chooseOption("Document Latin font", "Lora · Serif");
  await chooseOption("Interface Latin font", "Manrope · Sans serif");
  const root = document.querySelector<HTMLElement>(".app")!;
  expect(root.style.getPropertyValue("--ui-font")).toContain(
    "Manrope Variable",
  );
  expect(root.style.getPropertyValue("--document-font")).toContain(
    "Lora Variable",
  );
  expect(document.querySelector(".tiptap")?.textContent).toContain("原文");
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  cleanup();
  await openApp();
  expect(document.documentElement.lang).toBe("en");
  expect(
    document
      .querySelector<HTMLElement>(".app")!
      .style.getPropertyValue("--document-font"),
  ).toContain("Lora Variable");
  expect(screen.getByRole("heading", { name: "原文" })).toBeTruthy();
  expect(screen.getByText("Saved to disk")).toBeTruthy();
  await act(() => changeLanguage("zh-CN"));
  expect(screen.getByText("磁盘已保存")).toBeTruthy();
});
it("keeps provider configuration stable when selecting a translated option", async () => {
  await openApp();
  await act(() => changeLanguage("en"));
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const provider = screen.getByRole("combobox", {
    name: "Provider",
  });
  await chooseOption("Provider", "Qwen");
  expect(provider.textContent).toContain("Qwen");
  expect(
    screen.getByDisplayValue(
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  cleanup();
  await openApp();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(
    screen.getByRole("combobox", { name: "Provider" }).textContent,
  ).toContain("Qwen");
});
it("keeps feedback separate from the original and saves it as a new document", async () => {
  await openApp();
  fireEvent.click(screen.getByRole("button", { name: /提炼摘要/ }));
  await screen.findByRole("button", { name: "另存文稿" });
  expect(screen.queryByRole("button", { name: "审阅修改" })).toBeNull();
  expect(screen.getByRole("heading", { name: "原文" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "另存文稿" }));
  await screen.findByRole("heading", { name: "修改后的文稿" });
  expect(screen.getByRole("button", { name: "测试文稿" })).toBeTruthy();
});
it("cancel invokes Rust cancellation and partial text cannot replace the original", async () => {
  const base = mock.invoke.getMockImplementation()!;
  mock.invoke.mockImplementation((command, args) => {
    if (command === "ai_stream") {
      args.onEvent.onmessage({ type: "started" });
      args.onEvent.onmessage({ type: "delta", text: "部分结果" });
      return new Promise((resolve) => {
        mock.stop = () => resolve("cancelled");
      });
    }
    if (command === "ai_cancel") {
      mock.stop();
      return Promise.resolve();
    }
    return base(command, args);
  });
  await openApp();
  fireEvent.click(screen.getByRole("button", { name: /润色文字/ }));
  const stop = await screen.findByRole("button", { name: "停止生成" });
  await act(async () => {
    fireEvent.click(stop);
  });
  await screen.findByText("部分结果 · 尚未完成");
  expect(mock.invoke.mock.calls.some(([c]) => c === "ai_cancel")).toBe(true);
  expect(screen.queryByRole("button", { name: "审阅修改" })).toBeNull();
  expect(screen.getByRole("heading", { name: "原文" })).toBeTruthy();
});
