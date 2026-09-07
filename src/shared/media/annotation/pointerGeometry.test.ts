import { describe, expect, it } from "vitest";
import { imagePoint, isColorCopy, pixelHex, windowAt } from "./pointerGeometry";

describe("capture coordinates", () => {
  it("maps display CSS pixels to original Retina pixels and clamps the edge", () => {
    expect(
      imagePoint(
        { x: 12.8, y: 20.4 },
        { width: 100, height: 100 },
        { width: 200, height: 200 },
      ),
    ).toEqual({ x: 25, y: 40 });
    expect(
      imagePoint(
        { x: 100, y: -1 },
        { width: 100, height: 100 },
        { width: 150, height: 150 },
      ),
    ).toEqual({ x: 149, y: 0 });
    expect(pixelHex([1, 15, 255, 255])).toBe("#010FFF");
  });
  it("selects the frontmost overlapping window at fractional scaling", () => {
    const windows = [
      { x: 150, y: 150, width: 300, height: 150 },
      { x: 0, y: 0, width: 900, height: 900 },
    ];
    expect(
      windowAt(
        { x: 110, y: 110 },
        { width: 600, height: 600 },
        { width: 900, height: 900 },
        windows,
      ),
    ).toEqual({ x: 100, y: 100, width: 200, height: 100 });
    expect(
      windowAt(
        { x: 110, y: 110 },
        { width: 600, height: 600 },
        { width: 900, height: 900 },
        [],
      ),
    ).toBeNull();
  });
  it("leaves text editing and input method composition in control of copy", () => {
    expect(
      isColorCopy(new KeyboardEvent("keydown", { key: "c", ctrlKey: true })),
    ).toBe(true);
    expect(
      isColorCopy(new KeyboardEvent("keydown", { key: "c", metaKey: true })),
    ).toBe(true);
    expect(
      isColorCopy(
        new KeyboardEvent("keydown", {
          key: "c",
          ctrlKey: true,
          isComposing: true,
        }),
      ),
    ).toBe(false);
    const input = document.createElement("textarea");
    let captured = true;
    input.addEventListener("keydown", (e) => {
      captured = isColorCopy(e);
    });
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "c", ctrlKey: true }),
    );
    expect(captured).toBe(false);
  });
});
