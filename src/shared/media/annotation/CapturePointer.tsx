import { useEffect, useRef, useState, type RefObject } from "react";
import type { Bounds } from "react-screenshots";
import { isTauri } from "@tauri-apps/api/core";
import type { ScreenCapture } from "../../ipc/bindings";
import { t } from "../../i18n";
import {
  imagePoint,
  isColorCopy,
  pixelHex,
  windowAt,
  type Point,
  type Size,
} from "./pointerGeometry";

interface Sample {
  point: Point;
  pixel: Point;
  hex: string;
  window: Bounds | null;
}

/** Samples the clean source image once per animation frame, never the dimmed overlay. */
export function CapturePointer({
  host,
  url,
  size,
  screen,
  selected,
  onSelect,
}: {
  host: RefObject<HTMLDivElement | null>;
  url: string;
  size: Size;
  screen?: ScreenCapture;
  selected: boolean;
  onSelect: (bounds: Bounds) => void;
}) {
  const magnifier = useRef<HTMLCanvasElement>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const current = useRef<Sample | null>(null);
  const selectionActive = useRef(selected);
  selectionActive.current = selected;
  useEffect(() => {
    const root = host.current;
    if (!root || !url || !size.width) {
      current.current = null;
      setSample(null);
      return;
    }
    let alive = true;
    let frame = 0;
    let pointer: Point | null = null;
    let start: Point | null = null;
    let copying = false;
    const image = new Image();
    const pixel = document.createElement("canvas");
    pixel.width = pixel.height = 1;
    const context = pixel.getContext("2d", { willReadFrequently: true });
    const sampleAt = (point: Point) => {
      if (!image.complete || !image.naturalWidth || !context) return null;
      const natural = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
      const location = imagePoint(point, size, natural);
      context.clearRect(0, 0, 1, 1);
      context.drawImage(image, location.x, location.y, 1, 1, 0, 0, 1, 1);
      return {
        point,
        pixel: location,
        hex: pixelHex(context.getImageData(0, 0, 1, 1).data),
        window: screen
          ? windowAt(point, size, screen.screen, screen.windows ?? [])
          : null,
      };
    };
    const render = () => {
      frame = 0;
      if (!pointer || !alive) return;
      try {
        const next = sampleAt(pointer);
        if (!next) return;
        current.current = next;
        setSample(next);
        const zoom = magnifier.current?.getContext("2d");
        if (zoom) {
          zoom.imageSmoothingEnabled = false;
          zoom.clearRect(0, 0, 120, 72);
          zoom.drawImage(
            image,
            next.pixel.x - 7,
            next.pixel.y - 4,
            15,
            9,
            0,
            0,
            120,
            72,
          );
        }
      } catch {
        current.current = null;
        setSample(null);
      }
    };
    const move = (event: MouseEvent) => {
      const rect = root.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (
        pointer.x < 0 ||
        pointer.y < 0 ||
        pointer.x >= size.width ||
        pointer.y >= size.height ||
        (event.target instanceof Element &&
          event.target.closest(".screenshots-operations"))
      ) {
        pointer = null;
        current.current = null;
        setSample(null);
        return;
      }
      if (!frame) frame = requestAnimationFrame(render);
    };
    const down = (event: MouseEvent) => {
      if (
        !selectionActive.current &&
        event.button === 0 &&
        event.target instanceof Element &&
        event.target.closest(".screenshots-background")
      ) {
        start = { x: event.clientX, y: event.clientY };
      }
    };
    const up = (event: MouseEvent) => {
      const origin = start;
      start = null;
      if (
        !origin ||
        event.button !== 0 ||
        Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 4
      )
        return;
      const rect = root.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      if (
        point.x < 0 ||
        point.y < 0 ||
        point.x >= size.width ||
        point.y >= size.height
      )
        return;
      const bounds =
        screen && windowAt(point, size, screen.screen, screen.windows ?? []);
      // Let the cropper finish its mouseup before changing controlled bounds;
      // a synchronous render can replace its release listener mid-dispatch.
      if (bounds)
        window.setTimeout(() => {
          if (alive) onSelect(bounds);
        }, 0);
    };
    const copy = async (event: KeyboardEvent) => {
      if (!isColorCopy(event) || !current.current || copying) return;
      event.preventDefault();
      event.stopPropagation();
      copying = true;
      const hex = current.current.hex;
      try {
        if (isTauri()) {
          const { writeText } =
            await import("@tauri-apps/plugin-clipboard-manager");
          await writeText(hex);
        } else await navigator.clipboard.writeText(hex);
        if (alive) {
          setFailed(false);
          setFeedback(t("色值已复制：{{color}}", { color: hex }));
        }
      } catch {
        if (alive) {
          setFailed(true);
          setFeedback(t("色值复制失败，请重试"));
        }
      } finally {
        copying = false;
      }
    };
    image.onload = render;
    image.src = url;
    window.addEventListener("mousemove", move);
    root.addEventListener("mousedown", down, true);
    window.addEventListener("mouseup", up);
    window.addEventListener("keydown", copy, true);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      image.onload = null;
      current.current = null;
      window.removeEventListener("mousemove", move);
      root.removeEventListener("mousedown", down, true);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("keydown", copy, true);
    };
  }, [host, url, size, screen, onSelect]);
  const box = sample?.window;
  return (
    <>
      {!selected && box && (
        <div
          className="capture-window-target"
          style={{
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
          }}
        >
          <span>{t("单击选择窗口 · 拖动自由框选")}</span>
        </div>
      )}
      <div
        className="capture-color-loupe"
        aria-hidden="true"
        style={{
          visibility: sample && !selected ? "visible" : "hidden",
          left: Math.max(
            0,
            Math.min((sample?.point.x ?? 0) + 22, size.width - 180),
          ),
          top: Math.max(
            0,
            Math.min((sample?.point.y ?? 0) + 24, size.height - 155),
          ),
        }}
      >
        <div className="capture-loupe-pixels">
          <canvas ref={magnifier} width={120} height={72} />
        </div>
        <div className="capture-color-value">
          <i style={{ background: sample?.hex }} />
          {sample?.hex}
        </div>
        <small>
          {t("annotation.position")} {sample?.pixel.x}, {sample?.pixel.y}
        </small>
        <small>{t("Ctrl / ⌘ C 复制色值")}</small>
      </div>
      {feedback && (
        <div
          className="capture-color-feedback"
          role={failed ? "alert" : "status"}
        >
          {feedback}
        </div>
      )}
    </>
  );
}
