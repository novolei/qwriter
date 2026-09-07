import type { Asset, Card } from "../../../shared/ipc/bindings";
import { assetReference, getAsset } from "../../../shared/media/assets";
import type { MediaContent } from "./MediaNode";

export const mediaMarkdown = (media: MediaContent) =>
  `\`\`\`qwriter-media\n${JSON.stringify(media)}\n\`\`\``;
export function assetMarkdown(asset: Asset, caption = asset.name) {
  const url = assetReference(asset.id);
  return asset.mime.startsWith("video/")
    ? mediaMarkdown({
        kind: "video",
        url,
        title: caption,
        description: "",
        poster: "",
      })
    : `![${caption.replace(/[\\\[\]\r\n]/g, " ")}](${url})`;
}
export async function cardMarkdown(card: Card) {
  const assets = await Promise.all(card.assetIds.map(getAsset));
  return [
    card.title ? `## ${card.title.replace(/[\r\n]/g, " ")}` : "",
    card.body,
    ...assets.map((asset) => assetMarkdown(asset)),
    card.sourceUrl ? `<${card.sourceUrl}>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
