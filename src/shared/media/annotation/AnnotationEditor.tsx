import "react-screenshots/lib/style.css";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { commands, type ScreenCapture } from "../../ipc/bindings";
import { assetUrl, type Asset } from "../assets";
import type { Bounds } from "react-screenshots";
import { errorText, t } from "../../i18n";
import { useScreenshotControls } from "./accessibility";
import { annotationLocale } from "./locale";
import { canvasImageSource } from "./imageSource";
import { AnnotationBoundary } from "./AnnotationBoundary";
import { CapturePointer } from "./CapturePointer";
import { completeCapture, type CaptureCopyNotice } from "./completeCapture";
const Screenshots = lazy(() => import("react-screenshots"));
export async function warmAnnotationEditor() {
  await import("react-screenshots");
}
export function AnnotationEditor({
  source,
  onResult,
  onCancel,
  imageMode = false,
}: {
  source: Asset | ScreenCapture;
  onResult: (asset: Asset, notice?: CaptureCopyNotice) => void;
  onCancel: () => void;
  imageMode?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Bounds | null>(null);
  const [selectionRequest, setSelectionRequest] = useState<Bounds | null>(null);
  useScreenshotControls(host);
  const working = useRef(false);
  const alive = useRef(true);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working.current) {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [onCancel]);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setUrl("");
    setSelection(null);
    setSelectionRequest(null);
    setError("");
    const value =
      "path" in source
        ? Promise.resolve(convertFileSrc(source.path))
        : assetUrl(source.id);
    void value
      .then((url) => canvasImageSource(url, controller.signal))
      .then((url) => {
        objectUrl = url;
        if (alive) setUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch((error) => {
        if (alive) setError(errorText(error));
      });
    return () => {
      alive = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      const width =
        "screen" in source ? source.screen.width : source.width || rect.width;
      const height =
        "screen" in source
          ? source.screen.height
          : source.height || rect.height;
      const scale = Math.min(rect.width / width, rect.height / height);
      setSize({
        width: Math.floor(width * scale),
        height: Math.floor(height * scale),
      });
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [source]);
  async function complete(blob: Blob) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const { asset, notice } = await completeCapture(
        blob,
        !imageMode,
        () => alive.current,
      );
      if ("path" in source) await commands.captureRelease(source.id);
      if (alive.current) onResult(asset, notice);
    } catch (error) {
      if (alive.current) {
        setError(errorText(error));
        setBusy(false);
      }
      working.current = false;
    }
  }
  return (
    <div
      ref={host}
      className="screenshot-editor"
      aria-label={t(imageMode ? "图片编辑工作台" : "截图标注工作台")}
    >
      <div className="screenshot-guide">
        <span>
          {t(
            imageMode
              ? "先框选保留区域，再选择画笔、箭头或文字；点击 ✓ 返回预览"
              : "screen" in source && source.windows?.length
                ? "单击选窗口 · 拖动框选 · Ctrl / ⌘ C 取色 · 完成并复制"
                : "拖动框选 · Ctrl / ⌘ C 取色 · 完成并复制",
          )}
        </span>
        <button disabled={busy} onClick={onCancel}>
          {t(imageMode ? "返回预览" : "退出截图")}
        </button>
      </div>
      {url && size.width > 0 && (
        <AnnotationBoundary key={url} onCancel={onCancel}>
          <Suspense fallback={<p>{t("正在打开…")}</p>}>
            <div
              ref={surface}
              className={`annotation-surface ${!imageMode ? "has-color-picker" : ""}`}
              style={size}
            >
              <Screenshots
                url={url}
                width={size.width}
                height={size.height}
                lang={annotationLocale()}
                selectionRequest={selectionRequest}
                onSelectionChange={setSelection}
                onOk={(blob: Blob) => {
                  void complete(blob);
                }}
                onSave={(blob: Blob) => {
                  void complete(blob);
                }}
                onCancel={() => {
                  if (!working.current) onCancel();
                }}
              />
              {!imageMode && !busy && (
                <CapturePointer
                  host={surface}
                  url={url}
                  size={size}
                  screen={"screen" in source ? source : undefined}
                  selected={Boolean(selection)}
                  onSelect={setSelectionRequest}
                />
              )}
            </div>
          </Suspense>
        </AnnotationBoundary>
      )}
      {busy && (
        <div className="screenshot-busy" role="status">
          {t(imageMode ? "正在生成图片预览…" : "正在保存截图…")}
        </div>
      )}
      {error && (
        <div className="screenshot-problem" role="alert">
          {error}
          <button onClick={onCancel}>{t("返回")}</button>
        </div>
      )}
    </div>
  );
}
