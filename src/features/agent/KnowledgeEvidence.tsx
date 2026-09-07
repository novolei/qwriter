import { useState } from "react";
import { BookOpen } from "lucide-react";
import { t } from "../../shared/i18n";
import type { KnowledgeChunk } from "../../shared/ipc/bindings";
import { KnowledgeSource } from "../knowledge/KnowledgeSource";
import { MarkdownPreview } from "../../shared/ui/MarkdownPreview";

export function KnowledgePreview({
  markdown,
  sources,
  documentId,
  citationReferences = {},
}: {
  markdown: string;
  sources: KnowledgeChunk[];
  documentId: string;
  citationReferences?: Record<string, KnowledgeChunk>;
}) {
  const [selected, setSelected] = useState<KnowledgeChunk | null>(null);
  const references = Object.fromEntries([
    ...sources.map((chunk) => [
      `#knowledge-${chunk.id}`,
      () => setSelected(chunk),
    ]),
    ...Object.entries(citationReferences).map(([hash, chunk]) => [
      hash,
      () => setSelected(chunk),
    ]),
  ]);
  return (
    <>
      <MarkdownPreview markdown={markdown} references={references} />
      {selected && (
        <KnowledgeSource
          chunk={selected}
          documentId={documentId}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

export function KnowledgeEvidence({
  sources,
  documentId,
}: {
  sources: KnowledgeChunk[];
  documentId: string;
}) {
  const [selected, setSelected] = useState<KnowledgeChunk | null>(null);
  if (!sources.length) return null;
  return (
    <section className="agent-knowledge-evidence">
      <details>
        <summary>
          <BookOpen size={14} />
          {t("检索到的知识来源")} · {sources.length}
        </summary>
        <small>{t("点击查看原片段与位置；检索到不代表已核实或已引用。")}</small>
        {sources.map((chunk) => (
          <button key={chunk.id} onClick={() => setSelected(chunk)}>
            <strong>{chunk.title}</strong>
            <small>{chunk.heading || chunk.source}</small>
            <span>
              {t("第 {{start}}–{{end}} 行 · 版本 {{revision}}", {
                start: chunk.startLine,
                end: chunk.endLine,
                revision: chunk.revision,
              })}
            </span>
          </button>
        ))}
      </details>
      {selected && (
        <KnowledgeSource
          chunk={selected}
          documentId={documentId}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
