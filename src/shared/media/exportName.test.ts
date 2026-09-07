import { expect, it } from "vitest";
import { exportName } from "./exportName";

it("keeps screenshot downloads recognizable and strips path components", () => {
  const id = `${"a".repeat(64)}.png`;
  expect(exportName({ id, name: "Qwriter-2026" })).toBe("Qwriter-2026.png");
  expect(exportName({ id, name: "C:\\images\\Capture.PNG" })).toBe(
    "Capture.PNG",
  );
  expect(exportName({ id, name: "photo.jpg" })).toBe("photo.png");
  expect(exportName({ id, name: "截图." })).toBe("截图.png");
  expect(exportName({ id, name: "notes.v2" })).toBe("notes.v2.png");
  expect(exportName({ id: `${"a".repeat(64)}.jpg`, name: "photo.jpeg" })).toBe(
    "photo.jpeg",
  );
});
