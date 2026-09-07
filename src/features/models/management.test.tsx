import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commands } from "../../shared/ipc/bindings";
import { ModelSettings } from "./ModelSettings";
import { ModelSwitcher } from "./ModelSwitcher";
import { useModels } from "./useModels";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("../../shared/ipc/bindings", () => ({
  commands: {
    listModels: vi.fn(),
    modelVerify: vi.fn(),
    credentialRead: vi.fn(),
    credentialWrite: vi.fn(),
    credentialRemove: vi.fn(),
  },
}));
function Workspace() {
  const store = useModels();
  return (
    <div className="app">
      <ModelSettings
        models={store}
        onClose={() => {}}
        onAppearance={() => {}}
      />
      <output aria-label="active-model">{store.config.model}</output>
    </div>
  );
}
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);
it("supports provider creation, key entry, discovery, adding multiple models and explicit activation", async () => {
  vi.mocked(commands.listModels).mockResolvedValue({
    data: [{ id: "model-a" }, { id: "model-b" }],
    elapsedMs: 120,
  });
  render(<Workspace />);
  fireEvent.click(screen.getByTitle("添加供应商"));
  fireEvent.change(screen.getByLabelText("API Key"), {
    target: { value: "TEST-SESSION" },
  });
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "连接并获取模型" })),
  );
  expect(commands.listModels).toHaveBeenCalledWith(
    expect.objectContaining({ provider: "DeepSeek", apiKey: "TEST-SESSION" }),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "model-a" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "model-b" }));
  fireEvent.click(screen.getByRole("button", { name: "添加所选（2）" }));
  expect(screen.getByLabelText("active-model").textContent).toBe("qwen3:8b");
  fireEvent.click(screen.getByRole("button", { name: /^我的模型池\s*3$/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "搜索模型池" }), {
    target: { value: "model-b" },
  });
  fireEvent.click(screen.getByRole("button", { name: "切换到此模型" }));
  expect(screen.getByLabelText("active-model").textContent).toBe("model-b");
  vi.mocked(commands.modelVerify).mockResolvedValue({
    toolsSupported: true,
    elapsedMs: 700,
  });
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "验证 Agent" })),
  );
  expect(screen.getByText("模型与 Agent 已就绪")).toBeTruthy();
  expect(commands.modelVerify).toHaveBeenCalledWith(
    expect.objectContaining({ model: "model-b", apiKey: "TEST-SESSION" }),
  );
  expect(localStorage.getItem("qwriter.model-workspace.v1")).not.toContain(
    "TEST-SESSION",
  );
});
it("filters the model switcher and commits a keyboard selection", async () => {
  localStorage.setItem(
    "qwriter.model-workspace.v1",
    JSON.stringify({
      version: 1,
      providers: [
        {
          id: "p",
          name: "Local",
          kind: "Ollama",
          baseUrl: "http://localhost:11434/v1",
          protocol: "openai",
        },
      ],
      models: [
        { id: "a", providerId: "p", model: "a", name: "First", enabled: true },
        { id: "b", providerId: "p", model: "b", name: "Second", enabled: true },
      ],
      selected: "a",
    }),
  );
  function Picker() {
    const store = useModels();
    return (
      <div className="app">
        <ModelSwitcher store={store} disabled={false} onSettings={() => {}} />
        <output>{store.config.model}</output>
      </div>
    );
  }
  render(<Picker />);
  fireEvent.click(screen.getByRole("button", { name: "切换写作模型" }));
  const input = screen.getByRole("combobox", { name: "搜索并切换模型" });
  fireEvent.change(input, { target: { value: "Second" } });
  await waitFor(() =>
    expect(screen.queryByRole("option", { name: /First/ })).toBeNull(),
  );
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("status").textContent).toBe("b");
});
