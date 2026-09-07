import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commands, type ModelList } from "../../shared/ipc/bindings";
import { useConnection } from "./useConnection";
import type { Profile } from "../../shared/types";
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("../../shared/ipc/bindings", () => ({
  commands: { listModels: vi.fn(), modelVerify: vi.fn() },
}));
const profile: Profile = {
  id: "a",
  name: "DeepSeek",
  provider: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "TEST_ONLY",
  protocol: "openai",
  model: "flash",
};
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
it("rejects missing credentials without a request and permits manually registered models to be verified", async () => {
  const hook = renderHook((p: Profile) => useConnection(p), {
    initialProps: { ...profile, apiKey: "" },
  });
  await act(() => hook.result.current.run("discover"));
  expect(commands.listModels).not.toHaveBeenCalled();
  expect(hook.result.current.error).toContain("API Key");
  hook.rerender(profile);
  vi.mocked(commands.modelVerify).mockResolvedValue({
    toolsSupported: true,
    elapsedMs: 500,
  });
  await act(() => hook.result.current.run("verify"));
  expect(hook.result.current.verification?.toolsSupported).toBe(true);
  expect(commands.listModels).not.toHaveBeenCalled();
});
it("guards double clicks and ignores late discovery after changing provider and back", async () => {
  let finish!: (data: ModelList) => void;
  vi.mocked(commands.listModels).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const onDiscover = vi.fn();
  const hook = renderHook((p: Profile) => useConnection(p, { onDiscover }), {
    initialProps: profile,
  });
  act(() => {
    void hook.result.current.run("discover");
    void hook.result.current.run("discover");
  });
  expect(commands.listModels).toHaveBeenCalledTimes(1);
  hook.rerender({ ...profile, id: "other" });
  hook.rerender(profile);
  await act(async () => finish({ data: [{ id: "stale" }], elapsedMs: 1 }));
  expect(hook.result.current.models).toBeNull();
  expect(hook.result.current.busy).toBeNull();
  expect(onDiscover).not.toHaveBeenCalled();
});
