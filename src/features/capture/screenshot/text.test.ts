import { expect, it } from "vitest";
import { readableOcr } from "./text";
it("keeps bilingual OCR words and line boundaries intact", () => {
  expect(readableOcr("一 个 想 法 Markdown text\n留 在 这 里。\n")).toBe(
    "一个想法 Markdown text\n留在这里。",
  );
});
