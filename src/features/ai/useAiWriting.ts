import { Channel, isTauri } from "@tauri-apps/api/core";
import type { Editor } from "@tiptap/react";
import type React from "react";
import { useRef, useState } from "react";
import { errorText, t } from "../../shared/i18n/index";
import { commands, type StreamEvent } from "../../shared/ipc/bindings";
import type { Doc, Profile, WriteMode } from "../../shared/types";
import {
  replacePassage,
  selectedPassage,
  type SelectedPassage,
} from "../editor/editing";
import { requiresSource } from "../editor/editor-extensions";
import { connectionIssue } from "../models/connection";

type Props = {
  current: Doc;
  currentRef: React.RefObject<Doc>;
  config: Profile;
  setDocs: React.Dispatch<React.SetStateAction<Doc[]>>;
  selectDoc: (doc: Doc) => void;
  setNotice: (message: string) => void;
  setRight: (open: boolean) => void;
  setTab: (tab: "agent" | "studio") => void;
  library: { flush: () => Promise<void> };
  editor: Editor | null;
};
export function useAiWriting({
  current,
  currentRef,
  config,
  setDocs,
  selectDoc,
  setNotice,
  setRight,
  setTab,
  library,
  editor,
}: Props) {
  const [review, setReview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [writeMode, setWriteMode] = useState<WriteMode>("feedback");
  const [resultMode, setResultMode] = useState<WriteMode>("feedback");
  const [resultStatus, setResultStatus] = useState<
    "complete" | "cancelled" | "error" | "streaming"
  >("complete");
  const [canCancel, setCanCancel] = useState(false);
  const [resultSelection, setResultSelection] =
    useState<SelectedPassage | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [resultDoc, setResultDoc] = useState("");
  const [resultBase, setResultBase] = useState("");
  const requestRef = useRef("");
  const [contextEnabled, setContextEnabled] = useState(true);
  async function runAi(
    instruction = prompt,
    mode: WriteMode = writeMode,
    selection: SelectedPassage | null = null,
  ) {
    if (!instruction.trim() || busy || requestRef.current) return;
    if (!isTauri()) {
      setNotice("请在桌面版中调用模型：npm run desktop");
      return;
    }
    const issue = connectionIssue(config, true);
    if (issue) {
      setNotice(t(issue));
      return;
    }
    const id = crypto.randomUUID();
    requestRef.current = id;
    setBusy(true);
    setCanCancel(false);
    setAnswer("");
    setResultDoc(current.id);
    setResultBase(current.markdown);
    setResultSelection(selection);
    setResultMode(mode);
    setResultStatus("streaming");
    const channel = new Channel<StreamEvent>();
    channel.onmessage = (event) => {
      if (requestRef.current !== id) return;
      if (event.type === "started") setCanCancel(true);
      else if (event.text) setAnswer((previous) => previous + event.text);
    };
    const directive =
      mode === "replace"
        ? t("请仅返回完整修改后的文稿。")
        : mode === "append"
          ? t("请仅返回续写部分，不要重复原文。")
          : t("请提供参考建议，不要替换原文。");
    try {
      const status = await commands.aiStream(
        id,
        config,
        instruction + "\n" + directive,
        selection?.markdown ?? (contextEnabled ? current.markdown : ""),
        channel,
      );
      if (requestRef.current === id) {
        setResultStatus(status === "cancelled" ? "cancelled" : "complete");
        if (status === "cancelled")
          setNotice("已停止接收并断开模型请求；部分内容可另存为草稿");
      }
    } catch (e) {
      if (requestRef.current === id) {
        setResultStatus("error");
        setNotice(errorText(e));
      }
    } finally {
      if (requestRef.current === id) {
        requestRef.current = "";
        setBusy(false);
        setCanCancel(false);
      }
    }
  }
  function polishSelection() {
    if (!editor) return;
    const selection = selectedPassage(editor);
    if (!selection) return;
    setRight(true);
    setTab("agent");
    const instruction = t(
      "仅润色给出的选段，保持原意、语言和 Markdown 格式。不要添加开场说明或扩写未提供的上下文。",
    );
    void runAi(instruction, "replace", selection);
  }
  async function cancelAi() {
    setCanCancel(false);
    try {
      await commands.aiCancel(requestRef.current);
    } catch (e) {
      setCanCancel(true);
      setNotice(errorText(e));
    }
  }
  const proposed =
    resultMode === "append" ? resultBase + "\n\n" + answer : answer;
  async function applyResult() {
    if (busy || resultStatus !== "complete") return;
    if (
      currentRef.current.id !== resultDoc ||
      currentRef.current.markdown !== resultBase
    ) {
      setNotice("原稿已变化，请重新生成建议，避免覆盖新内容");
      setReview(false);
      return;
    }
    setApplying(true);
    try {
      await library.flush();
      if (
        currentRef.current.id !== resultDoc ||
        currentRef.current.markdown !== resultBase
      )
        throw new Error(t("保存期间原稿发生变化，请重新审阅"));
      if (resultSelection) {
        if (requiresSource(answer))
          throw new Error(t("选段建议含扩展语法，请另存文稿以保留完整内容"));
        if (!editor || !replacePassage(editor, resultSelection, answer))
          throw new Error(t("选段应用失败，请重新选择文字"));
      } else {
        editor?.commands.setContent(proposed, {
          contentType: "markdown",
          emitUpdate: false,
        });
        setDocs((old) =>
          old.map((d) =>
            d.id === resultDoc
              ? {
                  ...d,
                  markdown: proposed,
                  updated: Date.now(),
                }
              : d,
          ),
        );
      }
      setReview(false);
      setAnswer("");
      setNotice("已采纳修改，原稿已保存，可从文稿历史恢复");
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setApplying(false);
    }
  }
  function saveAnswer() {
    const d = {
      id: crypto.randomUUID(),
      title:
        current.title +
        (resultStatus === "complete" ? t(" · AI 草稿") : t(" · AI 部分结果")),
      markdown: answer,
      updated: Date.now(),
    };
    setDocs((old) => [d, ...old]);
    selectDoc(d);
    setAnswer("");
    setNotice("AI 内容已另存为独立文稿");
  }
  return {
    review,
    setReview,
    applying,
    setApplying,
    writeMode,
    setWriteMode,
    resultMode,
    setResultMode,
    resultStatus,
    setResultStatus,
    canCancel,
    setCanCancel,
    resultSelection,
    setResultSelection,
    prompt,
    setPrompt,
    busy,
    setBusy,
    answer,
    setAnswer,
    resultDoc,
    setResultDoc,
    resultBase,
    setResultBase,
    contextEnabled,
    setContextEnabled,
    runAi,
    polishSelection,
    cancelAi,
    applyResult,
    saveAnswer,
    proposed,
  };
}
