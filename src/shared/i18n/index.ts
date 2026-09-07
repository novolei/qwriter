import { errorMessage } from "../ipc/errors";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zh from "./locales/zh-CN.json";
export type Language = "zh-CN" | "en";
function initialLanguage(): Language {
  try {
    return localStorage.getItem("qwriter.language") === "en" ? "en" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}
void i18n.use(initReactI18next).init({
  resources: {
    "zh-CN": {
      translation: zh,
    },
    en: {
      translation: en,
    },
  },
  lng: initialLanguage(),
  fallbackLng: "zh-CN",
  supportedLngs: ["zh-CN", "en"],
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
  },
  initAsync: false,
  react: {
    useSuspense: false,
  },
});
export function t(key: string, options?: Record<string, unknown>): string {
  return String(i18n.t(key, options ?? {}));
}
export function locale() {
  return i18n.language === "en" ? "en-US" : "zh-CN";
}
export function language(): Language {
  return i18n.language === "en" ? "en" : "zh-CN";
}
export async function changeLanguage(value: Language) {
  await i18n.changeLanguage(value);
  try {
    localStorage.setItem("qwriter.language", value);
  } catch {
    /* active language still changes */
  }
}
function updateDocumentLanguage() {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language();
    document.documentElement.dir = i18n.dir();
    document.title = t("Qwriter · 让想法自然生长");
  }
}
i18n.on("languageChanged", updateDocumentLanguage);
updateDocumentLanguage();
export function errorText(error: unknown): string {
  const message = errorMessage(error).replace(/^Error:\s*/, "");
  const http = message.match(/^(?:模型服务|服务)返回 HTTP (\d+)/);
  if (http)
    return t("服务返回 HTTP {{status}}，请检查配置及配额", {
      status: http[1],
    });
  if (message.startsWith("文稿库无法打开："))
    return t("文稿库无法打开：{{reason}}", {
      reason: message.slice("文稿库无法打开：".length),
    });
  return t(message);
}
export default i18n;
