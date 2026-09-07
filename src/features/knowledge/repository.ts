import { isTauri } from "@tauri-apps/api/core";
import { openDB, type DBSchema } from "idb";
import {
  commands,
  type MemoryEntry,
  type KnowledgeChunk,
} from "../../shared/ipc/bindings";
import { t } from "../../shared/i18n";
import { searchPreview } from "./previewRetrieval";

export interface MemoryRepository {
  list(): Promise<MemoryEntry[]>;
  save(entry: MemoryEntry): Promise<MemoryEntry>;
  search(query: string, documentId: string): Promise<KnowledgeChunk[]>;
  source(memoryId: string, documentId: string): Promise<MemoryEntry | null>;
}
interface KnowledgeDatabase extends DBSchema {
  memories: { key: string; value: MemoryEntry };
}
const database = () =>
  openDB<KnowledgeDatabase>("qwriter.knowledge", 1, {
    upgrade(db) {
      db.createObjectStore("memories", { keyPath: "id" });
    },
  });
export const memoryRepository: MemoryRepository = {
  async search(query, documentId) {
    if (new TextEncoder().encode(query).length > 300)
      throw new Error(t("搜索内容不能超过 300 字节"));
    if (isTauri()) return commands.knowledgeSearch(query, documentId);
    return searchPreview(await this.list(), query, documentId);
  },
  async source(memoryId, documentId) {
    if (isTauri()) return commands.knowledgeSource(memoryId, documentId);
    const db = await database();
    try {
      const entry = await db.get("memories", memoryId);
      return entry &&
        !entry.archived &&
        (!entry.documentId || entry.documentId === documentId)
        ? entry
        : null;
    } finally {
      db.close();
    }
  },
  async list() {
    if (isTauri()) return commands.memoryList();
    const db = await database();
    try {
      return (await db.getAll("memories")).sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
    } finally {
      db.close();
    }
  },
  async save(entry) {
    if (isTauri()) return commands.memorySave(entry);
    if (
      !entry.title.trim() ||
      !entry.content.trim() ||
      new TextEncoder().encode(entry.content).length > 128 * 1024
    )
      throw new Error(t("记忆内容无效或超过大小限制"));
    const db = await database();
    try {
      const tx = db.transaction("memories", "readwrite");
      const old = await tx.store.get(entry.id);
      if ((old?.revision ?? 0) !== entry.revision) {
        tx.abort();
        await tx.done.catch(() => {});
        throw new Error(t("这条记忆已更新，请重新打开后编辑"));
      }
      if (!old && (await tx.store.count()) >= 1000) {
        tx.abort();
        await tx.done.catch(() => {});
        throw new Error(t("本地记忆已达到 1000 条上限"));
      }
      const saved = {
        ...entry,
        revision: entry.revision + 1,
        updatedAt: Date.now(),
      };
      await tx.store.put(saved);
      await tx.done;
      return saved;
    } finally {
      db.close();
    }
  },
};
export function newMemory(documentId = ""): MemoryEntry {
  return {
    id: crypto.randomUUID(),
    title: "",
    content: "",
    kind: "preference",
    documentId,
    source: "",
    archived: false,
    revision: 0,
    updatedAt: 0,
  };
}
