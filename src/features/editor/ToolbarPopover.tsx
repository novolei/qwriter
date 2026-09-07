import {
  AlignCenter,
  Check,
  Eraser,
  ImagePlus,
  Keyboard,
  Link2,
  ScanLine,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { t } from "../../shared/i18n/index";

import type { ToolbarProps } from "./toolbar-types";
import type { ToolbarState } from "./useToolbar";
export function ToolbarPopover({
  panel,
  setPanel,
  trigger,
  command,
  insertTools,
  openLink,
  typography,
  onTypography,
  props,
}: Pick<
  ToolbarState,
  | "panel"
  | "setPanel"
  | "trigger"
  | "command"
  | "insertTools"
  | "openLink"
  | "typography"
  | "onTypography"
> & { props: ToolbarProps }) {
  return (
    <>
      {" "}
      {panel && (
        <section
          className={`editor-popover ${panel === "insert" ? "insert-popover" : ""}`}
          aria-label={t(
            panel === "insert"
              ? "插入 Markdown"
              : panel === "reading"
                ? "写作视图"
                : "快捷键速查",
          )}
        >
          <div className="popover-heading">
            <span>
              {t(
                panel === "insert"
                  ? "丰富你的文稿"
                  : panel === "reading"
                    ? "舒适地写下去"
                    : "快捷键速查",
              )}
            </span>
            <button
              aria-label={t("关闭工具面板")}
              onClick={() => {
                setPanel(null);
                trigger.current?.focus();
              }}
            >
              <X size={14} />
            </button>
          </div>
          {panel === "insert" && (
            <>
              <div className="insert-grid">
                {insertTools.map((item) => (
                  <button
                    key={item.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => command(item.run)}
                  >
                    <item.icon size={18} />
                    <span>
                      <strong>{t(item.name)}</strong>
                      <small>{t(item.description)}</small>
                    </span>
                  </button>
                ))}
                <button onClick={() => openLink("link")}>
                  <Link2 size={18} />
                  <span>
                    <strong>{t("编辑链接")}</strong>
                    <small>{t("连接一条参考与灵感")}</small>
                  </span>
                </button>
                <button
                  onClick={() => {
                    if (props.onMedia) {
                      setPanel(null);
                      props.onMedia();
                    } else openLink("image");
                  }}
                >
                  <ImagePlus size={18} />
                  <span>
                    <strong>{t("素材与链接")}</strong>
                    <small>{t("图片、视频与网站卡片")}</small>
                  </span>
                </button>
              </div>
              <div className="popover-bottom">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    command((e) =>
                      e.chain().focus().unsetAllMarks().clearNodes().run(),
                    )
                  }
                >
                  <Eraser size={14} />
                  {t("清除格式")}
                </button>
                <button onClick={() => setPanel("help")}>
                  <Keyboard size={14} />
                  {t("快捷键速查")}
                </button>
              </div>
            </>
          )}
          {panel === "reading" && (
            <>
              <button
                className="reading-option"
                aria-pressed={props.paragraphFocus}
                onClick={props.onParagraphFocus}
              >
                <ScanLine size={18} />
                <span>
                  <strong>{t("段落聚焦")}</strong>
                  <small>{t("让正在书写的段落更清晰")}</small>
                </span>
                {props.paragraphFocus && <Check size={15} />}
              </button>
              <button
                className="reading-option"
                aria-pressed={props.typewriter}
                onClick={props.onTypewriter}
              >
                <AlignCenter size={18} />
                <span>
                  <strong>{t("打字机模式")}</strong>
                  <small>{t("让当前行停留在舒适的视线位置")}</small>
                </span>
                {props.typewriter && <Check size={15} />}
              </button>
              <label className="toolbar-line-height">
                {t("行间距")}
                <input
                  aria-label={t("快捷行距")}
                  type="range"
                  min="1.6"
                  max="2.6"
                  step="0.1"
                  value={typography.lineHeight}
                  onChange={(e) =>
                    onTypography({
                      ...typography,
                      lineHeight: Number(e.target.value),
                    })
                  }
                />
                <span>{typography.lineHeight.toFixed(1)}</span>
              </label>
              <p className="popover-footnote">
                {t("阅读排版只影响显示，不改写 Markdown 内容。")}
              </p>
              <div className="popover-bottom">
                <button
                  onClick={() => {
                    setPanel(null);
                    props.onAppearance();
                  }}
                >
                  <SlidersHorizontal size={14} />
                  {t("全部字体与外观设置")}
                </button>
                <button onClick={() => setPanel("help")}>
                  <Keyboard size={14} />
                  {t("快捷键")}
                </button>
              </div>
            </>
          )}
          {panel === "help" && (
            <div className="shortcut-list">
              {[
                ["粗体", "⌘/Ctrl B"],
                ["斜体", "⌘/Ctrl I"],
                ["编辑链接", "⌘/Ctrl K"],
                ["撤销", "⌘/Ctrl Z"],
                ["重做", "⌘/Ctrl Shift Z"],
                ["保存", "⌘/Ctrl S"],
                ["标题 1–6", "⌘/Ctrl Alt 1–6"],
              ].map(([name, key]) => (
                <div key={name}>
                  <span>{t(name)}</span>
                  <kbd>{key}</kbd>
                </div>
              ))}
              <p>
                {t("也可以直接输入 #、>、-、1. 或 ```，用 Markdown 开始一段。")}
              </p>
            </div>
          )}
        </section>
      )}{" "}
    </>
  );
}
