import { useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, X } from "lucide-react";
import {
  assetUrl,
  chooseAsset,
  importAsset,
  type Asset,
} from "../../../shared/media/assets";
import { AssetView } from "../../../shared/media/AssetView";
import { t, errorText } from "../../../shared/i18n";

export async function stitchImages(
  images: { url: string; trim: number }[],
): Promise<Blob> {
  const bitmaps: ImageBitmap[] = [];
  try {
    for (const image of images)
      bitmaps.push(
        await createImageBitmap(await (await fetch(image.url)).blob()),
      );
    const width = Math.min(...bitmaps.map((image) => image.width));
    const heights = bitmaps.map((image, index) =>
      Math.max(
        1,
        Math.round(
          ((image.height * width) / image.width) *
            (1 - (index ? images[index].trim : 0) / 100),
        ),
      ),
    );
    const height = heights.reduce((sum, value) => sum + value, 0);
    if (!width || width * height > 40_000_000 || height > 30000)
      throw new Error("拼接图片过大，请减少图片数量");
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建图片画布");
    let top = 0;
    bitmaps.forEach((image, index) => {
      const skip = index ? (image.height * images[index].trim) / 100 : 0;
      context.drawImage(
        image,
        0,
        skip,
        image.width,
        image.height - skip,
        0,
        top,
        width,
        heights[index],
      );
      top += heights[index];
    });
    return await canvas.convertToBlob({ type: "image/png" });
  } finally {
    bitmaps.forEach((image) => image.close());
  }
}
export function Stitcher({
  initial,
  onResult,
  onBack,
}: {
  initial: Asset;
  onResult: (asset: Asset) => void;
  onBack: () => void;
}) {
  const [items, setItems] = useState([{ asset: initial, trim: 0 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, step: number) {
    const next = [...items];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setItems(next);
  }
  return (
    <div className="stitch-workspace">
      <h3>{t("拼成长图")}</h3>
      <p>
        {t("按阅读顺序添加截图，裁去重复的顶部内容。图片会按相同宽度拼接。")}
      </p>
      <div className="stitch-list">
        {items.map((item, index) => (
          <div className="stitch-item" key={`${item.asset.id}:${index}`}>
            <AssetView id={item.asset.id} name={item.asset.name} />
            <span>{index + 1}</span>
            {index > 0 && (
              <label>
                {t("顶部重叠")}
                <input
                  aria-label={t("第 {{index}} 张顶部重叠", {
                    index: index + 1,
                  })}
                  type="range"
                  min={0}
                  max={80}
                  value={item.trim}
                  disabled={busy}
                  onChange={(event) =>
                    setItems(
                      items.map((value, i) =>
                        i === index
                          ? { ...value, trim: +event.target.value }
                          : value,
                      ),
                    )
                  }
                />
                {item.trim}%
              </label>
            )}
            <div>
              <button
                disabled={busy || !index}
                title={t("上移")}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                disabled={busy || index === items.length - 1}
                title={t("下移")}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                disabled={busy || items.length === 1}
                title={t("移除")}
                onClick={() => setItems(items.filter((_, i) => i !== index))}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        className="quiet-button"
        disabled={busy || items.length >= 8}
        onClick={() =>
          void task(async () => {
            const asset = await chooseAsset("image");
            if (asset) setItems([...items, { asset, trim: 0 }]);
          })
        }
      >
        <ImagePlus size={16} />
        {t("添加下一张截图")}
      </button>
      {error && (
        <p role="alert" className="capture-error">
          {error}
        </p>
      )}
      <footer className="capture-dialog-footer">
        <button disabled={busy} onClick={onBack}>
          {t("返回")}
        </button>
        <button
          className="primary"
          disabled={busy || items.length < 2}
          onClick={() =>
            void task(async () => {
              const blob = await stitchImages(
                await Promise.all(
                  items.map(async (item) => ({
                    url: await assetUrl(item.asset.id),
                    trim: item.trim,
                  })),
                ),
              );
              onResult(await importAsset(blob, "Qwriter-long-capture.png"));
            })
          }
        >
          {t(busy ? "正在拼接…" : "生成长图")}
        </button>
      </footer>
    </div>
  );
}
