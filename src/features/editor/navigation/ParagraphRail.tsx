import type { Editor } from "@tiptap/core";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { t } from "../../../shared/i18n";
import type { ParagraphBlock } from "./blocks";
import { useParagraphNavigation } from "./useParagraphNavigation";

function label(block: ParagraphBlock) {
  if (block.kind === "heading") return t("标题");
  if (block.kind === "codeBlock") return t("代码块");
  if (block.kind === "image") return t("图片");
  if (block.kind === "table") return t("表格");
  return t("段落");
}

export function ParagraphRail({
  editor,
  scroller,
}: {
  editor: Editor;
  scroller: RefObject<HTMLDivElement | null>;
}) {
  const { blocks, active, jump } = useParagraphNavigation(editor, scroller);
  const [preview, setPreview] = useState<number | null>(null);
  const [tabStop, setTabStop] = useState(0);
  const [previewTop, setPreviewTop] = useState(0);
  const [railScroll, setRailScroll] = useState(0);
  const rail = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const tooltipId = useId();
  const item = preview === null ? undefined : blocks[preview];
  function hide() {
    setPreview(null);
  }
  function cancelClose() {
    clearTimeout(closeTimer.current);
  }
  function closeSoon() {
    cancelClose();
    closeTimer.current = setTimeout(hide, 160);
  }
  function reveal(index: number) {
    cancelClose();
    setPreview(index);
  }
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    setPreview(null);
    setTabStop((value) => Math.min(value, Math.max(0, blocks.length - 1)));
  }, [blocks]);
  useEffect(() => {
    const list = rail.current;
    if (
      !list ||
      preview !== null ||
      root.current?.contains(document.activeElement)
    )
      return;
    setTabStop(active);
    const button = list.children[active] as HTMLElement | undefined;
    if (!button) return;
    const y = button.offsetTop;
    if (
      y < list.scrollTop ||
      y + button.offsetHeight > list.scrollTop + list.clientHeight
    )
      list.scrollTop = Math.max(0, y - list.clientHeight / 2);
  }, [active, preview]);
  useEffect(() => {
    if (preview === null) return;
    function position() {
      const button = rail.current?.children[preview!] as
        HTMLElement | undefined;
      const box = root.current?.getBoundingClientRect();
      if (!button || !box) return;
      const y = button.getBoundingClientRect().top - box.top;
      setPreviewTop(
        Math.max(
          8,
          Math.min(
            y - 30,
            box.height - (card.current?.offsetHeight ?? 160) - 8,
          ),
        ),
      );
    }
    position();
    const observer = new ResizeObserver(position);
    if (root.current) observer.observe(root.current);
    if (card.current) observer.observe(card.current);
    return () => observer.disconnect();
  }, [preview, railScroll]);
  if (blocks.length < 2) return null;
  return (
    <nav
      className="paragraph-navigation"
      ref={root}
      aria-label={t("段落导航")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) hide();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          hide();
        }
      }}
    >
      <div
        className="paragraph-rail"
        ref={rail}
        role="toolbar"
        aria-orientation="vertical"
        aria-label={t("段落导航")}
        onPointerLeave={closeSoon}
        onScroll={(event) => setRailScroll(event.currentTarget.scrollTop)}
        onKeyDown={(event) => {
          let next = tabStop;
          if (event.key === "ArrowDown")
            next = Math.min(blocks.length - 1, tabStop + 1);
          else if (event.key === "ArrowUp") next = Math.max(0, tabStop - 1);
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = blocks.length - 1;
          else return;
          event.preventDefault();
          setTabStop(next);
          (rail.current?.children[next] as HTMLElement)?.focus();
        }}
      >
        {blocks.map((block, index) => (
          <button
            key={block.pos}
            type="button"
            className={`paragraph-stop ${block.kind === "heading" ? "is-heading" : ""} ${active === index ? "is-current" : ""} ${preview === index ? "is-preview" : ""}`}
            style={
              {
                "--mark-width": `${block.kind === "heading" ? 23 : 9 + Math.min(12, Math.sqrt(block.text.length) * 1.25)}px`,
              } as CSSProperties
            }
            tabIndex={tabStop === index ? 0 : -1}
            aria-label={t("跳转到第 {{index}} 段：{{text}}", {
              index: index + 1,
              text: block.text.slice(0, 64) || label(block),
            })}
            aria-current={active === index ? "location" : undefined}
            aria-describedby={preview === index ? tooltipId : undefined}
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") reveal(index);
            }}
            onFocus={() => {
              setTabStop(index);
              reveal(index);
            }}
            onClick={() => {
              jump(index);
              hide();
            }}
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
      {item && (
        <div
          className="paragraph-peek"
          ref={card}
          role="tooltip"
          id={tooltipId}
          style={{ top: previewTop }}
          onPointerEnter={cancelClose}
          onPointerLeave={closeSoon}
        >
          <div className="paragraph-peek-meta">
            <span>{label(item)}</span>
            <span>
              {preview! + 1} / {blocks.length}
            </span>
          </div>
          <strong>{item.heading || label(item)}</strong>
          <p>
            {(item.kind === "heading"
              ? blocks[preview! + 1]?.text
              : item.text) ||
              item.text ||
              label(item)}
          </p>
          <span className="paragraph-peek-hint">
            {t("点击定位 · ↑ ↓ 浏览 · Enter 跳转")}
          </span>
        </div>
      )}
    </nav>
  );
}
