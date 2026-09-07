import {
  BookOpen,
  Check,
  CircleAlert,
  FilePenLine,
  LoaderCircle,
  Search,
} from "lucide-react";
import type { AgentEvent } from "../../shared/ipc/bindings";
import { t } from "../../shared/i18n/index";

export function AgentTimeline({
  events,
  busy,
  interrupted,
}: {
  events: AgentEvent[];
  busy: boolean;
  interrupted: boolean;
}) {
  const visible = events.filter((event) => event.type !== "started");
  return (
    <ol className="agent-timeline" aria-label={t("任务进展")}>
      {visible.map((event, index) => {
        const last = busy && index === visible.length - 1;
        const Icon =
          event.type === "thinking"
            ? last
              ? LoaderCircle
              : interrupted && index === visible.length - 1
                ? CircleAlert
                : Check
            : event.type === "tool"
              ? !event.success
                ? CircleAlert
                : event.name === "read_document"
                  ? BookOpen
                  : event.name === "search_documents"
                    ? Search
                    : FilePenLine
              : Check;
        return (
          <li key={index} className={last ? "is-current" : ""}>
            <Icon
              size={14}
              className={last && event.type === "thinking" ? "spin" : ""}
            />
            <span>
              {event.type === "thinking" ? (
                t(
                  last
                    ? "正在构思 · 第 {{round}} 步"
                    : "构思与整理 · 第 {{round}} 步",
                  { round: event.round },
                )
              ) : event.type === "tool" ? (
                <>
                  {t(
                    !event.success
                      ? "工具未完成"
                      : event.name === "read_document"
                        ? "已阅读"
                        : event.name === "search_documents"
                          ? "检索参考文稿"
                          : event.name === "propose_draft"
                            ? "草稿已整理"
                            : "工具未完成",
                  )}
                  <small title={event.detail}>
                    {event.success
                      ? event.detail
                      : t("调用未完成，模型可调整后继续。")}
                  </small>
                </>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
