import { useEffect, useRef, useState } from "react";
import type {
  HarnessOptions,
  Asset,
  ModelCapabilities,
} from "../../shared/ipc/bindings";
import type { Profile } from "../../shared/types";
import { errorText, t } from "../../shared/i18n";
import { chooseAsset, getAsset, importAsset } from "../../shared/media/assets";
import { readLocal } from "../../shared/storage";
import { normalizeCapabilities } from "../models/capabilities";

type Preferences = Pick<
  HarnessOptions,
  "thinking" | "effort" | "maxRounds" | "memoryEnabled"
>;
function initial(): Preferences {
  const saved = readLocal<Partial<Preferences> | null>(
    "qwriter.harness.v1",
    {},
  );
  const raw = saved && typeof saved === "object" ? saved : {};
  return {
    thinking: ["on", "off"].includes(raw.thinking ?? "")
      ? raw.thinking!
      : "auto",
    effort:
      raw.effort === "low" || raw.effort === "high" ? raw.effort : "medium",
    maxRounds: [4, 6, 10, 16].includes(raw.maxRounds ?? 0) ? raw.maxRounds! : 6,
    memoryEnabled: raw.memoryEnabled === true,
  };
}
export function useHarness(config: Profile, documentId: string) {
  const [preferences, setPreferences] = useState(initial);
  const [images, setImages] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const importing = useRef(false);
  const currentImages = useRef(images);
  currentImages.current = images;
  const caps: ModelCapabilities = normalizeCapabilities(config.capabilities);
  useEffect(() => {
    try {
      localStorage.setItem("qwriter.harness.v1", JSON.stringify(preferences));
    } catch {
      setError(t("Agent 偏好保存失败"));
    }
  }, [preferences]);
  useEffect(() => {
    generation.current++;
    setImages([]);
    setLoading(false);
    importing.current = false;
    return () => {
      generation.current++;
    };
  }, [documentId]);
  async function add(load: () => Promise<Asset[]>, requestedCount = 0) {
    if (importing.current) return;
    const version = generation.current;
    importing.current = true;
    setLoading(true);
    setError("");
    try {
      const items = await load();
      if (generation.current !== version) return;
      const merged = [
        ...new Map(
          [...currentImages.current, ...items].map((a) => [a.id, a]),
        ).values(),
      ];
      if (merged.length > 4 || requestedCount > 4)
        setError(t("图片数量已达上限"));
      setImages(merged.slice(0, 4));
    } catch (e) {
      if (generation.current === version) setError(errorText(e));
    } finally {
      if (generation.current === version) {
        setLoading(false);
        importing.current = false;
      }
    }
  }
  const options: HarnessOptions = {
    ...preferences,
    thinking: caps.reasoning === "none" ? "auto" : preferences.thinking,
    capabilities: caps,
    documentId,
    imageIds: images.map((i) => i.id),
  };
  return {
    preferences,
    setPreferences,
    images,
    setImages,
    loading,
    error,
    setError,
    options,
    addImage: () =>
      add(async () => {
        const asset = await chooseAsset("image");
        return asset ? [asset] : [];
      }),
    pasteImages: (files: File[]) =>
      add(
        () => Promise.all(files.slice(0, 4).map((f) => importAsset(f, f.name))),
        files.length,
      ),
    addDocumentImages: (markdown: string) =>
      add(async () => {
        const ids = [
          ...new Set(
            Array.from(
              markdown.matchAll(
                /qwriter-asset:\/\/([a-f0-9]{64}\.(?:png|jpg|webp|gif))/gi,
              ),
              (m) => m[1],
            ),
          ),
        ];
        if (!ids.length) throw new Error(t("当前文稿没有可用的本地图片"));
        return Promise.all(ids.slice(0, 4).map(getAsset));
      }),
  };
}
export type HarnessController = ReturnType<typeof useHarness>;
