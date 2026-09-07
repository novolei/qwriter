import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
  type KeyboardEvent,
} from "react";

export function useDialogDrag(
  content: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const origin = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  function move(x: number, y: number) {
    const rect = content.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition((previous) => ({
      x: Math.max(
        12 - rect.left + previous.x,
        Math.min(x, window.innerWidth - 12 - rect.right + previous.x),
      ),
      y: Math.max(
        12 - rect.top + previous.y,
        Math.min(y, window.innerHeight - 12 - rect.bottom + previous.y),
      ),
    }));
  }
  useEffect(() => {
    const reset = () => setPosition({ x: 0, y: 0 });
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, []);
  return {
    style: enabled
      ? { translate: `${position.x}px ${position.y}px` }
      : undefined,
    handle: enabled
      ? {
          onPointerDown(event: PointerEvent<HTMLDivElement>) {
            if (
              event.button !== 0 ||
              (event.target as HTMLElement).closest("button")
            )
              return;
            event.currentTarget.setPointerCapture(event.pointerId);
            origin.current = {
              x: event.clientX,
              y: event.clientY,
              left: position.x,
              top: position.y,
            };
          },
          onPointerMove(event: PointerEvent<HTMLDivElement>) {
            const start = origin.current;
            if (start)
              move(
                start.left + event.clientX - start.x,
                start.top + event.clientY - start.y,
              );
          },
          onPointerUp() {
            origin.current = null;
          },
          onPointerCancel() {
            origin.current = null;
          },
          onLostPointerCapture() {
            origin.current = null;
          },
          onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
            if (event.target !== event.currentTarget) return;
            const deltas: Record<string, [number, number]> = {
              ArrowLeft: [-20, 0],
              ArrowRight: [20, 0],
              ArrowUp: [0, -20],
              ArrowDown: [0, 20],
            };
            const delta = deltas[event.key];
            if (delta) {
              event.preventDefault();
              move(position.x + delta[0], position.y + delta[1]);
            }
            if (event.key === "Home") {
              event.preventDefault();
              setPosition({ x: 0, y: 0 });
            }
          },
        }
      : {},
  };
}
