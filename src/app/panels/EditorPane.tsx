import { isTauri } from "@tauri-apps/api/core";
import { EditorContent } from "@tiptap/react";
import {
  ChevronRight,
  Download,
  GitBranch,
  History as HistoryIcon,
  Sparkles,
  Search,
  StickyNote,
  ImagePlus,
} from "lucide-react";
import { RichSearch } from "../../features/editor/search/RichSearch";
import { ParagraphRail } from "../../features/editor/navigation/ParagraphRail";
import { lazy, Suspense, useState } from "react";
import type { SourceHistory } from "../../features/editor/source-history";
import { EditorToolbar } from "../../features/editor/EditorToolbar";
import { errorText, locale, t } from "../../shared/i18n/index";
import { AppMenu } from "../components/AppMenu";
import { LibraryEntry } from "../components/LibraryEntry";
import type { Workspace } from "../useWorkspace";
const MarkdownSource = lazy(() =>
  import("../../features/editor/MarkdownSource").then((module) => ({
    default: module.MarkdownSource,
  })),
);
type Props = Pick<
  Workspace,
  | "setLeft"
  | "compact"
  | "libraryHint"
  | "dismissLibraryHint"
  | "left"
  | "current"
  | "setDocs"
  | "active"
  | "setGitWorkspace"
  | "setHistory"
  | "setNotice"
  | "exportDoc"
  | "setRight"
  | "right"
  | "editor"
  | "showSource"
  | "protectedSource"
  | "setSource"
  | "source"
  | "typography"
  | "setTypography"
  | "setAppearance"
  | "polishSelection"
  | "busy"
  | "paragraphFocus"
  | "typewriter"
  | "setParagraphFocus"
  | "setTypewriter"
  | "library"
  | "paperScroll"
  | "saveState"
  | "words"
  | "focus"
  | "setFocus"
  | "dark"
  | "setDark"
  | "setSettings"
> & {
  onMedia: () => void;
  onCapture: () => void;
  find: boolean;
  onCloseFind: () => void;
  onOpenCommands: () => void;
};
export function EditorPane(props: Props) {
  const [sourceHistory, setSourceHistory] = useState<SourceHistory | null>(
    null,
  );
  const {
    setLeft,
    left,
    current,
    setDocs,
    active,
    setGitWorkspace,
    setHistory,
    setNotice,
    exportDoc,
    setRight,
    right,
    editor,
    showSource,
    protectedSource,
    setSource,
    source,
    typography,
    setTypography,
    setAppearance,
    polishSelection,
    busy,
    paragraphFocus,
    typewriter,
    setParagraphFocus,
    setTypewriter,
    library,
    paperScroll,
    saveState,
    words,
    focus,
    setFocus,
    dark,
    setDark,
    setSettings,
  } = props;
  return (
    <>
      <main className="main">
        <div className="document-bar">
          <div className="breadcrumb">
            <LibraryEntry
              compact={props.compact}
              open={left && !focus}
              hint={props.libraryHint && !focus}
              onDismiss={props.dismissLibraryHint}
              onToggle={() => {
                if (focus) {
                  setFocus(false);
                  setLeft(true);
                } else setLeft(!left);
              }}
            />
            {!props.compact && <span>{t("文稿库")}</span>}
            <ChevronRight size={13} />
            <input
              aria-label={t("文稿标题")}
              value={current.title}
              onChange={(e) =>
                setDocs((old) =>
                  old.map((d) =>
                    d.id === active
                      ? {
                          ...d,
                          title: e.target.value,
                        }
                      : d,
                  ),
                )
              }
            />
          </div>
          <div className="document-actions">
            <button
              className="quick-entry"
              aria-label={t("快速抵达")}
              title={t("快速抵达 · Ctrl / ⌘ P")}
              onClick={props.onOpenCommands}
            >
              <Search size={16} />
            </button>
            {focus && (
              <AppMenu
                compact
                dark={dark}
                focus={focus}
                onTheme={() => setDark(!dark)}
                onFocus={() => setFocus(!focus)}
                onAppearance={() => setAppearance(true)}
                onSettings={() => setSettings(true)}
              />
            )}
            <button title={t("灵感匣")} onClick={props.onCapture}>
              <StickyNote size={16} />
            </button>
            <button title={t("素材与链接")} onClick={props.onMedia}>
              <ImagePlus size={16} />
            </button>
            <button
              title={t("Git 文稿工作区")}
              onClick={() => setGitWorkspace(true)}
            >
              <GitBranch size={16} />
            </button>
            <button
              title={t("文稿历史")}
              onClick={() => {
                if (isTauri()) setHistory(true);
                else setNotice("文稿历史在桌面版中可用");
              }}
            >
              <HistoryIcon size={16} />
            </button>
            <button title={t("导出 Markdown 副本")} onClick={exportDoc}>
              <Download size={16} />
            </button>
            <button
              className={right ? "active-tool" : ""}
              title={t("AI 写作伙伴")}
              onClick={() => setRight(!right)}
            >
              <Sparkles size={16} />
            </button>
          </div>
        </div>
        <EditorToolbar
          onMedia={props.onMedia}
          key={`toolbar:${current.id}`}
          editor={editor}
          source={showSource}
          sourceHistory={sourceHistory}
          onSource={() =>
            protectedSource
              ? setNotice("文稿含暂不支持的语法，已使用源码保护内容")
              : setSource(!source)
          }
          typography={typography}
          onTypography={setTypography}
          onAppearance={() => setAppearance(true)}
          onSelectionAi={polishSelection}
          aiBusy={busy}
          paragraphFocus={paragraphFocus}
          typewriter={typewriter}
          onParagraphFocus={() => setParagraphFocus(!paragraphFocus)}
          onTypewriter={() => setTypewriter(!typewriter)}
        />
        {props.find && editor && !showSource && (
          <RichSearch
            key={`find:${current.id}`}
            editor={editor}
            onClose={props.onCloseFind}
          />
        )}
        {library.error && (
          <div className="save-alert" role="alert">
            <span>{errorText(library.error)}</span>
            <button
              onClick={() =>
                void library.flush().catch((e) => setNotice(errorText(e)))
              }
            >
              {t("重试保存")}
            </button>
            <button onClick={exportDoc}>{t("导出副本")}</button>
          </div>
        )}
        {protectedSource && (
          <div className="source-notice">
            {t("这篇文稿含数学或扩展语法，已开启源码保护，保留原始内容。")}
          </div>
        )}
        <div
          className={`writing-canvas ${!showSource && editor ? "has-paragraph-rail" : ""}`}
        >
          {!showSource && editor && (
            <ParagraphRail
              key={`rail:${current.id}`}
              editor={editor}
              scroller={paperScroll}
            />
          )}
          <div className="paper-scroll" ref={paperScroll}>
            <article className="paper">
              <div className="paper-eyebrow">
                <span /> {t("个人笔记")}{" "}
                <span className="paper-date">
                  {new Date(current.updated).toLocaleDateString(locale(), {
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              {showSource ? (
                <Suspense
                  fallback={
                    <pre className="source-loading">{current.markdown}</pre>
                  }
                >
                  <MarkdownSource
                    onHistory={setSourceHistory}
                    key={current.id}
                    find={props.find}
                    onCloseFind={props.onCloseFind}
                    value={current.markdown}
                    onChange={(markdown) => {
                      setDocs((old) =>
                        old.map((d) =>
                          d.id === active
                            ? {
                                ...d,
                                markdown,
                                updated: Date.now(),
                              }
                            : d,
                        ),
                      );
                      editor?.commands.setContent(markdown, {
                        contentType: "markdown",
                        emitUpdate: false,
                      });
                    }}
                  />
                </Suspense>
              ) : (
                <EditorContent editor={editor} />
              )}
              <div className="endmark">✦</div>
            </article>
          </div>
        </div>
        <footer className="statusbar">
          <span>
            <span className="local-dot" />
            {t(saveState)}
          </span>
          <div>
            <span>
              {t("wordCount", {
                count: words,
              })}
            </span>
            <span>
              {t("readingTime", {
                count: Math.max(1, Math.ceil(words / 400)),
              })}
            </span>
            <span>Markdown</span>
            <button onClick={() => setFocus(!focus)}>
              {focus ? t("退出专注 · Esc") : t("专注模式")}
            </button>
          </div>
        </footer>
      </main>
    </>
  );
}
