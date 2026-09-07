import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { commands, type Asset } from "../ipc/bindings";
import { captureDatabase } from "./database";
import { exportName } from "./exportName";

export type { Asset } from "../ipc/bindings";
export const assetReference = (id: string) => `qwriter-asset://${id}`;
export const assetId = (reference: string) =>
  reference.match(
    /^qwriter-asset:\/\/([a-f0-9]{64}\.(?:png|jpg|gif|webp|mp4|mov|webm))$/i,
  )?.[1];
const urls = new Map<string, Promise<string>>();

export async function getAsset(id: string): Promise<Asset> {
  if (isTauri()) return commands.mediaAsset(id);
  const item = await (await captureDatabase()).get("assets", id);
  if (!item) throw new Error("找不到此素材");
  return item.asset;
}

export function assetUrl(id: string): Promise<string> {
  const existing = urls.get(id);
  if (existing) return existing;
  const result = (async () => {
    if (isTauri()) return convertFileSrc(await commands.mediaPath(id));
    const item = await (await captureDatabase()).get("assets", id);
    if (!item) throw new Error("找不到此素材");
    return URL.createObjectURL(item.blob);
  })().catch((error) => {
    urls.delete(id);
    throw error;
  });
  urls.set(id, result);
  return result;
}

export async function importAsset(blob: Blob, name: string): Promise<Asset> {
  const types: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  const ext = types[blob.type];
  if (!ext)
    throw new Error("支持 PNG、JPEG、GIF、WebP 图片和 MP4、MOV、WebM 视频");
  if (!blob.size || blob.size > 32 * 1024 * 1024)
    throw new Error("剪贴板或上传图片应小于 32 MB");
  const buffer = await blob.arrayBuffer();
  if (isTauri())
    return commands.mediaImport(Array.from(new Uint8Array(buffer)), name);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const asset: Asset = {
    id: `${hash}.${ext}`,
    mime: blob.type,
    name: name.slice(0, 240),
    size: blob.size,
    width: null,
    height: null,
  };
  if (blob.type.startsWith("image/")) {
    const image = await createImageBitmap(blob);
    asset.width = image.width;
    asset.height = image.height;
    image.close();
    if (asset.width * asset.height > 40_000_000)
      throw new Error("图片像素总量不能超过 4000 万");
  }
  await (await captureDatabase()).put("assets", { asset, blob });
  return asset;
}

export function chooseAsset(kind: "image" | "video"): Promise<Asset | null> {
  if (isTauri()) return commands.mediaPick(kind);
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      kind === "image"
        ? "image/png,image/jpeg,image/gif,image/webp"
        : "video/mp4,video/webm,video/quicktime";
    input.oncancel = () => resolve(null);
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) resolve(null);
      else importAsset(file, file.name).then(resolve, reject);
    };
    input.click();
  });
}

export async function exportAsset(asset: Asset) {
  if (isTauri()) return commands.mediaExport(asset.id);
  const link = document.createElement("a");
  link.href = await assetUrl(asset.id);
  link.download = exportName(asset);
  link.click();
  return true;
}

export async function copyImage(asset: Asset) {
  if (isTauri()) {
    const { writeImage } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeImage(
      new Uint8Array(
        await (await fetch(await assetUrl(asset.id))).arrayBuffer(),
      ),
    );
  } else {
    const entry = await (await captureDatabase()).get("assets", asset.id);
    if (!entry) throw new Error("找不到此素材");
    let png = entry.blob;
    if (png.type !== "image/png") {
      const bitmap = await createImageBitmap(png);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      bitmap.close();
      png = await canvas.convertToBlob({ type: "image/png" });
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  }
}

export async function openExternal(url: string) {
  const parsed = new URL(url);
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new Error("请输入有效的链接地址");
  if (isTauri()) await commands.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
