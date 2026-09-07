import { afterEach, expect, it } from "vitest";
import { changeLanguage } from "../../shared/i18n";
import { createSeedDocs } from "./seeds";

afterEach(() => changeLanguage("zh-CN"));
it("creates localized starter documents without rewriting earlier documents on language changes", async () => {
  await changeLanguage("zh-CN");
  const chinese = createSeedDocs();
  const original = structuredClone(chinese);
  expect(chinese.map((doc) => doc.title)).toEqual([
    "在文字里，找到自己的节奏",
    "灵感收集箱",
    "故事的第一章",
  ]);
  await changeLanguage("en");
  const english = createSeedDocs();
  expect(english.map((doc) => doc.id)).toEqual(chinese.map((doc) => doc.id));
  for (const doc of english) {
    expect(doc.markdown).toMatch(new RegExp(`^# ${doc.title}`));
    expect(doc.markdown).not.toMatch(/[\u3400-\u9fff]/);
  }
  expect(chinese).toEqual(original);
});
