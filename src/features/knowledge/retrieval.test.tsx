import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { changeLanguage } from "../../shared/i18n";
import type { MemoryEntry, KnowledgeChunk } from "../../shared/ipc/bindings";
import { KnowledgeSearch } from "./KnowledgeSearch";
import { KnowledgeSource } from "./KnowledgeSource";
import { searchPreview, splitMemory } from "./previewRetrieval";

const repository = vi.hoisted(() => ({ search: vi.fn(), source: vi.fn() }));
vi.mock("./repository", () => ({ memoryRepository: repository }));
const entry: MemoryEntry = {
  id: "source",
  title: "Garden",
  content:
    "# 观察 🪶\r\n\r\n清晨的光影落在花园。\r\n\r\n## 风格\r\nUse concrete short sentences.",
  kind: "knowledge",
  documentId: "doc",
  source: "field-notes.md",
  archived: false,
  revision: 1,
  updatedAt: 1,
};
afterEach(async () => {
  cleanup();
  vi.resetAllMocks();
  await changeLanguage("zh-CN");
});

it("keeps Unicode source offsets correct and isolates CJK and English retrieval by scope", () => {
  const source = {
    ...entry,
    content:
      entry.content + "\n\n```md\n# not a heading\n```\n\n" + "🌲".repeat(2500),
  };
  const chunks = splitMemory(source);
  for (const chunk of chunks) {
    expect(Array.from(chunk.content).length).toBeLessThanOrEqual(1200);
    expect(
      Array.from(source.content)
        .slice(chunk.startOffset, chunk.endOffset)
        .join(""),
    ).toBe(chunk.content);
    expect(
      Array.from(source.content)
        .slice(0, chunk.startOffset)
        .filter((c) => c === "\n").length + 1,
    ).toBe(chunk.startLine);
  }
  expect(
    chunks.find((c) => c.content.includes("# not a heading"))?.heading,
  ).toBe("观察 🪶 / 风格");
  expect(searchPreview([entry], "光影 花园", "doc")[0].content).toContain(
    "清晨",
  );
  expect(
    searchPreview([entry], "concrete sentences", "doc")[0].heading,
  ).toContain("风格");
  expect(searchPreview([entry], "光影", "other")).toEqual([]);
  expect(searchPreview([{ ...entry, archived: true }], "光影", "doc")).toEqual(
    [],
  );
});

it("ignores a slow search after changing the query", async () => {
  let old!: (chunks: KnowledgeChunk[]) => void;
  repository.search.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        old = resolve;
      }),
  );
  const chunk = splitMemory(entry)[1];
  const { rerender } = render(
    <KnowledgeSearch
      query="old"
      documentId="doc"
      revision="1"
      onOpen={() => {}}
    />,
  );
  await waitFor(() =>
    expect(repository.search).toHaveBeenCalledWith("old", "doc"),
  );
  repository.search.mockResolvedValueOnce([{ ...chunk, title: "Latest" }]);
  rerender(
    <KnowledgeSearch
      query="new"
      documentId="doc"
      revision="1"
      onOpen={() => {}}
    />,
  );
  expect(await screen.findByText("Latest")).toBeTruthy();
  await act(async () => old([{ ...chunk, title: "Stale result" }]));
  expect(screen.queryByText("Stale result")).toBeNull();
});

it("opens exact source text with its anchor and exposes an explicit edit action", async () => {
  repository.source.mockResolvedValue(entry);
  const edit = vi.fn();
  const chunk = splitMemory(entry)[1];
  const { container } = render(
    <KnowledgeSource
      chunk={chunk}
      documentId="doc"
      onClose={() => {}}
      onEdit={edit}
    />,
  );
  await waitFor(() =>
    expect(document.querySelector("mark")?.textContent).toBe(chunk.content),
  );
  expect(container.textContent).not.toContain("undefined");
  fireEvent.click(screen.getByRole("button", { name: "编辑知识条目" }));
  expect(edit).toHaveBeenCalledWith(entry);
});

it("never applies stale offsets to a changed or archived source, in English too", async () => {
  await act(() => changeLanguage("en"));
  repository.source.mockResolvedValue({
    ...entry,
    revision: 2,
    title: "Revised garden",
    source: "updated-notes.md",
    content: "New content in a different location",
  });
  const chunk = splitMemory(entry)[1];
  const { rerender } = render(
    <KnowledgeSource chunk={chunk} documentId="doc" onClose={() => {}} />,
  );
  expect(await screen.findByText(/The source has changed/)).toBeTruthy();
  expect(document.querySelector("mark")).toBeNull();
  expect(
    document.querySelector(".knowledge-source-snapshot")?.textContent,
  ).toBe(chunk.content);
  fireEvent.click(
    screen.getByRole("button", { name: "View current revision" }),
  );
  expect(screen.getByText("New content in a different location")).toBeTruthy();
  expect(screen.getByText("Revised garden")).toBeTruthy();
  expect(screen.getByText("updated-notes.md")).toBeTruthy();
  expect(screen.getByText(/Current revision 2/)).toBeTruthy();
  expect(screen.getByText(/Showing the current source/)).toBeTruthy();
  expect(screen.queryByText(/Lines .*Revision 1/)).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Back to retrieved passage" }),
  );
  expect(screen.getByText("Garden")).toBeTruthy();
  expect(screen.getByText(/The source has changed/)).toBeTruthy();
  repository.source.mockResolvedValue(null);
  rerender(
    <KnowledgeSource
      chunk={{ ...chunk, revision: 3 }}
      documentId="doc"
      onClose={() => {}}
    />,
  );
  expect(await screen.findByText(/The source is archived/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "View current revision" }),
  ).toBeNull();
});
