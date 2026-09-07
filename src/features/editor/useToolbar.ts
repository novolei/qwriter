import { useEditorState, type Editor } from "@tiptap/react";
import { Code2, Minus, Quote, Table2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../../shared/i18n/index";
import { validEditorUrl } from "./editing";

import type { ToolbarProps } from "./toolbar-types";
export function useToolbar(props: ToolbarProps) {
  const { editor, source, typography, onTypography } = props;
  const [panel, setPanel] = useState<"insert" | "reading" | "help" | null>(
    null,
  );
  const [dialog, setDialog] = useState<"link" | "image" | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const range = useRef({ from: 0, to: 0 });
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            strike: e.isActive("strike"),
            code: e.isActive("code"),
            quote: e.isActive("blockquote"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            task: e.isActive("taskList"),
            link: e.isActive("link"),
            table: e.isActive("table"),
            codeBlock: e.isActive("codeBlock"),
            heading: e.isActive("heading")
              ? String(e.getAttributes("heading").level)
              : "0",
            undo: e.can().undo(),
            redo: e.can().redo(),
            selection: !e.state.selection.empty,
          }
        : null,
  });
  const disabled = !editor || source;
  const serif = typography.documentFont.endsWith("serif");
  useEffect(() => {
    if (!panel) return;
    const fit = () => {
      const element = root.current;
      if (element)
        element.style.setProperty(
          "--tools-max-height",
          `${Math.max(100, window.innerHeight - element.getBoundingClientRect().bottom - 20)}px`,
        );
    };
    fit();
    window.addEventListener("resize", fit);
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setPanel(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setPanel(null);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    root.current
      ?.querySelector<HTMLElement>(
        ".editor-popover button, .editor-popover input",
      )
      ?.focus();
    return () => {
      window.removeEventListener("resize", fit);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [panel]);
  function togglePanel(next: typeof panel, target: HTMLElement) {
    trigger.current = target;
    setPanel(panel === next ? null : next);
  }
  function command(action: (e: Editor) => unknown) {
    if (!editor || source) return;
    action(editor);
    setPanel(null);
  }
  function openLink(kind: "link" | "image") {
    if (!editor || source) return;
    const { from, to } = editor.state.selection;
    range.current = { from, to };
    setLabel(editor.state.doc.textBetween(from, to, " "));
    setUrl(kind === "link" ? (editor.getAttributes("link").href ?? "") : "");
    setError("");
    setPanel(null);
    setDialog(kind);
  }
  function submitLink() {
    if (!editor || !validEditorUrl(url, dialog === "image")) {
      setError(t("请输入有效的链接地址"));
      return;
    }
    const chain = editor.chain().focus().setTextSelection(range.current);
    if (dialog === "image")
      chain.setImage({ src: url.trim(), alt: label }).run();
    else if (
      range.current.from === range.current.to &&
      !editor.isActive("link")
    ) {
      chain
        .insertContent({
          type: "text",
          text: label.trim() || url.trim(),
          marks: [{ type: "link", attrs: { href: url.trim() } }],
        })
        .run();
    } else chain.extendMarkRange("link").setLink({ href: url.trim() }).run();
    setDialog(null);
  }
  const insertTools = [
    {
      name: "引用",
      description: "为重要的话留一点呼吸",
      icon: Quote,
      run: (e: Editor) => e.chain().focus().toggleBlockquote().run(),
    },
    {
      name: "代码块",
      description: "独立呈现代码与片段",
      icon: Code2,
      run: (e: Editor) => e.chain().focus().toggleCodeBlock().run(),
    },
    {
      name: "插入表格",
      description: "三列起步，随时增减",
      icon: Table2,
      run: (e: Editor) =>
        e
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      name: "分隔线",
      description: "让章节有清晰的停顿",
      icon: Minus,
      run: (e: Editor) => e.chain().focus().setHorizontalRule().run(),
    },
  ];
  return {
    editor,
    source,
    typography,
    onTypography,
    panel,
    setPanel,
    dialog,
    setDialog,
    url,
    setUrl,
    label,
    setLabel,
    error,
    root,
    trigger,
    range,
    state,
    disabled,
    serif,
    togglePanel,
    command,
    openLink,
    submitLink,
    insertTools,
  };
}
export type ToolbarState = ReturnType<typeof useToolbar>;
