import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ModelBackupPanel } from "./ModelBackupPanel";
import { useModels } from "../useModels";
import { MODEL_STORAGE_KEY, loadWorkspace } from "../persistence";
import { exportBackup } from "./format";
import { saveBackupFile } from "./files";
import { changeLanguage } from "../../../shared/i18n";
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false }));
vi.mock("./files", () => ({
  saveBackupFile: vi.fn().mockResolvedValue("downloaded"),
}));
function Harness() {
  const store = useModels();
  return (
    <div className="app">
      <ModelBackupPanel store={store} />
      <output aria-label="provider-count">{store.providers.length}</output>
      <output aria-label="current-model">{store.config.id}</output>
    </div>
  );
}
function file(json: string, name = "models.json") {
  const result = new File([json], name, { type: "application/json" });
  Object.defineProperty(result, "text", { value: () => Promise.resolve(json) });
  return result;
}
function choose(value: File) {
  fireEvent.change(screen.getByLabelText("模型备份文件"), {
    target: { files: [value] },
  });
}
beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  await changeLanguage("zh-CN");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("previews duplicates, imports explicit copies, persists them and preserves the active model", async () => {
  const source = loadWorkspace();
  render(<Harness />);
  choose(file(exportBackup(source)));
  await screen.findByText("已存在，跳过");
  expect(
    (screen.getByRole("button", { name: "确认导入" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.getByLabelText("provider-count").textContent).toBe("1");
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: "创建独立副本" }));
  fireEvent.click(screen.getByRole("button", { name: "确认导入" }));
  expect(screen.getByText("已导入 1 个供应商、1 个模型")).toBeTruthy();
  expect(screen.getByLabelText("provider-count").textContent).toBe("2");
  expect(screen.getByLabelText("current-model").textContent).toBe(
    source.selected,
  );
  expect(loadWorkspace().providers).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: /导出模型配置/ }));
  await waitFor(() => expect(saveBackupFile).toHaveBeenCalledTimes(1));
});

it("keeps existing settings when storage fails and lets the user retry", async () => {
  const source = loadWorkspace();
  source.providers[0].name = "Imported";
  render(<Harness />);
  const before = localStorage.getItem(MODEL_STORAGE_KEY);
  choose(file(exportBackup(source)));
  await screen.findByText("Imported");
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("quota");
    });
  fireEvent.click(screen.getByRole("button", { name: "确认导入" }));
  expect(screen.getByRole("alert").textContent).toBe(
    "模型配置保存失败，未导入任何配置",
  );
  expect(localStorage.getItem(MODEL_STORAGE_KEY)).toBe(before);
  expect(screen.getByLabelText("provider-count").textContent).toBe("1");
  write.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "确认导入" }));
  expect(screen.getByLabelText("provider-count").textContent).toBe("2");
});

it("rejects malformed imports without changing the pool and cancels pending previews", async () => {
  render(<Harness />);
  choose(file("{}"));
  expect((await screen.findByRole("alert")).textContent).toContain("格式无效");
  choose(file(exportBackup(loadWorkspace())));
  await screen.findByText("已存在，跳过");
  fireEvent.click(screen.getByRole("button", { name: "取消导入" }));
  expect(screen.queryByRole("button", { name: "确认导入" })).toBeNull();
  expect(screen.getByLabelText("provider-count").textContent).toBe("1");
});

it("ignores a stale file read when a newer file has been chosen", async () => {
  render(<Harness />);
  let finish!: (value: string) => void;
  const old = new File(["old"], "old.json");
  Object.defineProperty(old, "text", {
    value: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  });
  choose(old);
  choose(file(exportBackup(loadWorkspace()), "new.json"));
  await screen.findByText("new.json");
  await act(async () => finish("invalid"));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("new.json")).toBeTruthy();
});

it("renders English controls and error recovery without hardcoded Chinese", async () => {
  await changeLanguage("en");
  render(<Harness />);
  expect(screen.getByRole("button", { name: /Choose a backup/ })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Model backup file"), {
    target: { files: [file("{}")] },
  });
  expect((await screen.findByRole("alert")).textContent).toContain(
    "unsupported version",
  );
});
