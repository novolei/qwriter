import { useEffect, useRef, useState } from "react";
import { errorText } from "../../../shared/i18n";
import {
  assetId,
  assetUrl,
  getAsset,
  importAsset,
  type Asset,
} from "../../../shared/media/assets";
import { safeMediaUrl } from "./MediaNode";

/** One source per preview session; abort outstanding imports when it closes. */
export function useImageSource(source: string, name: string) {
  const [original, setOriginal] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const id = assetId(source);
    if (id) {
      void getAsset(id)
        .then((asset) => {
          if (!controller.signal.aborted) setOriginal(asset);
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(errorText(error));
        });
    }
    return () => controller.abort();
  }, [source]);

  async function resolveOriginal() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) throw new Error("素材暂不可用");
    if (original) return original;
    const id = assetId(source);
    let asset: Asset;
    if (id) asset = await getAsset(id);
    else {
      if (!safeMediaUrl(source)) throw new Error("素材暂不可用");
      const response = await fetch(source, {
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok)
        throw new Error("远程图片无法编辑，请先下载并作为本地图片插入");
      const blob = await response.blob();
      signal.throwIfAborted();
      asset = await importAsset(blob, name || "Image.png");
    }
    signal.throwIfAborted();
    setOriginal(asset);
    return asset;
  }
  return { original, error, resolveOriginal };
}

export function useImageUrl(source: string, asset: Asset | null) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const id = asset?.id ?? assetId(source);
    const result = id
      ? assetUrl(id)
      : safeMediaUrl(source)
        ? Promise.resolve(source)
        : Promise.reject(new Error("素材暂不可用"));
    void result.then(
      (value) => {
        if (active) {
          setUrl(value);
          setError("");
        }
      },
      (error) => {
        if (active) setError(errorText(error));
      },
    );
    return () => {
      active = false;
    };
  }, [source, asset?.id]);
  return { url, error };
}
