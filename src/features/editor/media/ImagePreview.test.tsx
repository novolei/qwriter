import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ImagePreview } from "./ImagePreview";
const exportImage = vi.hoisted(() => vi.fn(async () => true));
const source = `qwriter-asset://${"a".repeat(64)}.png`;
const edited = `${"b".repeat(64)}.png`;
vi.mock("../../../shared/media/assets", async (original) => ({
  ...(await original<typeof import("../../../shared/media/assets")>()),
  getAsset: async (id: string) => ({
    id,
    mime: "image/png",
    name: "Original",
    width: 400,
    height: 300,
    size: 200,
  }),
  assetUrl: async (id: string) => `https://example.com/${id}`,
  exportAsset: exportImage,
}));
vi.mock("../../../shared/media/annotation/AnnotationEditor", () => ({
  AnnotationEditor: ({ onResult }: { onResult: (value: unknown) => void }) => (
    <button
      onClick={() =>
        onResult({
          id: edited,
          name: "Edited",
          mime: "image/png",
          width: 100,
          height: 100,
          size: 100,
        })
      }
    >
      Finish annotation
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("stages annotation results, permits restore, and applies only on explicit confirmation", async () => {
  const apply = vi.fn();
  const close = vi.fn();
  render(
    <div className="app">
      <ImagePreview
        source={source}
        name="Original"
        onApply={apply}
        onClose={close}
      />
    </div>,
  );
  const edit = await screen.findByRole("button", { name: "裁剪与标注" });
  await waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(edit);
  fireEvent.click(
    await screen.findByRole("button", { name: "Finish annotation" }),
  );
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "恢复原图" }));
  expect(
    (screen.getByRole("button", { name: "应用到文稿" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(edit);
  fireEvent.click(
    await screen.findByRole("button", { name: "Finish annotation" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "应用到文稿" }));
  expect(apply).toHaveBeenCalledExactlyOnceWith(edited);
  expect(close).toHaveBeenCalledOnce();
});

async function editedPreview() {
  const apply = vi.fn();
  const close = vi.fn();
  render(
    <div className="app">
      <ImagePreview
        source={source}
        name="Original"
        onApply={apply}
        onClose={close}
      />
    </div>,
  );
  const edit = await screen.findByRole("button", { name: "裁剪与标注" });
  await waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(edit);
  fireEvent.click(
    await screen.findByRole("button", { name: "Finish annotation" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("img").getAttribute("src")).toContain(edited),
  );
  return { apply, close };
}

it("compares without replacing the draft and exports the edited image", async () => {
  const { apply } = await editedPreview();
  fireEvent.click(screen.getByRole("button", { name: "查看原图" }));
  await waitFor(() =>
    expect(screen.getByRole("img").getAttribute("src")).toContain(
      "a".repeat(64),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "另存图片" }));
  await waitFor(() =>
    expect(exportImage).toHaveBeenCalledWith(
      expect.objectContaining({ id: edited }),
    ),
  );
  expect(apply).not.toHaveBeenCalled();
  await screen.findByText("图片已导出，文稿未改变");
  fireEvent.click(screen.getByRole("button", { name: "应用到文稿" }));
  expect(apply).toHaveBeenCalledExactlyOnceWith(edited);
});

it("keeps drafts when dismissing the close prompt and discards only explicitly", async () => {
  const { apply, close } = await editedPreview();
  fireEvent.click(screen.getByRole("button", { name: "关闭弹窗" }));
  await screen.findByRole("dialog", { name: "保留这次图片修改？" });
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "继续编辑" }));
  expect(screen.getByRole("img").getAttribute("src")).toContain(edited);
  fireEvent.click(screen.getByRole("button", { name: "关闭弹窗" }));
  fireEvent.click(await screen.findByRole("button", { name: "丢弃并关闭" }));
  expect(close).toHaveBeenCalledOnce();
  expect(apply).not.toHaveBeenCalled();
});

it("reports canceled export separately from success", async () => {
  exportImage.mockResolvedValueOnce(false);
  const { apply } = await editedPreview();
  fireEvent.click(screen.getByRole("button", { name: "另存图片" }));
  await screen.findByText("已取消导出");
  expect(screen.queryByText("图片已导出，文稿未改变")).toBeNull();
  expect(apply).not.toHaveBeenCalled();
});
it("keeps the preview available when the original node changed before applying", async () => {
  const close = vi.fn();
  render(
    <div className="app">
      <ImagePreview
        source={source}
        name="Original"
        onApply={() => {
          throw new Error("原图片已改变，请重新打开预览");
        }}
        onClose={close}
      />
    </div>,
  );
  const edit = await screen.findByRole("button", { name: "裁剪与标注" });
  await waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(edit);
  fireEvent.click(
    await screen.findByRole("button", { name: "Finish annotation" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "应用到文稿" }));
  expect(screen.getByRole("alert").textContent).toContain("原图片已改变");
  expect(close).not.toHaveBeenCalled();
});
