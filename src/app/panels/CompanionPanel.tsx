import {
  ArrowDownToLine,
  ArrowUp,
  ChevronRight,
  FileText,
  LoaderCircle,
  PanelRightClose,
  Sparkles,
  Square,
  WandSparkles,
} from "lucide-react";
import React from "react";
import { t } from "../../shared/i18n/index";
import type { WriteMode } from "../../shared/types";
import { Select } from "../../shared/ui/Select";
import type { Workspace } from "../useWorkspace";
type Props = Pick<
  Workspace,
  | "right"
  | "focus"
  | "tab"
  | "setTab"
  | "setRight"
  | "busy"
  | "answer"
  | "runAi"
  | "setPrompt"
  | "setWriteMode"
  | "resultSelection"
  | "contextEnabled"
  | "setContextEnabled"
  | "current"
  | "canCancel"
  | "cancelAi"
  | "resultStatus"
  | "resultMode"
  | "resultDoc"
  | "setReview"
  | "saveAnswer"
  | "setAnswer"
  | "writeMode"
  | "prompt"
> & {
  modelSelector: React.ReactNode;
  studioView: React.ReactNode;
  agentView: React.ReactNode;
  mode: "quick" | "task";
  onMode: (mode: "quick" | "task") => void;
  taskBusy: boolean;
};
export function CompanionPanel(props: Props) {
  const {
    right,
    focus,
    tab,
    setTab,
    setRight,
    busy,
    answer,
    runAi,
    setPrompt,
    setWriteMode,
    resultSelection,
    contextEnabled,
    setContextEnabled,
    current,
    canCancel,
    cancelAi,
    resultStatus,
    resultMode,
    resultDoc,
    setReview,
    saveAnswer,
    setAnswer,
    writeMode,
    prompt,
    studioView,
  } = props;
  return (
    <>
      {right && !focus && (
        <aside className="agent-panel">
          <div className="agent-header">
            <span>
              <Sparkles size={18} />
              {t("创作伙伴")}
            </span>
            <button title={t("收起 AI 面板")} onClick={() => setRight(false)}>
              <PanelRightClose size={16} />
            </button>
          </div>
          <div className="agent-tabs">
            <button
              className={tab === "agent" ? "chosen" : ""}
              onClick={() => setTab("agent")}
            >
              {t("AI 写作")}
            </button>
            <button
              className={tab === "studio" ? "chosen" : ""}
              onClick={() => setTab("studio")}
            >
              {t("创意工坊")}
              <span>BETA</span>
            </button>
          </div>
          {tab === "agent" ? (
            <>
              <div
                className="agent-mode-switch"
                role="group"
                aria-label={t("协作方式")}
              >
                <button
                  aria-pressed={props.mode === "quick"}
                  disabled={props.taskBusy}
                  onClick={() => props.onMode("quick")}
                >
                  {t("快速协作")}
                </button>
                <button
                  aria-pressed={props.mode === "task"}
                  disabled={busy}
                  onClick={() => props.onMode("task")}
                >
                  {t("写作 Agent")}
                </button>
              </div>
              {props.mode === "task" ? (
                props.agentView
              ) : (
                <>
                  <div className="agent-content">
                    <div className="companion-symbol">
                      <WandSparkles size={27} />
                      <span>✦</span>
                    </div>
                    <h2>{t("好想法，值得一起打磨")}</h2>
                    <p className="agent-description">
                      {t("从第一点灵感，到最后一句斟酌。")}
                      <br />
                      {t("我在这里，陪你把想法写成作品。")}
                    </p>
                    <div className="quick-actions">
                      {[
                        [
                          t("润色文字"),
                          t(
                            "保持原意和个人风格，润色当前文稿。仅输出完整的修改后文稿。",
                          ),
                        ],
                        [
                          t("继续写作"),
                          t("沿着当前文稿继续创作两段，仅输出新增段落。"),
                        ],
                        [
                          t("梳理思路"),
                          t("分析当前文稿的逻辑与结构，给出具体修改建议。"),
                        ],
                        [t("提炼摘要"), t("为当前文稿撰写简洁的摘要。")],
                      ].map(([title, instruction], i) => (
                        <button
                          disabled={busy}
                          key={title}
                          onClick={() => {
                            setPrompt(instruction);
                            const mode: WriteMode =
                              i === 0
                                ? "replace"
                                : i === 1
                                  ? "append"
                                  : "feedback";
                            setWriteMode(mode);
                            void runAi(instruction, mode);
                          }}
                        >
                          <span>{["✧", "↗", "☷", "≋"][i]}</span>
                          {title}
                          <ChevronRight size={14} />
                        </button>
                      ))}
                    </div>
                    <div className="context-card">
                      <div>
                        <FileText size={14} />
                        {t(
                          resultSelection && (busy || answer)
                            ? "当前选段"
                            : "当前文稿",
                        )}{" "}
                        {!(resultSelection && (busy || answer)) && (
                          <label>
                            <input
                              type="checkbox"
                              checked={contextEnabled}
                              disabled={busy}
                              onChange={(e) =>
                                setContextEnabled(e.target.checked)
                              }
                            />
                            {t("作为上下文")}
                          </label>
                        )}
                      </div>
                      <p>
                        {resultSelection && (busy || answer)
                          ? resultSelection.markdown.slice(0, 120)
                          : current.title}
                      </p>
                      <small>
                        {resultSelection && (busy || answer)
                          ? t("选段协作 · 仅发送选中文字")
                          : contextEnabled
                            ? t("发送时将把全文交给所选模型服务")
                            : t("仅发送你的指令，不附带文稿")}
                      </small>
                    </div>
                    {busy && (
                      <div className="loading">
                        <LoaderCircle size={16} className="spin" />
                        {answer ? t("正在写作…") : t("正在连接模型…")}
                        <button
                          disabled={!canCancel}
                          onClick={() => void cancelAi()}
                        >
                          <Square size={11} />
                          {t("停止生成")}
                        </button>
                      </div>
                    )}
                    {resultSelection && (busy || answer) && (
                      <div className="selection-context">
                        <Sparkles size={13} />
                        <span>{t("选段协作 · 仅发送选中文字")}</span>
                      </div>
                    )}
                    {answer && (
                      <div className="answer">
                        <div className="answer-label">
                          <Sparkles size={13} />
                          {resultStatus === "streaming"
                            ? t("灵感正在成形")
                            : resultStatus === "complete"
                              ? t("AI 建议 · 待你审阅")
                              : t("部分结果 · 尚未完成")}
                        </div>
                        <pre aria-live="off">{answer}</pre>
                        {!busy && (
                          <>
                            <div className="answer-actions">
                              {resultStatus === "complete" &&
                                resultMode !== "feedback" && (
                                  <button
                                    className="primary"
                                    disabled={current.id !== resultDoc}
                                    onClick={() => setReview(true)}
                                  >
                                    {resultMode === "append"
                                      ? t("审阅续写")
                                      : t("审阅修改")}
                                  </button>
                                )}
                              <button onClick={saveAnswer}>
                                <ArrowDownToLine size={14} />
                                {t("另存文稿")}
                              </button>
                              <button onClick={() => setAnswer("")}>
                                {t("丢弃")}
                              </button>
                            </div>
                            <small>
                              {resultMode === "feedback"
                                ? t("参考建议不会替换正文，可另存为独立文稿。")
                                : t(
                                    "采纳前可逐行比较修改；原稿将保留在历史中。",
                                  )}
                            </small>
                          </>
                        )}
                      </div>
                    )}
                    <div className="agent-note">
                      <span>✧</span>
                      <p>
                        {t("你的声音，始终是主角。")}
                        <br />
                        {t("AI 建议由你决定是否采纳。")}
                      </p>
                    </div>
                  </div>
                  <div className="composer-area">
                    <div className="writing-mode">
                      <span>{t("本次协作")}</span>
                      <Select
                        aria-label={t("AI 写作方式")}
                        value={writeMode}
                        disabled={busy}
                        onValueChange={(value) =>
                          setWriteMode(value as WriteMode)
                        }
                      >
                        <option value="feedback">{t("讨论与建议")}</option>
                        <option value="replace">{t("润色与改写")}</option>
                        <option value="append">{t("接着写下去")}</option>
                      </Select>
                    </div>
                    <div className="composer">
                      <textarea
                        aria-label={t("给 AI 的写作指令")}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t("聊聊你的想法，或试试「帮我润色」…")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            void runAi();
                          }
                        }}
                      />
                      <div>
                        <span>{t("Ctrl / ⌘ + Enter 发送")}</span>
                        <button
                          title={t("发送")}
                          disabled={busy || !prompt.trim()}
                          onClick={() => void runAi()}
                        >
                          <ArrowUp size={17} />
                        </button>
                      </div>
                    </div>
                    {props.modelSelector}
                  </div>
                </>
              )}
            </>
          ) : (
            studioView
          )}
        </aside>
      )}
    </>
  );
}
