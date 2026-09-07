import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { errorText, t } from "../../shared/i18n";
import type { KnowledgeChunk, MemoryEntry } from "../../shared/ipc/bindings";
import { Modal } from "../../shared/ui/Modal";
import { memoryRepository } from "./repository";

export function KnowledgeSource({
  chunk,
  documentId,
  onClose,
  onEdit,
}: {
  chunk: KnowledgeChunk;
  documentId: string;
  onClose: () => void;
  onEdit?: (entry: MemoryEntry) => void;
}) {
  const [entry, setEntry] = useState<MemoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const anchor = useRef<HTMLElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setShowCurrent(false);
    setEntry(null);
    setError("");
    void memoryRepository
      .source(chunk.memoryId, documentId)
      .then((source) => {
        if (active) setEntry(source);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [chunk.memoryId, chunk.revision, documentId]);
  const matches = entry?.revision === chunk.revision;
  useEffect(() => {
    if (!loading && matches)
      anchor.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [loading, matches, chunk.id]);
  const characters = Array.from(entry?.content ?? "");
  // A saved task can outlive its source. Show its snapshot; never apply old offsets
  // to a newer version or suggest that retrieved evidence is automatically verified.
  const anchored =
    matches &&
    characters.slice(chunk.startOffset, chunk.endOffset).join("") ===
      chunk.content;
  const visibleSource = showCurrent && entry ? entry : chunk;
  return (
    <Modal
      title={t("知识来源")}
      eyebrow={t("让每一份参考，都有据可循")}
      onClose={onClose}
      className="knowledge-source-modal"
      settings
    >
      <div className="knowledge-source-heading">
        <FileText size={18} />
        <div>
          <h3>{visibleSource.title}</h3>
          <small>{visibleSource.source || t("本地知识收藏")}</small>
        </div>
      </div>
      <p className="knowledge-source-location">
        {!showCurrent && chunk.heading && <span>{chunk.heading}</span>}
        {showCurrent && entry
          ? t("当前版本 {{revision}} · 未应用旧位置", {
              revision: entry.revision,
            })
          : t("第 {{start}}–{{end}} 行 · 版本 {{revision}}", {
              start: chunk.startLine,
              end: chunk.endLine,
              revision: chunk.revision,
            })}
      </p>
      {loading ? (
        <p role="status">{t("正在打开…")}</p>
      ) : (
        <>
          {error && <p role="alert">{error}</p>}
          {!error && !anchored && (
            <p className="knowledge-source-notice" role="status">
              {t(
                showCurrent
                  ? "正在查看当前来源，可随时返回检索时的片段。"
                  : entry
                    ? "来源已更新，以下保留检索时的片段；旧行号不用于定位新版本。"
                    : "来源已归档或不在当前范围，以下仅保留检索时的片段。",
              )}
            </p>
          )}
          {showCurrent ? (
            <pre className="knowledge-source-text">{entry?.content}</pre>
          ) : anchored ? (
            <pre className="knowledge-source-text">
              {characters.slice(0, chunk.startOffset).join("")}
              <mark ref={anchor}>{chunk.content}</mark>
              {characters.slice(chunk.endOffset).join("")}
            </pre>
          ) : (
            <pre className="knowledge-source-text knowledge-source-snapshot">
              {chunk.content}
            </pre>
          )}
          <small>
            {t("这是知识收藏的独立副本。检索结果是参考资料，请核对后再引用。")}
          </small>
          <div className="modal-footer">
            {entry && !anchored && (
              <button onClick={() => setShowCurrent(!showCurrent)}>
                {t(showCurrent ? "返回检索片段" : "查看当前版本")}
              </button>
            )}
            {entry && onEdit && (
              <button onClick={() => onEdit(entry)}>{t("编辑知识条目")}</button>
            )}
            <button className="primary" onClick={onClose}>
              {t("完成")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
