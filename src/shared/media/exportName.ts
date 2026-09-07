import type { Asset } from "../ipc/bindings";

export function exportName(asset: Pick<Asset, "name" | "id">): string {
  const extension = asset.id.match(/\.(png|jpg|gif|webp|mp4|mov|webm)$/i)?.[1];
  const name =
    asset.name
      .split(/[\\/]/)
      .pop()
      ?.trim()
      .replace(/[. ]+$/, "") || "Qwriter";
  if (
    !extension ||
    name.toLowerCase().endsWith(`.${extension.toLowerCase()}`) ||
    (extension.toLowerCase() === "jpg" && /\.jpeg$/i.test(name))
  )
    return name;
  const stem = name.replace(/\.(png|jpe?g|gif|webp|mp4|mov|webm)$/i, "");
  return `${stem}.${extension}`;
}
