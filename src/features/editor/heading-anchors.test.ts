import { Editor } from "@tiptap/core";
import { afterEach, expect, it, vi } from "vitest";
import { editorExtensions, requiresSource } from "./editor-extensions";
import { prepareCitations } from "../knowledge/citations";
import { knowledgeChunk } from "../../test/fixtures/knowledge";
import { validEditorUrl } from "./editing";

const editors: Editor[] = [];
function create(markdown: string, missing = vi.fn()) {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: editorExtensions({ onMissingTarget: missing }),
    content: markdown,
    contentType: "markdown",
  });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.replaceChildren();
});

it("opens exported citations after Markdown round-trip without persisting editor-only IDs", () => {
  const prepared = prepareCitations(`[观察](#knowledge-${knowledgeChunk.id})`, [
    knowledgeChunk,
  ]);
  expect(requiresSource(prepared.markdown)).toBe(false);
  const editor = create(prepared.markdown);
  const roundTrip = create(editor.getMarkdown());
  expect(roundTrip.getJSON()).toEqual(editor.getJSON());
  expect(JSON.stringify(editor.getJSON())).not.toContain('"id":');
  const link = roundTrip.view.dom.querySelector("a")!;
  const before = roundTrip.getMarkdown();
  expect(
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    ),
  ).toBe(false);
  expect(roundTrip.state.selection.$from.parent.textContent).toBe(
    "来源 1 · 花园观察 Garden",
  );
  expect(roundTrip.getMarkdown()).toBe(before);
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
});

it("supports Unicode, formatted and duplicate headings, keyboard navigation and renamed targets", () => {
  const missing = vi.fn();
  const editor = create(
    "[next](#你好-world-1)\n\n# **你好** World\n\n# 你好 World\n",
    missing,
  );
  const headings = Array.from(editor.view.dom.querySelectorAll("h1"));
  expect(headings.map((heading) => heading.id)).toEqual([
    "你好-world",
    "你好-world-1",
  ]);
  const link = editor.view.dom.querySelector("a")!;
  expect(link.tabIndex).toBe(0);
  expect(
    link.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    ),
  ).toBe(false);
  expect(editor.state.selection.$from.parent.textContent).toBe("你好 World");
  const from = editor.state.selection.$from.start();
  editor.commands.insertContentAt(
    { from, to: from + "你好 World".length },
    "Renamed",
  );
  expect(editor.view.dom.querySelectorAll("h1")[1].id).toBe("renamed");
  link.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
  expect(missing).toHaveBeenCalledOnce();
});

it("does not handle external links and rejects malformed anchors and image fragments", () => {
  const missing = vi.fn();
  const editor = create(
    "[outside](https://example.com)\n\n[missing](#%XX)",
    missing,
  );
  const [external, malformed] = editor.view.dom.querySelectorAll("a");
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  // Avoid jsdom navigation while retaining evidence that the plugin did not handle it.
  external.addEventListener(
    "click",
    (e) => {
      expect(e.defaultPrevented).toBe(false);
      e.preventDefault();
    },
    { once: true },
  );
  external.dispatchEvent(event);
  expect(missing).not.toHaveBeenCalled();
  malformed.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
  expect(missing).toHaveBeenCalledOnce();
  expect(validEditorUrl("#你好-world")).toBe(true);
  expect(validEditorUrl("#%XX")).toBe(false);
  expect(validEditorUrl("#你好", true)).toBe(false);
  editor.commands.setContent({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Unsafe",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ],
  });
  expect(editor.view.dom.querySelector("a")?.getAttribute("href")).toBe("");
});
