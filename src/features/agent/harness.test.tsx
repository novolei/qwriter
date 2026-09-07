import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useHarness } from "./useHarness";
import type { Asset } from "../../shared/ipc/bindings";
const media = vi.hoisted(() => ({
  chooseAsset: vi.fn(),
  importAsset: vi.fn(),
  getAsset: vi.fn(),
}));
vi.mock("../../shared/media/assets", () => media);
const config = {
  id: "local",
  name: "Local",
  provider: "Ollama",
  baseUrl: "http://localhost:11434/v1",
  model: "local",
  apiKey: "",
  protocol: "openai",
};
const asset = (id: string): Asset => ({
  id,
  name: id,
  mime: "image/png",
  size: 100,
  width: 10,
  height: 10,
});
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);
it("tolerates malformed preferences and disables explicit thinking for unconfigured models", () => {
  localStorage.setItem("qwriter.harness.v1", "null");
  const { result } = renderHook(() => useHarness(config, "one"));
  expect(result.current.options.thinking).toBe("auto");
  act(() =>
    result.current.setPreferences({
      thinking: "on",
      effort: "high",
      maxRounds: 10,
      memoryEnabled: true,
    }),
  );
  expect(result.current.options.thinking).toBe("auto");
  expect(result.current.options.memoryEnabled).toBe(true);
  expect(JSON.parse(localStorage.getItem("qwriter.harness.v1")!).effort).toBe(
    "high",
  );
});
it("ignores a slow import after switching documents while preserving the new import", async () => {
  let oldResolve!: (value: Asset) => void;
  media.chooseAsset.mockImplementationOnce(
    () =>
      new Promise<Asset>((r) => {
        oldResolve = r;
      }),
  );
  const { result, rerender } = renderHook(({ id }) => useHarness(config, id), {
    initialProps: { id: "one" },
  });
  let old!: Promise<void>;
  act(() => {
    old = result.current.addImage();
  });
  rerender({ id: "two" });
  media.chooseAsset.mockResolvedValueOnce(asset("new"));
  await act(() => result.current.addImage());
  await act(async () => {
    oldResolve(asset("old"));
    await old;
  });
  expect(result.current.images.map((a) => a.id)).toEqual(["new"]);
  expect(result.current.loading).toBe(false);
});
it("deduplicates attachments and reports an overflow rather than silently dropping one", async () => {
  const { result } = renderHook(() => useHarness(config, "one"));
  act(() =>
    result.current.setImages([asset("1"), asset("2"), asset("3"), asset("4")]),
  );
  media.chooseAsset.mockResolvedValueOnce(asset("4"));
  await act(() => result.current.addImage());
  expect(result.current.images).toHaveLength(4);
  expect(result.current.error).toBe("");
  media.chooseAsset.mockResolvedValueOnce(asset("5"));
  await act(() => result.current.addImage());
  expect(result.current.images).toHaveLength(4);
  expect(result.current.error).toBeTruthy();
});
