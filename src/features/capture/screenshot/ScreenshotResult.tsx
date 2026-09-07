import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  Check,
  Clipboard,
  Download,
  FilePlus2,
  ScanText,
  StickyNote,
  Pin,
  Layers,
  PencilLine,
  Image,
} from "lucide-react";
import { commands } from "../../../shared/ipc/bindings";
import { AssetView } from "../../../shared/media/AssetView";
import {
  assetUrl,
  copyImage,
  exportAsset,
  type Asset,
} from "../../../shared/media/assets";
import { errorText, t } from "../../../shared/i18n";
import { Stitcher } from "./Stitcher";
import type { CaptureCopyNotice } from "../../../shared/media/annotation/completeCapture";

export function ScreenshotResult({
  asset: initial,
  onNote,
  onInsert,
  onEdit,
  notice,
}: {
  asset: Asset;
  onNote: (text: string, asset: Asset) => void;
  onInsert: (asset: Asset) => Promise<void>;
  onEdit: (asset: Asset) => void;
  notice?: CaptureCopyNotice;
}) {
  const [asset, setAsset] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(notice?.copied ? t("图片已复制") : "");
  const [error, setError] = useState(notice?.copyError ?? "");
  const [text, setText] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [stitch, setStitch] = useState(false);
  const alive = useRef(true);
  const generation = useRef(0);
  const operation = useRef(0);
  const ocrResult = useRef<HTMLDivElement>(null);
  const hasText = text !== null;
  useEffect(() => {
    if (hasText)
      ocrResult.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [hasText]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
      void import("./ocr").then((module) => module.cancelRecognition());
    };
  }, []);
  async function task(fn: () => Promise<void>) {
    const run = ++operation.current;
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await fn();
    } catch (error) {
      if (alive.current && run === operation.current)
        setError(errorText(error));
    } finally {
      if (alive.current && run === operation.current) setBusy(false);
    }
  }
  async function recognize() {
    const run = ++generation.current;
    setProgress(0);
    try {
      const module = await import("./ocr");
      if (!alive.current || run !== generation.current) return;
      const url = await assetUrl(asset.id);
      if (!alive.current || run !== generation.current) return;
      const result = await module.recognize(url, (value) => {
        if (alive.current && run === generation.current) setProgress(value);
      });
      if (alive.current && run === generation.current) setText(result);
    } catch (error) {
      if (run === generation.current) throw error;
    } finally {
      if (alive.current && run === generation.current) setProgress(null);
    }
  }
  if (stitch)
    return (
      <Stitcher
        initial={asset}
        onBack={() => setStitch(false)}
        onResult={(result) => {
          setAsset(result);
          setText(null);
          setStitch(false);
        }}
      />
    );
  return (
    <div className="screenshot-result">
      <div className="screenshot-preview">
        <AssetView id={asset.id} name={t("截图预览")} />
      </div>
      <div className="screenshot-result-heading">
        <span className="screenshot-metadata">
          <Image size={14} aria-hidden="true" />
          {asset.width} × {asset.height}
          <small> PNG · {(asset.size / 1024 / 1024).toFixed(2)} MB</small>
        </span>
      </div>
      {status && (
        <p className="capture-success" role="status">
          <Check size={15} />
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="capture-error">
          {error}
        </p>
      )}
      <div className="screenshot-action-deck" aria-busy={busy}>
        <div
          className="screenshot-actions"
          role="group"
          aria-label={t("保存与分享")}
        >
          <button
            className="screenshot-primary-action"
            disabled={busy}
            onClick={() =>
              void task(async () => {
                await copyImage(asset);
                setStatus(t("图片已复制"));
              })
            }
          >
            <Clipboard size={18} />
            {t("复制图片")}
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void task(async () => {
                if (await exportAsset(asset)) setStatus(t("图片已导出"));
              })
            }
          >
            <Download size={18} />
            {t("保存到本地")}
          </button>
          <button disabled={busy} onClick={() => onNote(text || "", asset)}>
            <StickyNote size={18} />
            {t("保存为速记")}
          </button>
          <button
            disabled={busy}
            onClick={() => void task(() => onInsert(asset))}
          >
            <FilePlus2 size={18} />
            {t("插入文稿")}
          </button>
        </div>
        <div
          className="screenshot-tools"
          role="group"
          aria-label={t("图片工具")}
        >
          <button disabled={busy} onClick={() => onEdit(asset)}>
            <PencilLine size={17} />
            {t("继续标注")}
          </button>
          <button disabled={busy} onClick={() => void task(recognize)}>
            <ScanText size={18} />
            {t("提取文字")}
          </button>
          <button disabled={busy} onClick={() => setStitch(true)}>
            <Layers size={18} />
            {t("拼成长图")}
          </button>
          {isTauri() && (
            <button
              disabled={busy}
              onClick={() =>
                void task(async () => {
                  await commands.capturePin(asset.id);
                  setStatus(t("参考图已置顶"));
                })
              }
            >
              <Pin size={18} />
              {t("贴在屏幕上")}
            </button>
          )}
        </div>
      </div>
      {progress !== null && (
        <div className="ocr-progress" role="status">
          <progress value={progress} max={1} />
          <span>
            {t("本地识别中…")} {Math.round(progress * 100)}%
          </span>
          <button
            onClick={() => {
              generation.current++;
              operation.current++;
              void import("./ocr").then((module) => module.cancelRecognition());
              setProgress(null);
              setBusy(false);
            }}
          >
            {t("取消")}
          </button>
        </div>
      )}
      {text !== null && (
        <div className="ocr-result" ref={ocrResult}>
          <div className="ocr-result-header">
            <span>
              <ScanText size={17} />
              {t("识别结果，可继续编辑")}
            </span>
            <button
              className="quiet-button"
              disabled={busy || !text.trim()}
              onClick={() =>
                void task(async () => {
                  if (isTauri()) {
                    const { writeText } =
                      await import("@tauri-apps/plugin-clipboard-manager");
                    await writeText(text);
                  } else await navigator.clipboard.writeText(text);
                  setStatus(t("文字已复制"));
                })
              }
            >
              <Clipboard size={15} />
              {t("复制文字")}
            </button>
          </div>
          <textarea
            aria-label={t("识别文字")}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <small>{t("识别在本机完成，请核对后使用。")}</small>
        </div>
      )}
    </div>
  );
}
