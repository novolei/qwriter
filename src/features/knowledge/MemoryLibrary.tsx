import {
  Archive,
  ArchiveRestore,
  BookOpen,
  FilePlus2,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorText, t } from "../../shared/i18n";
import type {
  KnowledgeChunk,
  MemoryEntry,
  MemoryProposal,
} from "../../shared/ipc/bindings";
import type { Doc } from "../../shared/types";
import { Modal } from "../../shared/ui/Modal";
import { MemoryEditor } from "./MemoryEditor";
import { memoryRepository, newMemory } from "./repository";
import { KnowledgeSearch } from "./KnowledgeSearch";
import { KnowledgeSource } from "./KnowledgeSource";

export function MemoryLibrary({
  current,
  proposal,
  onClose,
  readIds,
}: {
  current: Doc;
  proposal?: MemoryProposal;
  onClose: () => void;
  readIds?: string[];
}) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<KnowledgeChunk | null>(null);
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MemoryEntry | null>(() =>
    proposal
      ? {
          ...newMemory(current.id),
          ...proposal,
          source: `${t("Agent 建议")} · ${proposal.source}`,
        }
      : null,
  );
  const mounted = useRef(true);
  const saving = useRef(false);
  const importing = useRef(0);
  const file = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) search.current?.focus();
  }, [editing]);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    void memoryRepository
      .list()
      .then((loaded) => {
        if (!active) return;
        setEntries((current) => {
          const merged = new Map(loaded.map((entry) => [entry.id, entry]));
          for (const entry of current) {
            if ((merged.get(entry.id)?.revision ?? -1) <= entry.revision)
              merged.set(entry.id, entry);
          }
          return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
        });
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);
  async function save(entry: MemoryEntry) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = await memoryRepository.save(entry);
      if (!mounted.current) return;
      setEntries((old) => [saved, ...old.filter((e) => e.id !== saved.id)]);
      setEditing(null);
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const visible = entries.filter(
    (e) =>
      (readIds ? readIds.includes(e.id) : e.archived === archived) &&
      `${e.title} ${e.content} ${e.source}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <Modal
        title={t("记忆与知识库")}
        eyebrow={t("让经验，成为下一次创作的起点")}
        onClose={onClose}
        dismissible={!busy}
        className="memory-modal"
        settings
      >
        <p>
          {t(
            "保存在本机。只有开启本次任务的记忆访问后，相关内容才会交给所选模型。",
          )}
        </p>
        {readIds && <p>{t("显示当前保存的版本，可能与任务执行时不同。")}</p>}
        {error && (
          <p role="alert" className="agent-error">
            {error}
          </p>
        )}
        {editing ? (
          <MemoryEditor
            entry={editing}
            onChange={setEditing}
            busy={busy}
            documentId={editing.documentId || current.id}
            isCurrentDocument={
              !editing.documentId || editing.documentId === current.id
            }
            onSave={() => void save(editing)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            {!readIds && (
              <div className="memory-actions">
                <button
                  className="primary"
                  onClick={() => setEditing(newMemory())}
                >
                  <Plus size={14} />
                  {t("新增记忆")}
                </button>
                <button
                  onClick={() =>
                    setEditing({
                      ...newMemory(),
                      kind: "knowledge",
                      title: current.title,
                      content: current.markdown,
                      source: `${t("文稿")}: ${current.title}`,
                    })
                  }
                >
                  <FilePlus2 size={14} />
                  {t("收藏当前文稿")}
                </button>
                <button onClick={() => file.current?.click()}>
                  <Upload size={14} />
                  {t("导入知识")}
                </button>
                <input
                  ref={file}
                  type="file"
                  accept=".md,.txt,text/plain,text/markdown"
                  hidden
                  aria-label={t("导入知识文件")}
                  onChange={async (e) => {
                    const version = ++importing.current;
                    const selected = e.target.files?.[0];
                    e.target.value = "";
                    if (!selected) return;
                    try {
                      if (selected.size > 128 * 1024)
                        throw new Error(t("知识文件不能超过 128 KB"));
                      const content = await selected.text();
                      if (mounted.current && version === importing.current)
                        setEditing({
                          ...newMemory(),
                          kind: "knowledge",
                          title: selected.name.replace(/\.(md|txt)$/i, ""),
                          content,
                          source: selected.name,
                        });
                    } catch (error) {
                      if (mounted.current && version === importing.current)
                        setError(errorText(error));
                    }
                  }}
                />
              </div>
            )}
            <div className="catalog-search">
              <Search size={14} />
              <input
                ref={search}
                data-autofocus
                aria-label={t("搜索记忆与知识")}
                placeholder={t("搜索记忆与知识")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {!readIds && (
              <label className="memory-archive-toggle">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                />
                {t("查看已归档")}
              </label>
            )}
            {query.trim() && !archived && !readIds ? (
              <KnowledgeSearch
                query={query}
                documentId={current.id}
                revision={entries.map((e) => `${e.id}:${e.revision}`).join(",")}
                onOpen={setSource}
              />
            ) : loading ? (
              <p role="status">{t("正在打开…")}</p>
            ) : !visible.length ? (
              <div className="memory-empty">
                <BookOpen size={26} />
                <p>{t("把值得记住的偏好与素材，留在这里。")}</p>
              </div>
            ) : (
              <div className="memory-list">
                {visible.map((entry) => (
                  <article key={entry.id}>
                    <button
                      className="memory-open"
                      onClick={() => setEditing(entry)}
                    >
                      <strong>{entry.title}</strong>
                      <p>{entry.content.slice(0, 160)}</p>
                      <small>
                        {t(
                          entry.kind === "preference"
                            ? "写作偏好"
                            : entry.kind === "fact"
                              ? "事实与约定"
                              : "知识素材",
                        )}{" "}
                        ·{" "}
                        {t(
                          entry.documentId
                            ? entry.documentId === current.id
                              ? "仅当前文稿"
                              : "指定文稿"
                            : "整个写作空间",
                        )}
                        {entry.source && ` · ${entry.source}`}
                      </small>
                    </button>
                    <button
                      disabled={busy}
                      title={t(entry.archived ? "恢复记忆" : "归档记忆")}
                      onClick={() =>
                        void save({ ...entry, archived: !entry.archived })
                      }
                    >
                      {entry.archived ? (
                        <ArchiveRestore size={15} />
                      ) : (
                        <Archive size={15} />
                      )}
                    </button>
                  </article>
                ))}
              </div>
            )}
            <small>
              {t(
                "归档后不再用于新任务，可随时恢复。知识收藏是独立副本，不会自动跟随原稿变化。",
              )}
            </small>
          </>
        )}
      </Modal>
      {source && (
        <KnowledgeSource
          chunk={source}
          documentId={current.id}
          onClose={() => setSource(null)}
          onEdit={(entry) => {
            setSource(null);
            setEditing(entry);
          }}
        />
      )}
    </>
  );
}
