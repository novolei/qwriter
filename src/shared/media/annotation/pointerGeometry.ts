import type { Bounds } from "react-screenshots";
import type { CaptureWindowBounds } from "../../ipc/bindings";

export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}

export function imagePoint(point: Point, display: Size, image: Size): Point {
  return {
    x: Math.max(
      0,
      Math.min(
        image.width - 1,
        Math.floor((point.x * image.width) / display.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        image.height - 1,
        Math.floor((point.y * image.height) / display.height),
      ),
    ),
  };
}

export function windowAt(
  point: Point,
  display: Size,
  screen: Size,
  windows: CaptureWindowBounds[],
): Bounds | null {
  const x = (point.x * screen.width) / display.width;
  const y = (point.y * screen.height) / display.height;
  const hit = windows.find(
    (w) => x >= w.x && y >= w.y && x < w.x + w.width && y < w.y + w.height,
  );
  return hit
    ? {
        x: (hit.x * display.width) / screen.width,
        y: (hit.y * display.height) / screen.height,
        width: (hit.width * display.width) / screen.width,
        height: (hit.height * display.height) / screen.height,
      }
    : null;
}

export function pixelHex(data: ArrayLike<number>): string {
  return `#${[data[0], data[1], data[2]]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function isColorCopy(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    !event.defaultPrevented &&
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "c" &&
    !event.altKey &&
    !event.shiftKey &&
    !event.repeat &&
    !event.isComposing &&
    !(
      target instanceof Element &&
      target.closest('input, textarea, [contenteditable="true"]')
    )
  );
}
