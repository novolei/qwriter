import { afterEach, expect, it, vi } from "vitest";
import { canvasImageSource } from "./imageSource";

afterEach(() => vi.unstubAllGlobals());
it("materializes native protocol images as origin-clean blob URLs", async () => {
  const blob = new Blob(["pixels"], { type: "image/png" });
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, blob: async () => blob });
  vi.stubGlobal("fetch", fetcher);
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:local-image");
  const signal = new AbortController().signal;
  expect(
    await canvasImageSource("http://asset.localhost/capture/image.png", signal),
  ).toBe("blob:local-image");
  expect(fetcher).toHaveBeenCalledWith(
    "http://asset.localhost/capture/image.png",
    { signal },
  );
  expect(create).toHaveBeenCalledWith(blob);
});
it("does not create a URL for a cancelled or failed load", async () => {
  const controller = new AbortController();
  const create = vi.spyOn(URL, "createObjectURL");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  await expect(
    canvasImageSource("asset://missing", controller.signal),
  ).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok: true, blob: async () => new Blob(["pixels"]) }),
  );
  controller.abort();
  await expect(
    canvasImageSource("asset://cancelled", controller.signal),
  ).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
});
