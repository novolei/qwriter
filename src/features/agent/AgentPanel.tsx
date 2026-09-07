import {
  ArrowUp,
  BookOpen,
  FilePlus2,
  Layers2,
  Plus,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Doc } from "../../shared/types";
import { t } from "../../shared/i18n/index";
import { MarkdownPreview } from "../../shared/ui/MarkdownPreview";
import { Review } from "../ai/Review";
import { AgentTimeline } from "./AgentTimeline";
import { ReferencePicker } from "./ReferencePicker";
import type { WritingAgent } from "./useWritingAgent";
import { HarnessControls } from "./HarnessControls";
import { SessionHistory } from "./SessionHistory";
import { MemoryLibrary } from "../knowledge/MemoryLibrary";
import type { MemoryProposal } from "../../shared/ipc/bindings";

type Props = {
  agent: WritingAgent;
  docs: Doc[];
  current: Doc;
  modelSelector: ReactNode;
  onSettings: () => void;
  otherBusy: boolean;
};
export function AgentPanel({
  agent: a,
  docs,
  current,
  modelSelector,
  onSettings,
  otherBusy,
}: Props) {
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState(false);
  const [memory, setMemory] = useState<
    false | { proposal?: MemoryProposal; readIds?: string[] }
  >(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const contentScroll = useRef<HTMLDivElement>(null);
  const followProgress = useRef(true);
  useEffect(() => {
    if (!a.events.length) return;
    if (a.events.length <= 1) followProgress.current = true;
    if (followProgress.current && contentScroll.current)
      contentScroll.current.scrollTop = contentScroll.current.scrollHeight;
  }, [a.events.length, a.result]);
  const attached = docs.filter(
    (doc) => a.selected.includes(doc.id) && doc.id !== current.id,
  );
  const content = a.result?.draft?.markdown ?? a.result?.answer;
  return (
    <>
      <div
        className="writing-agent-content"
        ref={contentScroll}
        onScroll={(event) => {
          const el = event.currentTarget;
          followProgress.current =
            el.scrollHeight - el.clientHeight - el.scrollTop < 65;
        }}
      >
        {a.status === "idle" && !a.result && (
          <div className="agent-intro">
            <span className="agent-intro-icon">
              <Layers2 size={24} />
            </span>
            <span className="eyebrow">{t("从灵感到成稿")}</span>
            <h2>{t("把想法，写成作品")}</h2>
            <p>{t("给一个目标，带上参考。\n让创作伙伴一步步陪你完成。")}</p>
            <div className="agent-starters">
              {[
                [
                  "从素材到初稿",
                  "阅读参考文稿，提炼核心观点，写出结构清晰的初稿。保留我的表达风格，不编造事实。",
                ],
                [
                  "审视并改进",
                  "阅读当前文稿，检查结构、连贯性和重复表达，提交一份完整的改进稿，并简要说明修改。",
                ],
              ].map(([label, prompt]) => (
                <button
                  key={label}
                  onClick={() => {
                    a.setPrompt(t(prompt));
                    input.current?.focus();
                  }}
                >
                  <Sparkles size={14} />
                  {t(label)}
                  <ArrowUp size={13} />
                </button>
              ))}
            </div>
          </div>
        )}
        {!!a.events.length && (
          <section className="agent-task">
            <div className="agent-task-heading">
              <strong>{t("本次任务")}</strong>
              <span role="status">
                {t(
                  a.busy
                    ? "进行中"
                    : a.status === "complete"
                      ? "已完成"
                      : a.status === "cancelled"
                        ? "已停止"
                        : a.status === "limit"
                          ? "达到步骤上限"
                          : "未完成",
                )}
              </span>
            </div>
            <AgentTimeline
              events={a.events}
              busy={a.busy}
              interrupted={a.status === "error" || a.status === "cancelled"}
            />
          </section>
        )}
        {a.error && (
          <div className="agent-error" role="alert">
            <p>{a.error}</p>
            <button onClick={onSettings}>{t("检查模型设置")}</button>
          </div>
        )}
        {a.status === "limit" && (
          <p className="agent-explanation">
            {t("已达到本次任务步骤上限，可缩小目标或调整任务设置。")}
          </p>
        )}
        {a.status === "cancelled" && (
          <p className="agent-explanation">
            {t("任务已停止，你的文稿没有改变。")}
          </p>
        )}
        {content && a.status === "complete" && (
          <section className="agent-draft">
            <span className="eyebrow">
              {t(a.result?.draft ? "草稿 · 待你审阅" : "回复 · 供你参考")}
            </span>
            <h3>{a.result?.draft?.title || t("写作建议")}</h3>
            {a.result?.draft?.summary && <p>{a.result.draft.summary}</p>}
            <button
              className="draft-preview-toggle"
              aria-expanded={preview}
              onClick={() => setPreview(!preview)}
            >
              <BookOpen size={14} />
              {t(preview ? "收起预览" : "阅读完整内容")}
            </button>
            {preview && <MarkdownPreview markdown={content} />}
            <div className="agent-draft-actions">
              <button className="primary" onClick={a.save}>
                <FilePlus2 size={14} />
                {t("另存文稿")}
              </button>
              {a.result?.draft && (
                <button
                  disabled={!a.canApply}
                  onClick={() => a.setReview(true)}
                >
                  {t("审阅修改")}
                </button>
              )}
            </div>
            {a.result?.draft && !a.canApply && (
              <small>{t("当前文稿已变化，建议可另存，不能直接覆盖。")}</small>
            )}{" "}
            {!!a.result?.readIds.length && (
              <div className="agent-read-sources">
                <span>{t("本次阅读")}</span>
                {a.result.readIds.map((id) => (
                  <small key={id}>
                    {a.references.find((note) => note.id === id)?.title ||
                      docs.find((doc) => doc.id === id)?.title ||
                      t("已移除的参考文稿")}
                  </small>
                ))}
              </div>
            )}{" "}
            {a.result?.draft && (
              <button
                className="agent-followup"
                onClick={() => {
                  a.setFollowup(true);
                  a.setPrompt("");
                  input.current?.focus();
                }}
              >
                {t("继续打磨这份草稿")}
              </button>
            )}
          </section>
        )}
        {!!a.result?.memories.length && (
          <section className="agent-memory-proposals">
            <h3>{t("值得记住 · 待你确认")}</h3>
            {a.result.memories.map((proposal, index) => (
              <button key={index} onClick={() => setMemory({ proposal })}>
                <strong>{proposal.title}</strong>
                <small>{proposal.content.slice(0, 120)}</small>
                <span>{t("审阅并记住")}</span>
              </button>
            ))}
          </section>
        )}
        {!!a.result?.memoryReadIds.length && (
          <button
            className="agent-followup"
            onClick={() => setMemory({ readIds: a.result!.memoryReadIds })}
          >
            <BookOpen size={14} /> {t("本次使用的记忆")} ·{" "}
            {a.result.memoryReadIds.length}
          </button>
        )}
      </div>
      <div className="agent-workbench">
        <button
          className="agent-history-link"
          onClick={() => setHistory(true)}
          disabled={a.busy}
        >
          {t("写作任务历史")}
        </button>
        <HarnessControls
          harness={a.harness}
          busy={a.busy}
          markdown={current.markdown}
          onMemory={() => setMemory({})}
        />
        <div className="agent-reference-heading">
          <span>
            <BookOpen size={13} />
            {t("写作参考")}
          </span>
          <button
            disabled={a.busy}
            onClick={() => setPicker(true)}
            title={t("添加参考文稿")}
          >
            <Plus size={14} />
            {t("添加")}
          </button>
        </div>
        {a.busy ? (
          <div className="reference-chips">
            {a.references.map((note) => (
              <span key={note.id}>{note.title}</span>
            ))}
          </div>
        ) : (
          <>
            <label className="agent-current-reference">
              <input
                type="checkbox"
                checked={a.includeCurrent}
                disabled={a.busy}
                onChange={(e) => a.setIncludeCurrent(e.target.checked)}
              />
              <span title={current.title}>
                {current.title || t("未命名文稿")}
              </span>
              <small>{t("当前")}</small>
            </label>
            {!!attached.length && (
              <div className="reference-chips">
                {attached.map((doc) => (
                  <span key={doc.id} title={doc.title}>
                    {doc.title}
                    <button
                      disabled={a.busy}
                      title={t("移除参考 {{title}}", { title: doc.title })}
                      onClick={() =>
                        a.setSelected((ids) =>
                          ids.filter((id) => id !== doc.id),
                        )
                      }
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {a.followup && (
              <label className="agent-current-reference">
                <input
                  type="checkbox"
                  checked
                  onChange={() => a.setFollowup(false)}
                />
                <span>{t("附上上一份草稿")}</span>
              </label>
            )}
          </>
        )}
        <small className="agent-disclosure">
          {t("仅发送选中的参考；本次最多 {{count}} 步。", {
            count: a.harness.preferences.maxRounds,
          })}
        </small>
        <div className="composer">
          <textarea
            ref={input}
            aria-label={t("给 Agent 的任务目标")}
            value={a.prompt}
            disabled={a.busy}
            maxLength={16000}
            onChange={(e) => a.setPrompt(e.target.value)}
            placeholder={t(
              a.followup
                ? "告诉我，接下来想怎样打磨…"
                : "例如：结合参考文稿，写一篇有温度的序言…",
            )}
            onPaste={(e) => {
              const images = Array.from(e.clipboardData.files).filter((f) =>
                f.type.startsWith("image/"),
              );
              if (images.length) {
                e.preventDefault();
                void a.harness.pasteImages(images);
              }
            }}
            onKeyDown={(e) => {
              if (
                !e.nativeEvent.isComposing &&
                e.key === "Enter" &&
                (e.ctrlKey || e.metaKey)
              ) {
                e.preventDefault();
                if (!otherBusy) void a.run();
              }
            }}
          />
          <div>
            <span>{t("Ctrl / ⌘ + Enter 开始")}</span>
            {a.busy ? (
              <button title={t("停止任务")} onClick={() => void a.stop()}>
                <Square size={14} />
              </button>
            ) : (
              <button
                title={t("开始任务")}
                disabled={
                  !a.prompt.trim() ||
                  otherBusy ||
                  a.harness.loading ||
                  (a.harness.images.length > 0 &&
                    a.harness.options.capabilities.vision !== "supported")
                }
                onClick={() => void a.run()}
              >
                <ArrowUp size={17} />
              </button>
            )}
          </div>
        </div>
        {modelSelector}
        <small className="agent-model-hint">
          {t("需要支持工具调用的模型")}
        </small>
      </div>
      {picker && (
        <ReferencePicker
          docs={docs}
          currentId={current.id}
          selected={a.selected}
          onChange={a.setSelected}
          onClose={() => setPicker(false)}
        />
      )}
      {memory && (
        <MemoryLibrary
          current={current}
          proposal={memory.proposal}
          readIds={memory.readIds}
          onClose={() => setMemory(false)}
        />
      )}
      {history && (
        <SessionHistory
          onClose={() => setHistory(false)}
          onResume={(session) => {
            a.resume(session);
            setHistory(false);
          }}
        />
      )}
      {a.review && a.result?.draft && a.base && (
        <Review
          before={a.base.markdown}
          after={a.result.draft.markdown}
          busy={a.applying}
          onApply={() => void a.apply()}
          onClose={() => a.setReview(false)}
        />
      )}
    </>
  );
}
