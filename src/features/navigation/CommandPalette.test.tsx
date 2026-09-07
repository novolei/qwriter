import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Search } from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { searchDocuments } from "./search";

afterEach(cleanup);
const docs = [
  { id: "one", title: "Garden", markdown: "A quiet morning", updated: 1 },
  { id: "two", title: "Morning", markdown: "A blue sea", updated: 2 },
];
it("shows media titles instead of internal JSON in document search", () => {
  const markdown =
    '```qwriter-media\n{"kind":"video","title":"Morning film","url":"qwriter-asset://test.mp4"}\n```\nNotes';
  const doc = { id: "media", title: "Draft", markdown, updated: 1 };
  const result = searchDocuments([doc], "film");
  expect(result[0].excerpt).toBe("Morning film Notes");
  expect(result[0].doc.markdown).toBe(markdown);
  const image = { ...doc, markdown: "![A moment](qwriter-asset://image.png)" };
  expect(searchDocuments([image], "moment")[0].excerpt).toBe("A moment");
});
it("searches content and prioritizes title matches without mutating documents", () => {
  expect(searchDocuments(docs, "morning").map((hit) => hit.doc.id)).toEqual([
    "two",
    "one",
  ]);
  expect(searchDocuments(docs, "quiet")[0].doc.id).toBe("one");
  expect(searchDocuments(docs, "missing")).toEqual([]);
  expect(docs[0].markdown).toBe("A quiet morning");
});
it("retargets keyboard selection when filtering removes the selected document", async () => {
  const run = vi.fn(),
    close = vi.fn();
  render(
    <CommandPalette
      docs={docs}
      active="one"
      onSelect={vi.fn()}
      onClose={close}
      actions={[{ id: "find", label: "查找与替换", icon: Search, run }]}
    />,
  );
  const input = await screen.findByRole("combobox", { name: "搜索文稿与操作" });
  expect(screen.getByRole("listbox", { name: "搜索结果" })).toBeTruthy();
  fireEvent.change(input, { target: { value: "查找" } });
  await waitFor(() =>
    expect(
      document.querySelector('[cmdk-item][data-selected="true"]')?.textContent,
    ).toContain("查找"),
  );
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(run).toHaveBeenCalledOnce());
  expect(close).toHaveBeenCalledOnce();
});
