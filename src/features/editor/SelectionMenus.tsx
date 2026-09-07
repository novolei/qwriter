import { TextSelection } from "@tiptap/pm/state";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import { Bold, Italic, Plus, Sparkles } from "lucide-react";
import { t } from "../../shared/i18n/index";

import { Tool } from "./Tool";
import type { ToolbarProps } from "./toolbar-types";
import type { ToolbarState } from "./useToolbar";
export function SelectionMenus({
  editor,
  source,
  dialog,
  panel,
  state,
  command,
  setPanel,
  root,
  props,
}: Pick<
  ToolbarState,
  | "editor"
  | "source"
  | "dialog"
  | "panel"
  | "state"
  | "command"
  | "setPanel"
  | "root"
> & { props: ToolbarProps }) {
  return (
    <>
      {" "}
      {editor && !source && (
        <>
          <BubbleMenu
            editor={editor}
            options={{ placement: "top", offset: 10, shift: { padding: 12 } }}
            updateDelay={100}
            shouldShow={({ editor: e, from, to }) =>
              !dialog &&
              !panel &&
              e.isFocused &&
              e.state.selection instanceof TextSelection &&
              from !== to &&
              !!e.state.doc.textBetween(from, to).trim()
            }
            className="selection-bubble"
            role="group"
            aria-label={t("选区工具栏")}
          >
            <Tool
              label={t("选区加粗")}
              active={state?.bold}
              onClick={() =>
                command((e) => e.chain().focus().toggleBold().run())
              }
            >
              <Bold size={15} />
            </Tool>
            <Tool
              label={t("选区斜体")}
              active={state?.italic}
              onClick={() =>
                command((e) => e.chain().focus().toggleItalic().run())
              }
            >
              <Italic size={15} />
            </Tool>
            <span className="toolbar-divider" />
            <button
              className="selection-ai"
              disabled={props.aiBusy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={props.onSelectionAi}
            >
              <Sparkles size={14} />
              {t("润色选段")}
            </button>
          </BubbleMenu>
          <FloatingMenu
            editor={editor}
            className="empty-line-menu"
            options={{ placement: "left", offset: 8, flip: false }}
            shouldShow={({ editor: e, state: s }) =>
              !dialog &&
              !panel &&
              e.isFocused &&
              s.selection.empty &&
              s.selection.$from.parent.type.name === "paragraph" &&
              s.selection.$from.parent.content.size === 0
            }
          >
            <button
              aria-label={t("在空段落插入")}
              title={t("在空段落插入")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setPanel("insert");
                root.current?.scrollIntoView({ block: "nearest" });
              }}
            >
              <Plus size={16} strokeWidth={1.5} />
            </button>
          </FloatingMenu>
        </>
      )}{" "}
    </>
  );
}
