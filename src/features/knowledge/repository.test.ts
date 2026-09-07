import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false }));
import { memoryRepository, newMemory } from "./repository";

it("browser memories survive reopening and reject stale edits; archive restores without changing content", async () => {
  const input = {
    ...newMemory("doc"),
    title: "测试偏好",
    content: "Keep paragraphs concise.",
  };
  const saved = await memoryRepository.save(input);
  expect(
    (await memoryRepository.list()).find((m) => m.id === saved.id),
  ).toMatchObject({ content: input.content, revision: 1 });
  await expect(memoryRepository.save(input)).rejects.toThrow();
  const archived = await memoryRepository.save({ ...saved, archived: true });
  const restored = await memoryRepository.save({
    ...archived,
    archived: false,
  });
  expect(restored).toMatchObject({
    content: input.content,
    documentId: "doc",
    revision: 3,
  });
  expect(
    (await memoryRepository.search("concise paragraphs", "doc"))[0].revision,
  ).toBe(3);
  expect(await memoryRepository.source(saved.id, "other")).toBeNull();
  expect(await memoryRepository.source(saved.id, "doc")).toMatchObject({
    revision: 3,
  });
  await memoryRepository.save({ ...restored, archived: true });
  expect(await memoryRepository.search("concise paragraphs", "doc")).toEqual(
    [],
  );
  expect(await memoryRepository.source(saved.id, "doc")).toBeNull();
});
