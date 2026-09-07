import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryLibrary } from "./MemoryLibrary";
import { changeLanguage } from "../../shared/i18n";
const mock = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([]),
  save: vi.fn(),
}));
vi.mock("./repository", () => ({
  memoryRepository: mock,
  newMemory: (documentId = "") => ({
    id: "new",
    title: "",
    content: "",
    kind: "preference",
    documentId,
    source: "",
    archived: false,
    revision: 0,
    updatedAt: 0,
  }),
}));
afterEach(async () => {
  cleanup();
  await changeLanguage("zh-CN");
  mock.save.mockReset();
  mock.list.mockReset().mockResolvedValue([]);
});
it("keeps proposed memories unsaved until reviewed and retains edits after a failed save", async () => {
  const proposal = {
    title: "Tone",
    content: "Concise sentences",
    kind: "preference",
    source: "User feedback",
  };
  render(
    <MemoryLibrary
      current={{ id: "doc", title: "Title", markdown: "Original", updated: 1 }}
      proposal={proposal}
      onClose={() => {}}
    />,
  );
  expect(await screen.findByDisplayValue("Concise sentences")).toBeTruthy();
  expect(mock.save).not.toHaveBeenCalled();
  mock.save
    .mockRejectedValueOnce(new Error("记忆库暂时繁忙"))
    .mockImplementationOnce(async (entry) => ({ ...entry, revision: 1 }));
  fireEvent.change(screen.getByLabelText("记忆内容"), {
    target: { value: "Short, concrete sentences" },
  });
  fireEvent.click(screen.getByText("确认并保存记忆"));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByDisplayValue("Short, concrete sentences")).toBeTruthy();
  fireEvent.click(screen.getByText("确认并保存记忆"));
  await waitFor(() => expect(mock.save).toHaveBeenCalledTimes(2));
  expect(mock.save.mock.calls[1][0]).toMatchObject({
    documentId: "doc",
    content: "Short, concrete sentences",
  });
});
it("renders English memory controls and creates an editable document copy", async () => {
  await act(() => changeLanguage("en"));
  render(
    <MemoryLibrary
      current={{
        id: "doc",
        title: "Source",
        markdown: "Original content",
        updated: 1,
      }}
      onClose={() => {}}
    />,
  );
  fireEvent.click(await screen.findByText("Collect current document"));
  expect(await screen.findByDisplayValue("Original content")).toBeTruthy();
  expect(screen.getByText("Confirm and save memory")).toBeTruthy();
  expect(mock.save).not.toHaveBeenCalled();
});
it("focuses new memory fields and keeps a saved record when an older initial read completes later", async () => {
  let loaded!: (entries: never[]) => void;
  mock.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        loaded = resolve;
      }),
  );
  mock.save.mockImplementationOnce(async (entry) => ({
    ...entry,
    revision: 1,
    updatedAt: 2,
  }));
  render(
    <MemoryLibrary
      current={{ id: "doc", title: "Title", markdown: "Original", updated: 1 }}
      onClose={() => {}}
    />,
  );
  fireEvent.click(screen.getByText("新增记忆"));
  expect(document.activeElement).toBe(screen.getByLabelText("记忆标题"));
  fireEvent.change(screen.getByLabelText("记忆标题"), {
    target: { value: "New memory" },
  });
  fireEvent.change(screen.getByLabelText("记忆内容"), {
    target: { value: "A durable preference" },
  });
  fireEvent.click(screen.getByText("确认并保存记忆"));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByLabelText("搜索记忆与知识"),
    ),
  );
  await act(async () => loaded([]));
  expect(screen.getByText("New memory")).toBeTruthy();
});
