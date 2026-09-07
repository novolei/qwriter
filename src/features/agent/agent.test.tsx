import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWritingAgent } from "./useWritingAgent";
import type { AgentEvent, AgentOutput } from "../../shared/ipc/bindings";
import { knowledgeChunk } from "../../test/fixtures/knowledge";

const mock = vi.hoisted(() => ({ run: vi.fn(), cancel: vi.fn() }));
vi.mock("../../shared/ipc/bindings", () => ({
  commands: {
    agentRun: mock.run,
    agentCancel: mock.cancel,
    agentSessionSave: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  Channel: class {
    onmessage = (_event: AgentEvent) => {};
  },
}));
const doc = {
  id: "one",
  title: "Original",
  markdown: "Original text",
  updated: 1,
};
const extra = {
  id: "two",
  title: "Reference",
  markdown: "Private notes",
  updated: 1,
};
const output: AgentOutput = {
  status: "complete",
  answer: "",
  draft: { title: "Draft", markdown: "New text", summary: "Edited" },
  readIds: ["one"],
  rounds: 2,
  memories: [],
  memoryReadIds: [],
  knowledgeSources: [],
};
function props() {
  return {
    docs: [doc, extra],
    current: doc,
    config: {
      id: "model",
      name: "Local",
      provider: "Ollama",
      baseUrl: "http://localhost:11434/v1",
      model: "local",
      protocol: "openai",
      apiKey: "",
    },
    editor: null,
    flush: vi.fn().mockResolvedValue(undefined),
    setDocs: vi.fn(),
    selectDoc: vi.fn(),
    notify: vi.fn(),
  };
}
beforeEach(() => {
  localStorage.clear();
  mock.run.mockReset();
  mock.cancel.mockReset();
  mock.cancel.mockResolvedValue(undefined);
  mock.run.mockResolvedValue(output);
});
afterEach(cleanup);
it("restores a task as reviewable history without granting permission to replace a changed document", () => {
  const { result } = renderHook(() => useWritingAgent(props()));
  act(() =>
    result.current.resume({
      id: "history",
      instruction: "Original goal",
      model: "model",
      documentId: "old",
      createdAt: 1,
      output,
    }),
  );
  expect(result.current.result?.draft?.markdown).toBe("New text");
  expect(result.current.canApply).toBe(false);
  expect(result.current.followup).toBe(true);
  act(() =>
    result.current.resume({
      id: "history2",
      instruction: "Unfinished goal",
      model: "model",
      documentId: "old",
      createdAt: 1,
      output: { ...output, draft: null, status: "limit" },
    }),
  );
  expect(result.current.prompt).toBe("Unfinished goal");
  expect(result.current.followup).toBe(false);
});
it("sends only explicitly selected references and prevents a double submission", async () => {
  const p = props();
  const { result } = renderHook(() => useWritingAgent(p));
  act(() => {
    result.current.setPrompt("Rewrite");
    result.current.setIncludeCurrent(false);
    result.current.setSelected(["one", "two"]);
  });
  await act(async () => {
    await Promise.all([result.current.run(), result.current.run()]);
  });
  expect(mock.run).toHaveBeenCalledOnce();
  expect(
    mock.run.mock.calls[0][2].notes.map((n: { id: string }) => n.id),
  ).toEqual(["two"]);
  expect(p.setDocs).not.toHaveBeenCalled();
  expect(result.current.canApply).toBe(true);
});
it("refuses stale drafts, including edits made while flushing to disk", async () => {
  let resolve: () => void = () => {};
  const p = props();
  p.flush.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const { result, rerender } = renderHook((values) => useWritingAgent(values), {
    initialProps: p,
  });
  act(() => result.current.setPrompt("Rewrite"));
  await act(() => result.current.run());
  let application: Promise<void>;
  act(() => {
    application = result.current.apply();
  });
  rerender({ ...p, current: { ...doc, markdown: "New user edits" } });
  await act(async () => {
    resolve();
    await application;
  });
  expect(p.setDocs).not.toHaveBeenCalled();
  expect(result.current.canApply).toBe(false);
  expect(result.current.error).toContain("保存期间");
});
it("queues an early cancel until registration and never permits partial application", async () => {
  let event: (event: AgentEvent) => void = () => {};
  let finish: (result: AgentOutput) => void = () => {};
  mock.run.mockImplementation((_id, _config, _input, channel) => {
    event = channel.onmessage;
    return new Promise<AgentOutput>((resolve) => {
      finish = resolve;
    });
  });
  const { result } = renderHook(() => useWritingAgent(props()));
  act(() => result.current.setPrompt("Rewrite"));
  let pending: Promise<void>;
  act(() => {
    pending = result.current.run();
  });
  await act(() => result.current.stop());
  expect(mock.cancel).not.toHaveBeenCalled();
  act(() => event({ type: "started" }));
  expect(mock.cancel).toHaveBeenCalledOnce();
  await act(async () => {
    finish({ ...output, status: "cancelled", draft: null });
    await pending;
  });
  expect(result.current.canApply).toBe(false);
});
it("reuses the previous draft only after explicit follow-up and keeps the original intact", async () => {
  const p = props();
  const { result } = renderHook(() => useWritingAgent(p));
  act(() => result.current.setPrompt("Rewrite"));
  await act(() => result.current.run());
  act(() => {
    result.current.setFollowup(true);
    result.current.setPrompt("Make it warmer");
  });
  await act(() => result.current.run());
  expect(
    mock.run.mock.calls[1][2].notes.find(
      (n: { id: string }) => n.id === "qwriter:previous-draft",
    ).markdown,
  ).toBe("New text");
  act(() => result.current.save());
  const updated = p.setDocs.mock.calls[0][0]([doc, extra]);
  expect(updated).toHaveLength(3);
  expect(updated[1]).toEqual(doc);
});
it("cancels late registration when the workspace has already unmounted", async () => {
  let emit: (event: AgentEvent) => void = () => {};
  let finish: (output: AgentOutput) => void = () => {};
  mock.run.mockImplementation((_id, _config, _input, channel) => {
    emit = channel.onmessage;
    return new Promise<AgentOutput>((resolve) => {
      finish = resolve;
    });
  });
  const { result, unmount } = renderHook(() => useWritingAgent(props()));
  act(() => result.current.setPrompt("Rewrite"));
  let pending: Promise<void>;
  act(() => {
    pending = result.current.run();
  });
  unmount();
  mock.cancel.mockClear();
  emit({ type: "started" });
  expect(mock.cancel).toHaveBeenCalledOnce();
  await act(async () => {
    finish({ ...output, status: "cancelled", draft: null });
    await pending;
  });
});

it("uses the reviewed citation content for apply, save and explicit follow-up", async () => {
  const cited: AgentOutput = {
    ...output,
    draft: {
      ...output.draft!,
      markdown: `[Observation](#knowledge-${knowledgeChunk.id})`,
    },
    knowledgeSources: [knowledgeChunk],
  };
  mock.run.mockResolvedValue(cited);
  const p = props();
  const { result } = renderHook(() => useWritingAgent(p));
  act(() => result.current.setPrompt("Use evidence"));
  await act(() => result.current.run());
  const reviewed = result.current.citations.markdown;
  expect(reviewed).toContain(knowledgeChunk.content);
  expect(reviewed).not.toContain("#knowledge-");
  expect(result.current.citations.sourceCount).toBe(1);
  act(() => {
    result.current.setFollowup(true);
    result.current.setPrompt("Refine");
  });
  await act(() => result.current.run());
  expect(
    mock.run.mock.calls[1][2].notes.find(
      (note: { id: string }) => note.id === "qwriter:previous-draft",
    ).markdown,
  ).toBe(reviewed);
  await act(() => result.current.apply());
  expect(p.setDocs.mock.calls[0][0]([doc])[0].markdown).toBe(reviewed);
  await act(() => result.current.run());
  act(() => result.current.save());
  expect(p.selectDoc.mock.calls[0][0].markdown).toBe(reviewed);
});

it("honors opting out of source snapshots, including resumed historical drafts", async () => {
  const p = props();
  const { result } = renderHook(() => useWritingAgent(p));
  act(() => {
    result.current.resume({
      id: "cited-history",
      instruction: "Write",
      model: "model",
      documentId: "one",
      createdAt: 1,
      output: {
        ...output,
        draft: {
          ...output.draft!,
          markdown: `[Observation](#knowledge-${knowledgeChunk.id})`,
        },
        knowledgeSources: [knowledgeChunk],
      },
    });
    result.current.setRetainCitations(false);
    result.current.setPrompt("Refine");
  });
  expect(result.current.citations.markdown).toBe("Observation");
  expect(result.current.canApply).toBe(false);
  await act(() => result.current.run());
  expect(
    mock.run.mock.calls[0][2].notes.find(
      (note: { id: string }) => note.id === "qwriter:previous-draft",
    ).markdown,
  ).toBe("Observation");
});
