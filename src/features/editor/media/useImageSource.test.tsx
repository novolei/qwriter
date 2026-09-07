import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useImageSource, useImageUrl } from "./useImageSource";
import type { Asset } from "../../../shared/media/assets";

const asset = (id: string): Asset => ({
  id,
  name: "Image",
  mime: "image/png",
  width: 10,
  height: 10,
  size: 1,
});
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  url: vi.fn(),
  import: vi.fn(),
}));
vi.mock("../../../shared/media/assets", async (original) => ({
  ...(await original<typeof import("../../../shared/media/assets")>()),
  getAsset: mocks.get,
  assetUrl: mocks.url,
  importAsset: mocks.import,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("ignores late image URL results when switching the displayed revision", async () => {
  let finishOld!: (url: string) => void;
  mocks.url.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finishOld = resolve;
      }),
  );
  mocks.url.mockResolvedValueOnce("https://example.com/new.png");
  const { result, rerender } = renderHook(
    ({ image }) => useImageUrl("", image),
    { initialProps: { image: asset("old") } },
  );
  rerender({ image: asset("new") });
  await waitFor(() =>
    expect(result.current.url).toBe("https://example.com/new.png"),
  );
  await act(async () => finishOld("https://example.com/old.png"));
  expect(result.current.url).toBe("https://example.com/new.png");
});

it("cancels remote import when the preview closes without persisting the response", async () => {
  let receivedSignal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, options: RequestInit) => {
      receivedSignal = options.signal as AbortSignal;
      return new Promise((_resolve, reject) =>
        receivedSignal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      );
    }),
  );
  const { result, unmount } = renderHook(() =>
    useImageSource("https://example.com/image.png", "Image"),
  );
  const pending = result.current.resolveOriginal();
  const rejection = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  unmount();
  await rejection;
  expect(receivedSignal?.aborted).toBe(true);
  expect(mocks.import).not.toHaveBeenCalled();
});

it("resolves a local asset without treating its reference as a remote URL", async () => {
  const id = `${"a".repeat(64)}.png`;
  mocks.get.mockResolvedValue(asset(id));
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() =>
    useImageSource(`qwriter-asset://${id}`, "Image"),
  );
  await waitFor(() => expect(result.current.original?.id).toBe(id));
  expect((await result.current.resolveOriginal()).id).toBe(id);
  expect(fetch).not.toHaveBeenCalled();
});
