import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "../../shared/types";
import { recoverDrafts, useLibrary, validDocs } from "./useLibrary";
const ipc = vi.hoisted(() => ({ invoke: vi.fn(), close: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: ipc.invoke,
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async () => () => {},
    destroy: ipc.close,
  }),
}));
const first: Doc = { id: "a", title: "文稿", markdown: "原文", updated: 1 };
beforeEach(() => {
  localStorage.clear();
  ipc.invoke.mockReset();
});
afterEach(() => cleanup());
describe("library reliability", () => {
  it("loads disk before saving and does not overwrite it with seed content", async () => {
    ipc.invoke.mockImplementation(async (command) =>
      command === "library_load"
        ? { docs: [first], revision: 7, location: "test.db" }
        : 8,
    );
    const { result } = renderHook(() =>
      useLibrary([{ ...first, markdown: "过时缓存" }]),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.docs[0].markdown).toBe("原文");
    await act(() => result.current.flush());
    expect(
      ipc.invoke.mock.calls.filter(([c]) => c === "library_save"),
    ).toHaveLength(0);
  });
  it("serializes pending saves and uses the newest revision for typing during a save", async () => {
    let release: (value: number) => void = () => {};
    ipc.invoke.mockImplementation((command) => {
      if (command === "library_load")
        return Promise.resolve({
          docs: [first],
          revision: 1,
          location: "test.db",
        });
      const calls = ipc.invoke.mock.calls.filter(([c]) => c === "library_save");
      return calls.length === 1
        ? new Promise<number>((resolve) => {
            release = resolve;
          })
        : Promise.resolve(3);
    });
    const { result } = renderHook(() => useLibrary([first]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.setDocs([{ ...first, markdown: "第一次输入" }]));
    let pending: Promise<void>;
    act(() => {
      pending = result.current.flush();
    });
    act(() => result.current.setDocs([{ ...first, markdown: "第二次输入" }]));
    await act(async () => {
      release(2);
      await pending!;
    });
    const saves = ipc.invoke.mock.calls.filter(([c]) => c === "library_save");
    expect(saves).toHaveLength(2);
    expect(saves[1][1]).toMatchObject({
      expectedRevision: 2,
      docs: [{ markdown: "第二次输入" }],
    });
    expect(localStorage.getItem("qwriter.pending")).toBeNull();
  });
  it("retains a recoverable cache on a disk conflict and reports failure", async () => {
    ipc.invoke.mockImplementation(async (c) => {
      if (c === "library_load")
        return { docs: [first], revision: 1, location: "test.db" };
      throw new Error("stale writer");
    });
    const { result } = renderHook(() => useLibrary([first]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.setDocs([{ ...first, markdown: "不能丢失" }]));
    await act(async () => {
      await expect(result.current.flush()).rejects.toThrow("stale writer");
    });
    expect(result.current.error).toContain("stale writer");
    expect(
      JSON.parse(localStorage.getItem("qwriter.pending")!).docs[0].markdown,
    ).toBe("不能丢失");
  });
  it("saves to disk even if local cache is full", async () => {
    ipc.invoke.mockImplementation(async (c) =>
      c === "library_load"
        ? { docs: [first], revision: 1, location: "test.db" }
        : 2,
    );
    const { result } = renderHook(() => useLibrary([first]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    act(() => result.current.setDocs([{ ...first, markdown: "磁盘仍可保存" }]));
    await act(() => result.current.flush());
    expect(result.current.status).toBe("磁盘已保存");
  });
  it("recovery never silently overwrites a changed disk document", () => {
    const docs = recoverDrafts(
      [first],
      [{ ...first, markdown: "未保存的内容" }],
    );
    expect(docs).toHaveLength(2);
    expect(docs[0].id).not.toBe(first.id);
    expect(docs[1]).toEqual(first);
    expect(recoverDrafts([first], [first])).toEqual([first]);
    expect(validDocs([first, { ...first }])).toBe(false);
    expect(validDocs([{ id: "a" }])).toBe(false);
  });
});
