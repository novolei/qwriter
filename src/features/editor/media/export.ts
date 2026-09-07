import { zip, strToU8 } from "fflate";
import { isTauri } from "@tauri-apps/api/core";
import { assetUrl, getAsset } from "../../../shared/media/assets";
import { mediaContent } from "./MediaNode";
const references =
  /qwriter-asset:\/\/([a-f0-9]{64}\.(?:png|jpg|gif|webp|mp4|mov|webm))/g;
export function portableMarkdown(markdown: string) {
  return markdown
    .replace(/^```qwriter-media\n([^\n]*)\n```/gm, (fence, json: string) => {
      try {
        const media = mediaContent(JSON.parse(json));
        if (!media) return fence;
        const title = media.title.replace(/[\[\]\\\n]/g, " ");
        return `${media.poster ? `![${title}](<${media.poster}>)\n\n` : ""}[${title || media.url}](<${media.url}>)`;
      } catch {
        return fence;
      }
    })
    .replace(references, "assets/$1");
}
export async function exportMediaBundle(title: string, markdown: string) {
  const ids = [
    ...new Set(Array.from(markdown.matchAll(references), (match) => match[1])),
  ];
  const name =
    title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100) || "Qwriter";
  const assets = await Promise.all(ids.map(getAsset));
  if (assets.reduce((sum, asset) => sum + asset.size, 0) > 256 * 1024 * 1024)
    throw new Error("导出素材超过 256 MB，请分别导出素材");
  let destination: string | null = null;
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    destination = await save({
      defaultPath: `${name}.zip`,
      filters: [{ name: "Markdown + assets", extensions: ["zip"] }],
    });
    if (!destination) return;
  }
  const files: Record<string, Uint8Array> = {
    [`${name}.md`]: strToU8(portableMarkdown(markdown)),
    "README.txt": strToU8(
      "Qwriter portable document\n\nKeep the assets folder beside the Markdown file. Website/video cards are exported as ordinary links, with preview images when available. Open local video links in a compatible player.\n",
    ),
  };
  for (const asset of assets)
    files[`assets/${asset.id}`] = new Uint8Array(
      await (await fetch(await assetUrl(asset.id))).arrayBuffer(),
    );
  const data = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 0 }, (error, data) =>
      error ? reject(error) : resolve(data),
    ),
  );
  if (destination) {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(destination, data);
  } else {
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/zip" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
