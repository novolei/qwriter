import { isTauri } from "@tauri-apps/api/core";
import { openDB, type DBSchema } from "idb";
import { commands, type MemoryEntry } from "../../shared/ipc/bindings";
import { t } from "../../shared/i18n";

export interface MemoryRepository {
  list(): Promise<MemoryEntry[]>;
  save(entry: MemoryEntry): Promise<MemoryEntry>;
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
