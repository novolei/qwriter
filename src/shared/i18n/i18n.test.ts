import { afterEach, expect, it } from "vitest";
import i18n, { changeLanguage, errorText, locale, t } from "./index";
import en from "./locales/en.json";
import zh from "./locales/zh-CN.json";
afterEach(async () => {
  await changeLanguage("zh-CN");
  localStorage.clear();
});
it("ships matching complete Chinese and English resource catalogs", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  for (const value of Object.values(en))
    expect(value).not.toMatch(/[\u3400-\u9fff]/);
});
it("changes labels, document locale, plurals and native error messages", async () => {
  await changeLanguage("en");
  expect(t("外观与字体")).toBe("Appearance & fonts");
  expect(t("wordCount", { count: 1 })).toBe("1 character");
  expect(t("wordCount", { count: 2 })).toBe("2 characters");
  expect(locale()).toBe("en-US");
  expect(document.documentElement.lang).toBe("en");
  expect(document.documentElement.dir).toBe("ltr");
  expect(localStorage.getItem("qwriter.language")).toBe("en");
  expect(errorText("模型服务返回 HTTP 401，请检查配置及配额")).toContain(
    "HTTP 401",
  );
  expect(errorText("请先在设置中填写模型 ID")).toBe(
    "Enter a model ID in settings first.",
  );
  expect(i18n.resolvedLanguage).toBe("en");
});
