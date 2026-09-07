import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { errorText, t } from "../../shared/i18n";
import type { KnowledgeChunk } from "../../shared/ipc/bindings";
import { memoryRepository } from "./repository";

export function KnowledgeSearch({
  query,
  documentId,
  revision,
  onOpen,
}: {
  query: string;
  documentId: string;
  revision: string;
  onOpen: (chunk: KnowledgeChunk) => void;
}) {
  const [results, setResults] = useState<KnowledgeChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void memoryRepository
        .search(query, documentId)
        .then((hits) => {
          if (active) setResults(hits);
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 160);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, documentId, revision]);
  return (
    <section className="knowledge-search" aria-label={t("知识检索结果")}>
      <small>
        {t("检索整个空间及当前文稿的知识，按相关性展示。点击片段查看来源。")}
      </small>
      {loading ? (
        <p role="status">{t("正在检索…")}</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !results.length ? (
        <div className="memory-empty">
          <Search size={22} />
          <p>{t("没有找到相关片段，试试更具体的关键词。")}</p>
        </div>
      ) : (
        <div className="knowledge-hits">
          {results.map((chunk) => (
            <button
              key={chunk.id}
              className="knowledge-hit"
              onClick={() => onOpen(chunk)}
            >
              <span>
                <strong>{chunk.title}</strong>
                <ArrowUpRight size={14} />
              </span>
              {chunk.heading && <small>{chunk.heading}</small>}
              <p>{chunk.content.slice(0, 300)}</p>
              <small>
                {t("第 {{start}}–{{end}} 行 · 版本 {{revision}}", {
                  start: chunk.startLine,
                  end: chunk.endLine,
                  revision: chunk.revision,
                })}
                {chunk.source && ` · ${chunk.source}`}
              </small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
