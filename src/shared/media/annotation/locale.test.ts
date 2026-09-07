import { afterEach, expect, it } from "vitest";
import { changeLanguage } from "../../i18n";
import { annotationLocale } from "./locale";

afterEach(() => changeLanguage("zh-CN"));
it("switches every vendor tool label without changing the vendor protocol", async () => {
  await changeLanguage("zh-CN");
  const chinese = annotationLocale();
  expect(chinese.operation_arrow_title).toBe("箭头");
  expect(chinese.operation_ok_title).toBe("确定");
  await changeLanguage("en");
  const english = annotationLocale();
  expect(Object.keys(english)).toEqual(Object.keys(chinese));
  expect(english.operation_arrow_title).toBe("Arrow");
  for (const value of Object.values(english))
    expect(value).not.toMatch(/[\u3400-\u9fff]/);
});
