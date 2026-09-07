import {
  BookOpen,
  BookOpenText,
  GitBranch,
  Moon,
  Search,
  Settings,
  SquarePen,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { t } from "../../shared/i18n/index";
import { Tooltip } from "../../shared/ui/Tooltip";
import { AppMenu, type AppMenuProps } from "./AppMenu";

type Props = AppMenuProps & {
  libraryOpen: boolean;
  onLibrary: () => void;
  onSearch: () => void;
  onQuickNote: () => void;
  onKnowledge: () => void;
  onGit: () => void;
};

function RailButton({
  icon: Icon,
  label,
  onClick,
  libraryOpen,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  libraryOpen?: boolean;
}) {
  const library = libraryOpen !== undefined;
  return (
    <Tooltip label={label}>
      <button
        type="button"
        className={`rail-button ${library ? "rail-library" : ""}`}
        aria-label={label}
        aria-current={library ? "page" : undefined}
        aria-expanded={libraryOpen}
        aria-controls={library ? "library-sidebar" : undefined}
        onClick={onClick}
      >
        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

export function NavigationRail(props: Props) {
  return (
    <nav className="navigation-rail" aria-label={t("快捷导航")}>
      <div className="rail-brand">
        <AppMenu
          rail
          dark={props.dark}
          focus={props.focus}
          onTheme={props.onTheme}
          onFocus={props.onFocus}
          onAppearance={props.onAppearance}
          onSettings={props.onSettings}
        />
      </div>
      <div className="rail-destinations">
        <RailButton
          icon={BookOpenText}
          label={t("打开文稿库")}
          libraryOpen={props.libraryOpen}
          onClick={props.onLibrary}
        />
        <RailButton
          icon={Search}
          label={t("快速抵达")}
          onClick={props.onSearch}
        />
        <RailButton
          icon={SquarePen}
          label={t("随手速记")}
          onClick={props.onQuickNote}
        />
        <RailButton
          icon={BookOpen}
          label={t("记忆与知识库")}
          onClick={props.onKnowledge}
        />
      </div>
      <div className="rail-utilities">
        <RailButton
          icon={GitBranch}
          label={t("Git 文稿工作区")}
          onClick={props.onGit}
        />
        <RailButton
          icon={props.dark ? Sun : Moon}
          label={props.dark ? t("切换至日间模式") : t("切换至夜读模式")}
          onClick={props.onTheme}
        />
        <RailButton
          icon={Settings}
          label={t("设置")}
          onClick={props.onSettings}
        />
      </div>
    </nav>
  );
}
