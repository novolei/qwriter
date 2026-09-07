import { Moon, Sun } from "lucide-react";
import {
  fontChoices,
  latinFontChoices,
  type FontId,
  type LatinFontId,
} from "../../features/settings/typography";
import {
  changeLanguage,
  language,
  t,
  type Language,
} from "../../shared/i18n/index";
import { Modal } from "../../shared/ui/Modal";
import { Select } from "../../shared/ui/Select";
import type { Workspace } from "../useWorkspace";
type Props = Pick<
  Workspace,
  | "appearance"
  | "typography"
  | "setTypography"
  | "dark"
  | "setDark"
  | "setAppearance"
  | "setSettings"
  | "library"
>;
export function AppearancePanel(props: Props) {
  const {
    appearance,
    typography,
    setTypography,
    dark,
    setDark,
    setAppearance,
    setSettings,
    library,
  } = props;
  return (
    <>
      {appearance && (
        <Modal
          settings
          title={t("外观与字体")}
          eyebrow={t("A SPACE OF YOUR OWN")}
          onClose={() => setAppearance(false)}
        >
          <p>{t("舒适的排版，让思绪自然流动。")}</p>
          <div className="settings-tabs">
            <button
              onClick={() => {
                setAppearance(false);
                setSettings(true);
              }}
            >
              {t("模型连接")}
            </button>
            <button className="chosen" aria-current="page">
              {t("外观与字体")}
            </button>
          </div>
          <label className="language-picker">
            {t("界面语言")}
            <Select
              aria-label={t("界面语言")}
              value={language()}
              onValueChange={(value) => void changeLanguage(value as Language)}
            >
              <option value="zh-CN" lang="zh-CN">
                简体中文
              </option>
              <option value="en">English</option>
            </Select>
            <small>{t("切换语言只改变界面，不会翻译或修改你的文稿。")}</small>
          </label>
          <div className="font-settings">
            <label>
              {t("界面中文字体")}
              <Select
                aria-label={t("界面中文字体")}
                value={typography.uiFont}
                onValueChange={(value) =>
                  setTypography({
                    ...typography,
                    uiFont: value as FontId,
                  })
                }
              >
                {fontChoices.map((f) => (
                  <option key={f.id} value={f.id}>
                    {t(f.name)}
                  </option>
                ))}
              </Select>
              <small>{t("用于侧栏、按钮、菜单与设置。")}</small>
            </label>
            <label>
              {t("界面英文字体")}
              <Select
                aria-label={t("界面英文字体")}
                value={typography.uiLatin}
                onValueChange={(value) =>
                  setTypography({
                    ...typography,
                    uiLatin: value as LatinFontId,
                  })
                }
              >
                {latinFontChoices.map((f) => (
                  <option key={f.id} value={f.id}>
                    {t(f.name)} · {t(f.kind)}
                  </option>
                ))}
              </Select>
            </label>
            <div className="ui-font-preview">
              <span>{t("我的写作空间")}</span>
              <span>{t("文件 · 编辑 · 灵感")}</span>
              <strong>Qwriter Aa 0123</strong>
            </div>
            <label>
              {t("文稿中文字体")}
              <Select
                aria-label={t("文稿中文字体")}
                value={typography.documentFont}
                onValueChange={(value) =>
                  setTypography({
                    ...typography,
                    documentFont: value as FontId,
                  })
                }
              >
                {fontChoices.map((f) => (
                  <option key={f.id} value={f.id}>
                    {t(f.name)}
                  </option>
                ))}
              </Select>
              <small>{t("仅改变文稿和正文预览，不影响界面字体。")}</small>
            </label>
            <label>
              {t("文稿英文字体")}
              <Select
                aria-label={t("文稿英文字体")}
                value={typography.documentLatin}
                onValueChange={(value) =>
                  setTypography({
                    ...typography,
                    documentLatin: value as LatinFontId,
                  })
                }
              >
                {latinFontChoices.map((f) => (
                  <option key={f.id} value={f.id}>
                    {t(f.name)} · {t(f.kind)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div
            className="appearance-preview"
            style={{
              fontSize: typography.fontSize,
              lineHeight: typography.lineHeight,
            }}
          >
            {t("山有木兮木有枝。")}
            <br />
            {t("把那些稍纵即逝的感受，")}
            <br />
            {t("写进自己的文字里。")}
            <br />
            <span className="latin-preview">
              A quiet place for your next great idea.
            </span>
          </div>
          <label>
            {t("正文字号")}
            <span>{typography.fontSize} px</span>
            <input
              aria-label={t("正文字号")}
              type="range"
              min="14"
              max="24"
              value={typography.fontSize}
              onChange={(e) =>
                setTypography({
                  ...typography,
                  fontSize: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            {t("行间距")}
            <span>{typography.lineHeight.toFixed(1)}</span>
            <input
              aria-label={t("行间距")}
              type="range"
              min="1.6"
              max="2.6"
              step="0.1"
              value={typography.lineHeight}
              onChange={(e) =>
                setTypography({
                  ...typography,
                  lineHeight: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            {t("稿纸宽度")}
            <span>{typography.width} px</span>
            <input
              aria-label={t("稿纸宽度")}
              type="range"
              min="640"
              max="960"
              step="20"
              value={typography.width}
              onChange={(e) =>
                setTypography({
                  ...typography,
                  width: Number(e.target.value),
                })
              }
            />
          </label>
          <div className="theme-choices">
            <button
              className={!dark ? "chosen" : ""}
              onClick={() => setDark(false)}
            >
              <Sun size={17} />
              {t("晨光 · 暖白")}
            </button>
            <button
              className={dark ? "chosen" : ""}
              onClick={() => setDark(true)}
            >
              <Moon size={17} />
              {t("夜读 · 墨绿")}
            </button>
          </div>
          <div className="storage-detail">
            <span>{t("文稿存储位置")}</span>
            <small>{t(library.location)}</small>
          </div>
        </Modal>
      )}
    </>
  );
}
