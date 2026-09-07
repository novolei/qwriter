import type { ReactNode } from "react";
import {
  BookOpen,
  FileText,
  FolderOpen,
  Maximize2,
  Moon,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { t } from "../../shared/i18n/index";
import { AppMenu } from "../components/AppMenu";
import type { Workspace } from "../useWorkspace";
type Props = Pick<
  Workspace,
  | "left"
  | "focus"
  | "search"
  | "setSearch"
  | "newDoc"
  | "docs"
  | "active"
  | "selectDoc"
  | "headings"
  | "importDoc"
  | "dark"
  | "setDark"
  | "setAppearance"
  | "setSettings"
  | "setFocus"
> & { captureEntry?: ReactNode };
export function LibrarySidebar(props: Props) {
  const {
    left,
    focus,
    search,
    setSearch,
    newDoc,
    docs,
    active,
    selectDoc,
    headings,
    importDoc,
    dark,
    setDark,
    setAppearance,
    setSettings,
    setFocus,
  } = props;
  return (
    <>
      {left && !focus && (
        <aside className="sidebar">
          <div className="sidebar-brand">
            <AppMenu
              dark={dark}
              focus={focus}
              onTheme={() => setDark(!dark)}
              onFocus={() => setFocus(!focus)}
              onAppearance={() => setAppearance(true)}
              onSettings={() => setSettings(true)}
            />
          </div>
          <div className="search">
            <Search size={15} />
            <input
              placeholder={t("搜索文稿…")}
              aria-label={t("搜索文稿")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>⌕</kbd>
          </div>
          <div className="section-label">
            {t("文稿库")}
            <button title={t("新建文稿")} onClick={newDoc}>
              <Plus size={16} />
            </button>
          </div>
          <div className="library-label">
            <BookOpen size={16} />
            {t("所有文稿")}
            <span>{docs.length}</span>
          </div>
          <div className="documents">
            {docs
              .filter(
                (d) => d.title.includes(search) || d.markdown.includes(search),
              )
              .map((d) => (
                <button
                  key={d.id}
                  className={`doc ${active === d.id ? "selected" : ""}`}
                  onClick={() => selectDoc(d)}
                >
                  <FileText size={16} />
                  <span>{d.title}</span>
                  {active === d.id && <i />}
                </button>
              ))}
          </div>
          <button className="new-document" onClick={newDoc}>
            <Plus size={16} />
            {t("新建文稿")}
          </button>
          {props.captureEntry}
          <div className="outline">
            <div className="section-label">
              {t("文稿大纲")}
              <span>{headings.length}</span>
            </div>
            {headings.map((h, i) => (
              <button
                key={i}
                style={{
                  paddingLeft: 12 * (h.match(/^#+/)?.[0].length ?? 1),
                }}
                onClick={() => {
                  const els = document.querySelectorAll(
                    ".tiptap h1,.tiptap h2,.tiptap h3,.tiptap h4,.tiptap h5,.tiptap h6",
                  );
                  els[i]?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }}
              >
                {h.replace(/^#+ /, "")}
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <span className="local-dot" />
            {t("本地优先 · 自由创作")}
            <button title={t("导入 Markdown")} onClick={importDoc}>
              <FolderOpen size={16} />
            </button>
          </div>
          <div className="sidebar-tools" aria-label={t("工作区设置")}>
            <button title={t("阅读与排版")} onClick={() => setAppearance(true)}>
              <SlidersHorizontal size={16} />
            </button>
            <button title={t("切换主题")} onClick={() => setDark(!dark)}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button title={t("专注模式")} onClick={() => setFocus(!focus)}>
              <Maximize2 size={16} />
            </button>
            <button title={t("设置")} onClick={() => setSettings(true)}>
              <Settings size={16} />
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
