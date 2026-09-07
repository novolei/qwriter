import { beforeEach, expect, it, vi } from "vitest";
import { completeCapture } from "./completeCapture";
import { copyImage, importAsset } from "../assets";
vi.mock("../assets", () => ({ importAsset: vi.fn(), copyImage: vi.fn() }));
const asset = {
  id: "capture.png",
  name: "capture.png",
  mime: "image/png",
  size: 12,
  width: 1,
  height: 1,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(importAsset).mockResolvedValue(asset);
});
it("waits for clipboard completion before returning the captured asset", async () => {
  let resolve: () => void = () => {};
  vi.mocked(copyImage).mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const finished = vi.fn();
  const task = completeCapture(new Blob(), true, () => true).then(finished);
  await vi.waitFor(() => expect(copyImage).toHaveBeenCalledWith(asset));
  expect(finished).not.toHaveBeenCalled();
  resolve();
  await task;
  expect(finished).toHaveBeenCalledWith({ asset, notice: { copied: true } });
});
it("preserves the saved screenshot and offers a retry when the clipboard fails", async () => {
  vi.mocked(copyImage).mockRejectedValue(new Error("denied"));
  const result = await completeCapture(new Blob(), true, () => true);
  expect(result.asset).toBe(asset);
  expect(result.notice?.copied).toBe(false);
  expect(result.notice?.copyError).toBeTruthy();
});
it("does not alter the clipboard for document image edits or a cancelled session", async () => {
  await completeCapture(new Blob(), false, () => true);
  await completeCapture(new Blob(), true, () => false);
  expect(copyImage).not.toHaveBeenCalled();
});
