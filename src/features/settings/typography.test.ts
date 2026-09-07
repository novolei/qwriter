import { expect, it } from "vitest";
import { fontFamily, normalizeTypography } from "./typography";
it("migrates old typography preferences to independent bundled font families", () => {
  const prefs = normalizeTypography({
    fontSize: 18,
    lineHeight: 2.2,
    width: 800,
  });
  expect(prefs.fontSize).toBe(18);
  expect(prefs.uiFont).toBe("noto-sans");
  expect(prefs.documentFont).toBe("noto-serif");
  expect(fontFamily(prefs.uiFont)).toContain("Noto Sans SC Variable");
  expect(fontFamily(prefs.documentFont)).toContain("Noto Serif SC Variable");
});
it("recovers malformed preferences without invalid styles or crashes", () => {
  expect(normalizeTypography(null).fontSize).toBe(17);
  const prefs = normalizeTypography({
    uiFont: "not-installed",
    documentFont: "system-serif",
    fontSize: 99,
    lineHeight: "oops",
  });
  expect(prefs.uiFont).toBe("noto-sans");
  expect(prefs.documentFont).toBe("system-serif");
  expect(prefs.fontSize).toBe(24);
  expect(prefs.lineHeight).toBe(2);
});
