import { useEffect, useState } from "react";
import { commands, type AgentSession } from "../../shared/ipc/bindings";
import { errorText, locale, t } from "../../shared/i18n";
import { isTauri } from "@tauri-apps/api/core";
import { Modal } from "../../shared/ui/Modal";

export function SessionHistory({
  onClose,
  onResume,
}: {
  onClose: () => void;
  onResume: (session: AgentSession) => void;
}) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (isTauri() ? commands.agentSessions() : Promise.resolve([]))
      .then((data) => {
        if (active) setSessions(data);
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
  }, []);
  return (
    <Modal
      title={t("写作任务历史")}
      eyebrow={t("接着上一次的灵感，继续写")}
      onClose={onClose}
      settings
    >
      <p>
        {t(
          "在本机保留最近 100 次任务结果。继续任务会使用当前模型，不会自动覆盖文稿。",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">{t("正在打开…")}</p>
      ) : !sessions.length ? (
        <p>{t("还没有任务记录。完成一次桌面 Agent 任务后会出现在这里。")}</p>
      ) : (
        <div className="memory-list">
          {sessions.map((s) => (
            <article key={s.id}>
              <button className="memory-open" onClick={() => onResume(s)}>
                <strong>
                  {s.output.draft?.title || s.instruction.slice(0, 60)}
                </strong>
                <p>{s.instruction.slice(0, 180)}</p>
                <small>
                  {s.model} · {new Date(s.createdAt).toLocaleString(locale())} ·{" "}
                  {t(s.output.status === "complete" ? "已完成" : "未完成")}
                </small>
              </button>
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}
