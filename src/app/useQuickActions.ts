import { useEffect, useState } from "react";
import {
  FilePlus2,
  FolderOpen,
  Download,
  Search,
  Focus,
  Palette,
  Settings,
  GitBranch,
  Sparkles,
  PanelLeft,
  Code2,
  ScanLine,
  StickyNote,
} from "lucide-react";
import type { Workspace } from "./useWorkspace";
import type { WorkspaceAction } from "../features/navigation/CommandPalette";
import { t } from "../shared/i18n/index";

type Props = Pick<
  Workspace,
  | "newDoc"
  | "importDoc"
  | "exportDoc"
  | "setFocus"
  | "setAppearance"
  | "setSettings"
  | "setGitWorkspace"
  | "setRight"
  | "setTab"
  | "setLeft"
  | "setSource"
  | "protectedSource"
> & { onAgent: () => void; onScreenshot: () => void; onQuickNote: () => void };
export function useQuickActions(p: Props) {
  const [palette, setPalette] = useState(false);
  const [find, setFind] = useState(false);
  const actions: WorkspaceAction[] = [
    {
      id: "screenshot",
      label: t("框选截图"),
      icon: ScanLine,
      keywords: "capture screenshot annotate ocr 截图 标注 识字",
      run: p.onScreenshot,
    },
    {
      id: "quick-note",
      label: t("随手速记"),
      icon: StickyNote,
      keywords: "quick note capture 灵感 速记",
      run: p.onQuickNote,
    },
    {
      id: "new",
      label: t("新建文稿"),
      icon: FilePlus2,
      keywords: "new document 新建",
      run: p.newDoc,
    },
    {
      id: "find",
      label: t("查找与替换"),
      icon: Search,
      shortcut: "Ctrl / ⌘ F",
      keywords: "find replace search 搜索",
      run: () => setFind(true),
    },
    {
      id: "agent",
      label: t("写作 Agent"),
      icon: Sparkles,
      keywords: "AI agent 智能体",
      run: p.onAgent,
    },
    {
      id: "import",
      label: t("导入 Markdown"),
      icon: FolderOpen,
      keywords: "import open 导入",
      run: () => void p.importDoc(),
    },
    {
      id: "export",
      label: t("导出 Markdown 副本"),
      icon: Download,
      keywords: "export save 导出",
      run: () => void p.exportDoc(),
    },
    {
      id: "focus",
      label: t("切换专注模式"),
      icon: Focus,
      keywords: "focus 专注",
      run: () => p.setFocus((v) => !v),
    },
    {
      id: "appearance",
      label: t("外观与字体"),
      icon: Palette,
      keywords: "appearance fonts theme 字体 主题",
      run: () => p.setAppearance(true),
    },
    {
      id: "settings",
      label: t("模型与连接"),
      icon: Settings,
      keywords: "settings 设置 model api",
      run: () => p.setSettings(true),
    },
    {
      id: "git",
      label: t("Git 文稿工作区"),
      icon: GitBranch,
      keywords: "git version 版本",
      run: () => p.setGitWorkspace(true),
    },
    {
      id: "library",
      label: t("打开文稿库"),
      icon: PanelLeft,
      keywords: "library 文稿库",
      run: () => {
        p.setFocus(false);
        p.setLeft(true);
      },
    },
    {
      id: "source",
      label: t("切换 Markdown 源码"),
      icon: Code2,
      keywords: "source markdown 源码",
      run: () => {
        if (!p.protectedSource) p.setSource((v) => !v);
      },
    },
  ];
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        !(event.metaKey || event.ctrlKey)
      )
        return;
      if (document.querySelector("[role=dialog], [data-ui-overlay]")) return;
      const key = event.key.toLowerCase();
      if (key === "p" || key === "f") {
        event.preventDefault();
        if (key === "p") setPalette(true);
        else setFind(true);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  return { palette, setPalette, find, setFind, actions };
}
