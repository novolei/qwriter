import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState, type RefObject } from "react";
import { paragraphBlocks, readingBlock, type ParagraphBlock } from "./blocks";

export function useParagraphNavigation(
  editor: Editor,
  scroller: RefObject<HTMLDivElement | null>,
) {
  const [blocks, setBlocks] = useState<ParagraphBlock[]>([]);
  const [active, setActive] = useState(0);
  const positions = useRef<number[]>([]);
  const indexedDocument = useRef(editor.state.doc);
  useEffect(() => {
    const scroll = scroller.current;
    if (!scroll || editor.isDestroyed) return;
    let entries: ParagraphBlock[] = [];
    let layoutFrame = 0;
    let scrollFrame = 0;
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    function locate() {
      const bottom = scroll!.scrollHeight - scroll!.clientHeight;
      const index =
        bottom > 1 && scroll!.scrollTop >= bottom - 2
          ? Math.max(0, entries.length - 1)
          : readingBlock(
              positions.current,
              scroll!.scrollTop + Math.min(96, scroll!.clientHeight * 0.2),
            );
      setActive(index);
    }
    function measure() {
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(() => {
        if (editor.isDestroyed || editor.state.doc !== indexedDocument.current)
          return;
        const origin = scroll!.getBoundingClientRect().top - scroll!.scrollTop;
        positions.current = entries.map((block) => {
          const node = editor.view.nodeDOM(block.pos);
          return node instanceof Element
            ? node.getBoundingClientRect().top - origin
            : 0;
        });
        locate();
      });
    }
    function rebuild() {
      indexedDocument.current = editor.state.doc;
      entries = paragraphBlocks(editor.state.doc);
      setBlocks(entries);
      measure();
    }
    function update() {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(rebuild, 120);
    }
    function onScroll() {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(locate);
    }
    rebuild();
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    observer.observe(editor.view.dom);
    editor.on("update", update);
    scroll.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      editor.off("update", update);
      observer.disconnect();
      scroll.removeEventListener("scroll", onScroll);
      clearTimeout(updateTimer);
      cancelAnimationFrame(layoutFrame);
      cancelAnimationFrame(scrollFrame);
    };
  }, [editor, scroller]);

  function jump(index: number) {
    const scroll = scroller.current;
    const block = blocks[index];
    if (
      !scroll ||
      !block ||
      editor.isDestroyed ||
      editor.state.doc !== indexedDocument.current
    )
      return;
    // Re-resolve at activation, so resizing / font loading cannot leave a stale target.
    const node = editor.view.nodeDOM(block.pos);
    if (!(node instanceof Element)) return;
    const offset =
      node.getBoundingClientRect().top -
      scroll.getBoundingClientRect().top +
      scroll.scrollTop;
    scroll.scrollTo({
      top: Math.max(0, offset - 48),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    setActive(index);
  }
  return { blocks, active, jump };
}
