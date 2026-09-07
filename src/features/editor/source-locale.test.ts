import { EditorState } from "@codemirror/state";
import { afterEach, expect, it } from "vitest";
import { changeLanguage } from "../../shared/i18n";
import { sourcePhrases } from "./source-locale";

afterEach(() => changeLanguage("zh-CN"));
it("localizes search and screen-reader announcements through CodeMirror's phrase protocol", async () => {
  await changeLanguage("zh-CN");
  const chinese = EditorState.create({
    extensions: EditorState.phrases.of(sourcePhrases()),
  });
  expect(chinese.phrase("Find")).toBe("查找");
  expect(chinese.phrase("replaced match on line $", 7)).toBe(
    "已替换第 7 行的匹配",
  );
  expect(chinese.phrase("Fold line")).toBe("折叠行");
  await changeLanguage("en");
  const english = EditorState.create({
    extensions: EditorState.phrases.of(sourcePhrases()),
  });
  expect(english.phrase("Find")).toBe("Find");
  expect(english.phrase("replaced $ matches", 3)).toBe("replaced 3 matches");
});
