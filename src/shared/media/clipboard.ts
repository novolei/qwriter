import { isTauri } from "@tauri-apps/api/core";
import { commands } from "../ipc/bindings";
import { importAsset } from "./assets";

export type ClipboardCapture = { text: string; assetIds: string[] };
export async function readClipboard(): Promise<ClipboardCapture> {
  if (isTauri()) {
    const seed = await commands.captureClipboard();
    return { text: seed.text, assetIds: seed.assetIds };
  }
  const result: ClipboardCapture = { text: "", assetIds: [] };
  // Clipboard access follows a deliberate button/shortcut, never a background poll.
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const image = item.types.find((type) =>
      ["image/png", "image/jpeg", "image/webp"].includes(type),
    );
    if (image)
      result.assetIds.push(
        (await importAsset(await item.getType(image), "Clipboard.png")).id,
      );
    if (item.types.includes("text/plain"))
      result.text += await (await item.getType("text/plain")).text();
  }
  if (result.text.length > 256 * 1024)
    throw new Error("剪贴板文字应小于 256 KB");
  if (!result.text && !result.assetIds.length)
    throw new Error("剪贴板中没有可用的文字或图片");
  return result;
}

export async function pastePayload(
  data: DataTransfer,
): Promise<ClipboardCapture> {
  const result: ClipboardCapture = {
    text: data.getData("text/plain"),
    assetIds: [],
  };
  for (const file of Array.from(data.files).slice(0, 12)) {
    if (file.type.startsWith("image/"))
      result.assetIds.push(
        (await importAsset(file, file.name || "Clipboard.png")).id,
      );
  }
  return result;
}
