import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { locale, t } from "../../shared/i18n/index";
import type { useConnection } from "./useConnection";
export function ConnectionStatus({
  connection,
}: {
  connection: ReturnType<typeof useConnection>;
}) {
  const { busy, error, verification, models } = connection;
  if (!busy && !error && !verification && !models) return null;
  const seconds = new Intl.NumberFormat(locale(), {
    maximumFractionDigits: 1,
  }).format((verification?.elapsedMs ?? models?.elapsedMs ?? 0) / 1000);
  const success = verification?.toolsSupported;
  return (
    <div
      className={`connection-result ${error ? "is-error" : success ? "is-success" : ""}`}
      role={error ? "alert" : "status"}
    >
      {busy ? (
        <LoaderCircle size={18} className="spin" />
      ) : error || (verification && !success) ? (
        <CircleAlert size={18} />
      ) : (
        <CheckCircle2 size={18} />
      )}
      <div>
        <strong>
          {busy
            ? t(
                busy === "discover"
                  ? "正在连接服务…"
                  : "正在验证模型与工具调用…",
              )
            : error
              ? t(error)
              : verification
                ? t(
                    success
                      ? "模型与 Agent 已就绪"
                      : "模型有响应，尚未确认 Agent 工具调用",
                  )
                : models?.data.length
                  ? t("已连接 · 找到 {{count}} 个模型", {
                      count: models.data.length,
                    })
                  : t("已连接，但没有发现模型。请加载本地模型，或手动添加。")}
        </strong>
        {!error && (
          <small>
            {busy
              ? t(
                  busy === "discover"
                    ? "通常几秒即可完成。"
                    : "测试读取内置素材并返回草稿，最长等待 90 秒。",
                )
              : verification
                ? t(
                    success
                      ? "已完成读取素材与生成草稿 · {{seconds}} 秒"
                      : "可尝试其他模型，或检查服务商是否支持工具调用。",
                    { seconds },
                  )
                : t(
                    "鉴权与模型列表检查通过 · {{seconds}} 秒；生成能力需单独验证。",
                    { seconds },
                  )}
          </small>
        )}
      </div>
    </div>
  );
}
