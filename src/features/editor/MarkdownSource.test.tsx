import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorView } from "codemirror";
import {
  SearchQuery,
  replaceAll,
  setSearchQuery,
  searchPanelOpen,
  getSearchQuery,
} from "@codemirror/search";
import { undo, redo } from "@codemirror/commands";
import { MarkdownSource } from "./MarkdownSource";
import { changeLanguage } from "../../shared/i18n";

afterEach(async () => {
  cleanup();
  await changeLanguage("zh-CN");
});
it("preserves raw front matter, math and CRLF through replacement and undo", async () => {
  const value =
    "---\r\ntitle: Test\r\n---\r\n\r\n$$x^2$$\r\n\r\nHello **world**. Hello again.";
  const onChange = vi.fn();
  const onHistory = vi.fn();
  const { container, rerender } = render(
    <MarkdownSource
      value={value}
      onChange={onChange}
      onHistory={onHistory}
      find={false}
      onCloseFind={vi.fn()}
    />,
  );
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  expect(view.state.sliceDoc()).toBe(value);
  expect(onChange).not.toHaveBeenCalled();
  act(() => {
    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({ search: "Hello", replace: "Hi" }),
      ),
    });
    replaceAll(view);
  });
  expect(onChange.mock.lastCall?.[0]).toBe(value.replaceAll("Hello", "Hi"));
  expect(onHistory.mock.lastCall?.[0].canUndo).toBe(true);
  act(() => {
    undo(view);
  });
  expect(onChange.mock.lastCall?.[0]).toBe(value);
  expect(onHistory.mock.lastCall?.[0].canRedo).toBe(true);
  act(() => {
    redo(view);
  });
  expect(onChange.mock.lastCall?.[0]).toContain("Hi **world**");
  rerender(
    <MarkdownSource
      value={view.state.sliceDoc()}
      onChange={onChange}
      find
      onCloseFind={vi.fn()}
    />,
  );
  await waitFor(() => expect(searchPanelOpen(view.state)).toBe(true));
});

it("changes an open search panel language while keeping the query, manuscript and undo history", async () => {
  await changeLanguage("zh-CN");
  const onChange = vi.fn();
  const onCloseFind = vi.fn();
  const props = { value: "# 原文\n\nHello", onChange, onCloseFind, find: true };
  const { container, rerender } = render(<MarkdownSource {...props} />);
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!;
  await screen.findByRole("textbox", { name: "查找" });
  act(() => {
    view.dispatch({
      changes: { from: view.state.doc.length, insert: " world" },
    });
    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({
          search: "Hello",
          replace: "Hi",
          caseSensitive: true,
        }),
      ),
    });
  });
  const edited = view.state.sliceDoc();
  await act(() => changeLanguage("en"));
  rerender(<MarkdownSource {...props} value={edited} />);
  await screen.findByRole("textbox", { name: "Find" });
  expect(screen.queryByRole("textbox", { name: "查找" })).toBeNull();
  expect(getSearchQuery(view.state).search).toBe("Hello");
  expect(getSearchQuery(view.state).caseSensitive).toBe(true);
  expect(view.state.sliceDoc()).toBe(edited);
  act(() => {
    undo(view);
  });
  expect(view.state.sliceDoc()).toBe(props.value);
  expect(onCloseFind).not.toHaveBeenCalled();
});
