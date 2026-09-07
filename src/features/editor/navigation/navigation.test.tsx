import { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { editorExtensions } from "../editor-extensions";
import { paragraphBlocks, readingBlock } from "./blocks";
import { ParagraphRail } from "./ParagraphRail";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("maps nested passages and atomic tables without duplicating containers or changing Markdown", () => {
  const editor = new Editor({
    extensions: editorExtensions(),
    contentType: "markdown",
    content:
      "# 花园\n\n一段 **文字**。\n\n> 引用\n\n- 列表一\n- 列表二\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1;\n```",
  });
  const before = editor.getMarkdown();
  const blocks = paragraphBlocks(editor.state.doc);
  expect(blocks.map((b) => b.kind)).toEqual([
    "heading",
    "paragraph",
    "paragraph",
    "paragraph",
    "paragraph",
    "table",
    "codeBlock",
  ]);
  expect(blocks[1].text).toBe("一段 文字。");
  expect(blocks[4].heading).toBe("花园");
  for (const block of blocks)
    expect(editor.state.doc.nodeAt(block.pos)?.type.name).toBe(block.kind);
  expect(editor.getMarkdown()).toBe(before);
  editor.destroy();
});

it("locates the reading passage at exact boundaries, before the first and after the last", () => {
  expect(readingBlock([], 20)).toBe(0);
  expect(readingBlock([40, 200, 800], 0)).toBe(0);
  expect(readingBlock([40, 200, 800], 200)).toBe(1);
  expect(readingBlock([40, 200, 800], 799)).toBe(1);
  expect(readingBlock([40, 200, 800], 900)).toBe(2);
});

it("supports keyboard previews, scroll-only navigation, reduced motion and document edits", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const editor = new Editor({
    extensions: editorExtensions(),
    contentType: "markdown",
    content: "# 花园\n\n第一段\n\n第二段",
  });
  const scroller = createRef<HTMLDivElement>();
  render(
    <div>
      <ParagraphRail editor={editor} scroller={scroller} />
      <div ref={scroller}>
        <EditorContent editor={editor} />
      </div>
    </div>,
  );
  const buttons = await screen.findAllByRole("button", { name: /^跳转到第/ });
  const scrollTo = vi.fn();
  scroller.current!.scrollTo = scrollTo;
  const before = editor.getMarkdown();
  const selection = editor.state.selection.toJSON();
  fireEvent.pointerEnter(buttons[2], { pointerType: "mouse" });
  expect(screen.getByRole("tooltip").textContent).toContain("第二段");
  fireEvent.pointerLeave(screen.getByRole("toolbar", { name: "段落导航" }));
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  act(() => {
    buttons[0].focus();
  });
  fireEvent.keyDown(buttons[0], { key: "ArrowDown" });
  expect(document.activeElement).toBe(buttons[1]);
  expect(screen.getByRole("tooltip").textContent).toContain("第一段");
  fireEvent.click(buttons[1]);
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(editor.state.selection.toJSON()).toEqual(selection);
  expect(editor.getMarkdown()).toBe(before);
  fireEvent.keyDown(buttons[1], { key: "End" });
  expect(document.activeElement).toBe(buttons[2]);
  expect(screen.getByRole("tooltip").textContent).toContain("第二段");
  fireEvent.keyDown(buttons[2], { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();
  act(() => {
    editor.commands.setContent("# 新文稿\n\n新段落", {
      contentType: "markdown",
    });
  });
  // Old passage positions are not used while the edit debounce is pending.
  scrollTo.mockClear();
  fireEvent.click(buttons[2]);
  expect(scrollTo).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: /^跳转到第/ })).toHaveLength(
      2,
    ),
  );
  expect(
    screen.getByRole("button", { name: "跳转到第 2 段：新段落" }),
  ).toBeTruthy();
  cleanup();
  editor.destroy();
});
