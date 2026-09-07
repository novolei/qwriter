import { Image } from "lucide-react";
import { t } from "../../shared/i18n/index";
import type { Workspace } from "../useWorkspace";
type Props = Pick<
  Workspace,
  | "comfy"
  | "setComfy"
  | "workflow"
  | "setWorkflow"
  | "job"
  | "jobResult"
  | "studioBusy"
  | "studio"
>;
export function StudioPanel({
  comfy,
  setComfy,
  workflow,
  setWorkflow,
  job,
  jobResult,
  studioBusy,
  studio,
}: Props) {
  return (
    <div className="studio">
      <div className="studio-icon">
        <Image size={28} />
      </div>
      <h2>{t("把想象，变成画面")}</h2>
      <p>{t("连接本地 ComfyUI，提交你的生图、生视频或视觉处理工作流。")}</p>
      <label>
        {t("ComfyUI 服务地址")}
        <input value={comfy} onChange={(e) => setComfy(e.target.value)} />
      </label>
      <button disabled={studioBusy} onClick={() => void studio("test")}>
        {t("检测连接")}
      </button>
      <label>
        {t("API 格式工作流 JSON")}
        <textarea
          value={workflow}
          onChange={(e) => setWorkflow(e.target.value)}
          placeholder={t("从 ComfyUI 导出 API 格式工作流，粘贴到这里")}
        />
      </label>
      <p className="hint">
        {t(
          "工作流中的模型、节点及素材需在 ComfyUI 服务端准备好。当前版本提交任务并查询执行结果。",
        )}
      </p>
      <button
        className="primary"
        disabled={!workflow || studioBusy}
        onClick={() => void studio("submit")}
      >
        {studioBusy ? t("请求中…") : t("提交工作流")}
      </button>
      {job && (
        <>
          <p>
            {t("任务：")}
            {job}
          </p>
          <button disabled={studioBusy} onClick={() => void studio("history")}>
            {t("查询任务结果")}
          </button>
        </>
      )}
      {jobResult && <pre>{jobResult}</pre>}
    </div>
  );
}
