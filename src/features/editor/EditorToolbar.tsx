import { type Editor } from "@tiptap/react";
import {
  Bold,
  CheckSquare,
  ChevronDown,
  Code,
  Code2,
  Columns3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Plus,
  Redo2,
  Rows3,
  SlidersHorizontal,
  Strikethrough,
  Table2,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { t } from "../../shared/i18n/index";
import { Select } from "../../shared/ui/Select";
import { toggleDocumentSerif } from "./editing";
import { LinkDialog } from "./LinkDialog";
import { SelectionMenus } from "./SelectionMenus";
import { ToolbarPopover } from "./ToolbarPopover";

import { Tool } from "./Tool";
import type { ToolbarProps } from "./toolbar-types";
import { useToolbar } from "./useToolbar";
export function EditorToolbar(props: ToolbarProps) {
  const tools = useToolbar(props);
  const {
    editor,
    source,
    typography,
    onTypography,
    panel,
    dialog,
    root,
    state,
    disabled,
    serif,
    togglePanel,
    command,
    openLink,
  } = tools;
  return (
    <>
      <div className="editor-workbench" ref={root}>
        <div
          className="editor-toolbar"
          role="group"
          aria-label={t("编辑工具栏")}
        >
          <div className="toolbar-cluster text-controls">
            <label className="block-picker" title={t("段落样式")}>
              <Select
                leadingIcon={<Pilcrow size={14} />}
                aria-label={t("段落样式")}
                value={state?.heading ?? "0"}
                disabled={disabled}
                onValueChange={(value) =>
                  command((ed) =>
                    value === "0"
                      ? ed.chain().focus().setParagraph().run()
                      : ed
                          .chain()
                          .focus()
                          .setHeading({
                            level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6,
                          })
                          .run(),
                  )
                }
              >
                <option value="0">{t("正文")}</option>
                {[1, 2, 3, 4, 5, 6].map((level) => (
                  <option key={level} value={level}>
                    {t("标题 {{level}}", { level })}
                  </option>
                ))}
              </Select>
            </label>
            <span className="toolbar-divider" />
            <label
              className="size-picker"
              title={t("阅读字号，不改变 Markdown 内容")}
            >
              <Select
                aria-label={t("快捷字号")}
                value={typography.fontSize}
                onValueChange={(value) =>
                  onTypography({
                    ...typography,
                    fontSize: Number(value),
                  })
                }
              >
                {[14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </label>
            <button
              className="font-toggle"
              aria-label={t(serif ? "切换为无衬线" : "切换为衬线")}
              title={t(serif ? "切换为无衬线" : "切换为衬线")}
              aria-pressed={serif}
              onClick={() => onTypography(toggleDocumentSerif(typography))}
            >
              <span className={serif ? "serif-sample" : "sans-sample"}>Aa</span>
              <span className="font-toggle-label">
                {t(serif ? "衬线" : "无衬线")}
              </span>
            </button>
          </div>
          <div className="toolbar-cluster format-controls">
            <Tool
              label={t("粗体")}
              shortcut="⌘/Ctrl B"
              active={state?.bold}
              disabled={disabled}
              onClick={() =>
                command((e) => e.chain().focus().toggleBold().run())
              }
            >
              <Bold size={16} />
            </Tool>
            <Tool
              label={t("斜体")}
              shortcut="⌘/Ctrl I"
              active={state?.italic}
              disabled={disabled}
              onClick={() =>
                command((e) => e.chain().focus().toggleItalic().run())
              }
            >
              <Italic size={16} />
            </Tool>
            <Tool
              label={t("删除线")}
              active={state?.strike}
              disabled={disabled}
              onClick={() =>
                command((e) => e.chain().focus().toggleStrike().run())
              }
            >
              <Strikethrough size={16} />
            </Tool>
            <Tool
              label={t("行内代码")}
              active={state?.code}
              disabled={disabled}
              onClick={() =>
                command((e) => e.chain().focus().toggleCode().run())
              }
            >
              <Code size={16} />
            </Tool>
            <Tool
              label={t("编辑链接")}
              shortcut="⌘/Ctrl K"
              active={state?.link}
              disabled={disabled}
              onClick={() => openLink("link")}
            >
              <Link2 size={16} />
            </Tool>
            <span className="toolbar-divider" />
            <Tool
              label={t("项目列表")}
              active={state?.bullet}
              disabled={disabled}
              onClick={() =>
                command((e) => e.chain().focus().toggleBulletList().run())
              }
            >
              <List size={16} />
            </Tool>
            <Tool
              label={t("有序列表")}
              active={state?.ordered}
              disabled={disabled}
              onClick={() =>
                command((e) => e.chain().focus().toggleOrderedList().run())
              }
            >
              <ListOrdered size={16} />
            </Tool>
            <Tool
              label={t("待办列表")}
              active={state?.task}
              disabled={disabled}
              onClick={() =>
                command((e) => e.chain().focus().toggleTaskList().run())
              }
            >
              <CheckSquare size={16} />
            </Tool>
            <button
              className="toolbar-disclosure"
              disabled={disabled}
              aria-expanded={panel === "insert"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => togglePanel("insert", e.currentTarget)}
            >
              <Plus size={15} />
              <span>{t("插入")}</span>
              <ChevronDown size={10} />
            </button>
          </div>
          <div className="toolbar-cluster utility-controls">
            <Tool
              label={t("撤销")}
              shortcut="⌘/Ctrl Z"
              disabled={
                source
                  ? !props.sourceHistory?.canUndo
                  : disabled || !state?.undo
              }
              onClick={() =>
                source
                  ? props.sourceHistory?.undo()
                  : command((e) => e.chain().focus().undo().run())
              }
            >
              <Undo2 size={15} />
            </Tool>
            <Tool
              label={t("重做")}
              shortcut="⌘/Ctrl Shift Z"
              disabled={
                source
                  ? !props.sourceHistory?.canRedo
                  : disabled || !state?.redo
              }
              onClick={() =>
                source
                  ? props.sourceHistory?.redo()
                  : command((e) => e.chain().focus().redo().run())
              }
            >
              <Redo2 size={15} />
            </Tool>
            <span className="toolbar-divider" />
            <Tool
              label={t("切换 Markdown 源码")}
              active={source}
              onClick={props.onSource}
            >
              <Code2 size={16} />
            </Tool>
            <button
              className={`edit-tool ${panel === "reading" ? "is-active" : ""}`}
              aria-label={t("写作视图")}
              title={t("写作视图")}
              aria-expanded={panel === "reading"}
              onClick={(e) => togglePanel("reading", e.currentTarget)}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
        </div>
        {state?.table && !source && (
          <div
            className="table-context"
            role="group"
            aria-label={t("表格操作")}
          >
            <span>
              <Table2 size={13} />
              {t("表格")}
            </span>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                command((e) => e.chain().focus().addRowAfter().run())
              }
            >
              <Rows3 size={13} />
              {t("添加行")}
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                command((e) => e.chain().focus().addColumnAfter().run())
              }
            >
              <Columns3 size={13} />
              {t("添加列")}
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                command((e) => e.chain().focus().deleteRow().run())
              }
            >
              {t("删除行")}
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                command((e) => e.chain().focus().deleteColumn().run())
              }
            >
              {t("删除列")}
            </button>
            <Tool
              label={t("删除表格")}
              onClick={() =>
                command((e) => e.chain().focus().deleteTable().run())
              }
            >
              <Trash2 size={13} />
            </Tool>
          </div>
        )}
        {state?.codeBlock && !source && (
          <div className="code-context">
            <Code2 size={13} />
            <label>
              {t("代码语言")}
              <input
                aria-label={t("代码语言")}
                placeholder="text / rust / python"
                value={editor?.getAttributes("codeBlock").language ?? ""}
                onChange={(e) =>
                  editor?.commands.updateAttributes("codeBlock", {
                    language: e.target.value.replace(/[^\w+#.-]/g, ""),
                  })
                }
              />
            </label>
          </div>
        )}
        {source && (
          <div className="source-toolbar-note">
            <Code2 size={12} />
            {t("源码模式 · 直接编辑 Markdown，排版设置仍可使用")}
          </div>
        )}
        <ToolbarPopover {...tools} props={props} />
      </div>
      <SelectionMenus {...tools} props={props} />
      <LinkDialog {...tools} />
      <LinkShortcut
        editor={editor}
        disabled={disabled || !!dialog}
        open={() => openLink("link")}
      />
    </>
  );
}
function LinkShortcut({
  editor,
  disabled,
  open,
}: {
  editor: Editor | null;
  disabled: boolean;
  open: () => void;
}) {
  const handler = useRef(open);
  handler.current = open;
  useEffect(() => {
    if (!editor || editor.isDestroyed || disabled) return;
    const key = (e: KeyboardEvent) => {
      if (
        editor.isFocused &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        handler.current();
      }
    };
    const el = editor.view.dom;
    el.addEventListener("keydown", key);
    return () => el.removeEventListener("keydown", key);
  }, [editor, disabled]);
  return null;
}
