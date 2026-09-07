import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commands } from "../../shared/ipc/bindings";
import { isTauri } from "@tauri-apps/api/core";
import { useModels } from "./useModels";
import {
  loadWorkspace,
  migrateProfiles,
  MODEL_STORAGE_KEY,
  normalizeWorkspace,
  serializeWorkspace,
} from "./persistence";
import type { Profile } from "../../shared/types";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn(() => false) }));
vi.mock("../../shared/ipc/bindings", () => ({
  commands: {
    credentialRead: vi.fn(),
    credentialWrite: vi.fn(),
    credentialRemove: vi.fn(),
  },
}));
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(isTauri).mockReturnValue(false);
});
afterEach(cleanup);
const oldProfile: Profile = {
  id: "a",
  name: "Private",
  provider: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  protocol: "openai",
  apiKey: "NEVER_PERSIST",
  model: "deepseek-v4-flash",
};
it("migrates existing accounts and selection without merging accounts or persisting secrets", () => {
  const data = migrateProfiles(
    [oldProfile, { ...oldProfile, id: "b", name: "Other account" }],
    "b",
  );
  expect(data.providers).toHaveLength(2);
  expect(data.selected).toBe("b");
  expect(serializeWorkspace(data)).not.toContain("NEVER_PERSIST");
  expect(
    normalizeWorkspace({
      ...data,
      providers: [{ ...data.providers[0], apiKey: "NEVER_PERSIST" }],
    })?.models,
  ).toHaveLength(1);
  localStorage.setItem(
    "qwriter.config",
    JSON.stringify({ model: null, baseUrl: 42 }),
  );
  expect(loadWorkspace().models[0].model).toBe("qwen3:8b");
});
it("shares a provider key across its models, preserves the primary on addition and persists the pool across restart", () => {
  const hook = renderHook(useModels);
  const previous = hook.result.current.config.id;
  let id = "";
  act(() => {
    id = hook.result.current.addProvider("DeepSeek");
  });
  act(() => {
    hook.result.current.addModels(id, ["model-a", "model-b", "model-a"]);
  });
  const provider = hook.result.current.providers.find((p) => p.id === id)!;
  act(() => hook.result.current.credentials.setKey(provider, "SESSION_ONLY"));
  expect(hook.result.current.config.id).toBe(previous);
  expect(
    hook.result.current.models.filter((m) => m.providerId === id),
  ).toHaveLength(2);
  for (const model of hook.result.current.models.filter(
    (m) => m.providerId === id,
  ))
    expect(hook.result.current.resolve(model).apiKey).toBe("SESSION_ONLY");
  const chosen = hook.result.current.models.find((m) => m.model === "model-b")!;
  act(() => hook.result.current.select(chosen.id));
  expect(localStorage.getItem(MODEL_STORAGE_KEY)).not.toContain("SESSION_ONLY");
  hook.unmount();
  const restarted = renderHook(useModels);
  expect(restarted.result.current.config.model).toBe("model-b");
  expect(restarted.result.current.config.apiKey).toBe("");
  act(() =>
    restarted.result.current.updateModel({ ...chosen, enabled: false }),
  );
  expect(restarted.result.current.config.id).not.toBe(chosen.id);
});
it("binds session credentials to origin and only removes a provider after its vault entry is removed", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  const data = migrateProfiles([oldProfile], "a");
  data.providers[0].credentialOrigin = "https://api.deepseek.com";
  localStorage.setItem(MODEL_STORAGE_KEY, serializeWorkspace(data));
  vi.mocked(commands.credentialRead).mockResolvedValue("VAULT_VALUE");
  const hook = renderHook(useModels);
  await waitFor(() =>
    expect(hook.result.current.config.apiKey).toBe("VAULT_VALUE"),
  );
  const p = hook.result.current.providers[0];
  act(() =>
    hook.result.current.updateProvider({
      ...p,
      baseUrl: "https://example.com/v1",
    }),
  );
  expect(hook.result.current.config.apiKey).toBe("");
  vi.mocked(commands.credentialRemove).mockRejectedValue(
    new Error("Cannot remove credential"),
  );
  await act(async () => {
    expect(await hook.result.current.removeProvider(p.id)).toBe(false);
  });
  expect(hook.result.current.providers).toHaveLength(1);
  vi.mocked(commands.credentialRemove).mockResolvedValue(null);
  await act(async () => {
    expect(await hook.result.current.removeProvider(p.id)).toBe(true);
  });
  expect(commands.credentialRemove).toHaveBeenLastCalledWith(
    "a",
    "https://api.deepseek.com",
  );
  expect(hook.result.current.models).toHaveLength(0);
  expect(hook.result.current.config.model).toBe("");
});
it("does not let a late vault read replace a newly entered key", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  let finish!: (key: string) => void;
  vi.mocked(commands.credentialRead).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const data = migrateProfiles([oldProfile], "a");
  data.providers[0].credentialOrigin = "https://api.deepseek.com";
  localStorage.setItem(MODEL_STORAGE_KEY, serializeWorkspace(data));
  const hook = renderHook(useModels);
  act(() =>
    hook.result.current.credentials.setKey(
      hook.result.current.providers[0],
      "NEW_SESSION",
    ),
  );
  await act(async () => finish("OLD_VAULT"));
  expect(hook.result.current.config.apiKey).toBe("NEW_SESSION");
  expect(localStorage.getItem(MODEL_STORAGE_KEY)).not.toMatch(
    /NEW_SESSION|OLD_VAULT/,
  );
});
