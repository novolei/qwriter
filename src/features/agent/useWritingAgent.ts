import { Channel, isTauri } from "@tauri-apps/api/core";
import type { Editor } from "@tiptap/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { errorText, language, t } from "../../shared/i18n/index";
import {
  commands,
  type AgentEvent,
  type AgentOutput,
  type AgentNote,
  type AgentDraft,
  type AgentSession,
  type KnowledgeChunk,
} from "../../shared/ipc/bindings";
import type { Doc, Profile } from "../../shared/types";
import { connectionIssue } from "../models/connection";
import { useHarness } from "./useHarness";
import { prepareCitations } from "../knowledge/citations";
import { useTranslation } from "react-i18next";

type Props = {
  docs: Doc[];
  current: Doc;
  config: Profile;
  editor: Editor | null;
  flush: () => Promise<void>;
  setDocs: Dispatch<SetStateAction<Doc[]>>;
  selectDoc: (doc: Doc) => void;
  notify: (text: string) => void;
};
type Status = "idle" | "running" | "complete" | "cancelled" | "limit" | "error";
export function useWritingAgent(props: Props) {
  useTranslation();
  const harness = useHarness(props.config, props.current.id);
  const latest = useRef(props);
  latest.current = props;
  const request = useRef("");
  const mounted = useRef(true);
  const stopping = useRef(false);
  const started = useRef(false);
  const previousDraft = useRef<AgentDraft | null>(null);
  const previousSources = useRef<KnowledgeChunk[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [prompt, setPrompt] = useState("");
  const [includeCurrent, setIncludeCurrent] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<AgentOutput | null>(null);
  const [error, setError] = useState("");
  const [base, setBase] = useState<Doc | null>(null);
  const [references, setReferences] = useState<AgentNote[]>([]);
  const [review, setReview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [followup, setFollowup] = useState(false);
  const [retainCitations, setRetainCitations] = useState(true);
  const activeLanguage = language();
  const citations = useMemo(
    () =>
      prepareCitations(
        result?.draft?.markdown ?? result?.answer ?? "",
        result?.knowledgeSources ?? [],
        retainCitations,
      ),
    [result, retainCitations, activeLanguage],
  );
  const busy = status === "running";
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopping.current = true;
      if (request.current)
        void commands.agentCancel(request.current).catch(() => {});
    };
  }, []);
  function attachedNotes(): AgentNote[] {
    const notes = props.docs
      .filter(
        (doc) =>
          (includeCurrent && doc.id === props.current.id) ||
          (doc.id !== props.current.id && selected.includes(doc.id)),
      )
      .map(({ id, title, markdown }) => ({ id, title, markdown }));
    if (followup && previousDraft.current)
      notes.push({
        id: "qwriter:previous-draft",
        title: previousDraft.current.title,
        markdown: prepareCitations(
          previousDraft.current.markdown,
          previousSources.current,
          retainCitations,
        ).markdown,
      });
    return notes;
  }
  async function run() {
    if (request.current || !prompt.trim() || harness.loading) return;
    if (
      harness.images.length &&
      harness.options.capabilities.vision !== "supported"
    ) {
      setError(t("请先确认模型支持图片理解，再发送图片"));
      return;
    }
    if (harness.options.capabilities.tools === "unsupported") {
      setError(t("此模型标记为不支持工具调用，请切换模型"));
      return;
    }
    if (!isTauri()) {
      setError(t("写作 Agent 需要桌面版连接模型。可先配置模型与参考文稿。"));
      return;
    }
    const issue = connectionIssue(props.config, true);
    if (issue) {
      setError(t(issue));
      return;
    }
    const id = crypto.randomUUID();
    request.current = id;
    stopping.current = false;
    started.current = false;
    const notes = attachedNotes();
    setStatus("running");
    setError("");
    setEvents([]);
    setResult(null);
    setBase({ ...props.current });
    setReferences(notes);
    setReview(false);
    const channel = new Channel<AgentEvent>();
    channel.onmessage = (event) => {
      if (event.type === "started" && (!mounted.current || stopping.current)) {
        void commands.agentCancel(id).catch(() => {});
        if (!mounted.current) return;
      }
      if (!mounted.current || request.current !== id) return;
      if (event.type === "started") {
        started.current = true;
      }
      setEvents((old) => [...old, event]);
    };
    try {
      const output = await commands.agentRun(
        id,
        props.config,
        {
          instruction: prompt,
          notes,
          language: language(),
          harness: harness.options,
        },
        channel,
      );
      if (mounted.current && request.current === id) {
        if (output.draft) {
          previousDraft.current = output.draft;
          previousSources.current = output.knowledgeSources ?? [];
        }
        setResult(output);
        setStatus(output.status);
        setFollowup(false);
      }
      try {
        await commands.agentSessionSave({
          id,
          instruction: prompt,
          model: props.config.model,
          documentId: props.current.id,
          createdAt: Date.now(),
          output,
        });
      } catch {
        if (mounted.current)
          setError(
            t("任务结果已保留在当前面板，但历史保存失败，请及时另存文稿。"),
          );
      }
    } catch (e) {
      if (mounted.current && request.current === id) {
        setStatus("error");
        setError(errorText(e));
      }
    } finally {
      if (request.current === id) request.current = "";
    }
  }
  async function stop() {
    stopping.current = true;
    if (started.current) {
      try {
        await commands.agentCancel(request.current);
      } catch (e) {
        setError(errorText(e));
      }
    }
  }
  const canApply =
    status === "complete" &&
    !!result?.draft &&
    base?.id === props.current.id &&
    base.markdown === props.current.markdown;
  async function apply() {
    const draft = result?.draft;
    if (!draft || !base || applying || status !== "complete") return;
    setApplying(true);
    try {
      const same = () =>
        latest.current.current.id === base.id &&
        latest.current.current.markdown === base.markdown;
      if (!same())
        throw new Error(t("原稿已变化，请重新生成建议，避免覆盖新内容"));
      await props.flush();
      if (!same()) throw new Error(t("保存期间原稿发生变化，请重新审阅"));
      latest.current.editor?.commands.setContent(citations.markdown, {
        contentType: "markdown",
        emitUpdate: false,
      });
      props.setDocs((old) =>
        old.map((doc) =>
          doc.id === base.id
            ? { ...doc, markdown: citations.markdown, updated: Date.now() }
            : doc,
        ),
      );
      setReview(false);
      setResult(null);
      setStatus("idle");
      props.notify("已采纳修改，原稿已保存，可从文稿历史恢复");
    } catch (e) {
      setError(errorText(e));
      setReview(false);
    } finally {
      setApplying(false);
    }
  }
  function save() {
    if (!result || status !== "complete") return;
    const content = citations.markdown;
    if (!content.trim()) return;
    const doc: Doc = {
      id: crypto.randomUUID(),
      title:
        result.draft?.title ??
        `${base?.title ?? t("未命名文稿")}${t(" · AI 草稿")}`,
      markdown: content,
      updated: Date.now(),
    };
    props.setDocs((old) => [doc, ...old]);
    props.selectDoc(doc);
    setResult(null);
    setStatus("idle");
    props.notify("AI 内容已另存为独立文稿");
  }
  return {
    harness,
    resume: (session: AgentSession) => {
      if (request.current) return;
      previousDraft.current = session.output.draft;
      previousSources.current = session.output.knowledgeSources ?? [];
      setResult(session.output);
      setStatus(session.output.status);
      setBase(null);
      setEvents([]);
      setReferences([]);
      setError("");
      setReview(false);
      setFollowup(!!session.output.draft);
      setPrompt(session.output.draft ? "" : session.instruction);
    },
    status,
    busy,
    prompt,
    setPrompt,
    includeCurrent,
    setIncludeCurrent,
    selected,
    setSelected,
    events,
    result,
    citations,
    retainCitations,
    setRetainCitations,
    error,
    base,
    references,
    review,
    setReview,
    applying,
    followup,
    setFollowup,
    canApply,
    run,
    stop,
    apply,
    save,
  };
}
export type WritingAgent = ReturnType<typeof useWritingAgent>;
