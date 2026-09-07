import { BookOpen, Brain, ImagePlus, Settings2, X } from "lucide-react";
import { useState } from "react";
import { t } from "../../shared/i18n";
import { Select } from "../../shared/ui/Select";
import { AssetView } from "../../shared/media/AssetView";
import type { ThinkingMode, ThinkingEffort } from "../../shared/ipc/bindings";
import type { HarnessController } from "./useHarness";

export function HarnessControls({
  harness: h,
  busy,
  markdown,
  onMemory,
}: {
  harness: HarnessController;
  busy: boolean;
  markdown: string;
  onMemory: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const locked = busy || h.loading;
  const caps = h.options.capabilities;
  return (
    <section className="harness-controls" aria-label={t("Agent 能力与上下文")}>
      <div className="harness-actions">
        <button
          disabled={locked || h.images.length >= 4}
          onClick={() => void h.addImage()}
          title={t("添加图片参考")}
        >
          <ImagePlus size={14} />
          {t("图片")}
        </button>
        <button onClick={onMemory} disabled={busy}>
          <BookOpen size={14} />
          {t("记忆与知识")}
        </button>
        <button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          <Settings2 size={14} />
          {t("任务设置")}
        </button>
      </div>
      {h.error && (
        <p role="alert" className="agent-error">
          {h.error}
        </p>
      )}
      {!!h.images.length && (
        <>
          <div className="agent-image-strip">
            {h.images.map((image) => (
              <div key={image.id}>
                <AssetView id={image.id} name={image.name} />
                <button
                  disabled={locked}
                  aria-label={t("移除图片 {{name}}", { name: image.name })}
                  onClick={() =>
                    h.setImages((old) => old.filter((i) => i.id !== image.id))
                  }
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <small>{t("发送时会上传这些图片至当前模型服务，最多 4 张。")}</small>
          {caps.vision !== "supported" && (
            <p className="agent-error">
              {t("请先确认模型支持图片理解，再发送图片")}
            </p>
          )}
        </>
      )}
      <label className="harness-memory-toggle">
        <input
          type="checkbox"
          checked={h.preferences.memoryEnabled}
          disabled={locked}
          onChange={(e) =>
            h.setPreferences((p) => ({ ...p, memoryEnabled: e.target.checked }))
          }
        />
        {t("允许本次任务检索记忆与知识")}
      </label>
      {expanded && (
        <div className="harness-options">
          <p>
            {t(
              "我是 Qwriter 的写作伙伴：可以阅读你选择的参考、规划任务并提交草稿。修改文稿与保存新记忆都由你确认。",
            )}
          </p>
          <label>
            <Brain size={13} />
            {t("思考模式")}
            <Select
              value={h.options.thinking}
              disabled={locked || caps.reasoning === "none"}
              aria-label={t("思考模式")}
              onValueChange={(v) =>
                h.setPreferences((p) => ({ ...p, thinking: v as ThinkingMode }))
              }
            >
              <option value="auto">{t("服务默认")}</option>
              <option value="on">{t("开启思考")}</option>
              <option value="off">{t("关闭思考")}</option>
            </Select>
          </label>
          <label>
            {t("思考强度")}
            <Select
              value={h.options.effort}
              disabled={locked || h.options.thinking !== "on"}
              aria-label={t("思考强度")}
              onValueChange={(v) =>
                h.setPreferences((p) => ({ ...p, effort: v as ThinkingEffort }))
              }
            >
              <option value="low">{t("轻量")}</option>
              <option value="medium">{t("均衡")}</option>
              <option value="high">{t("深入")}</option>
              {caps.reasoning === "deepseek" && (
                <option value="max">{t("最高强度")}</option>
              )}
            </Select>
          </label>
          <small>
            {t(
              "仅对已配置思考协议的模型生效；强度映射由供应商决定，不展示内部思考过程。",
            )}
          </small>
          {caps.reasoning === "deepseek" && (
            <small>
              {t(
                "DeepSeek：均衡与深入均对应 high；最高强度对应 max。输出长度仍受上下文预算约束。",
              )}
            </small>
          )}
          <label>
            {t("任务步骤上限")}
            <Select
              value={h.preferences.maxRounds}
              disabled={locked}
              aria-label={t("任务步骤上限")}
              onValueChange={(v) =>
                h.setPreferences((p) => ({ ...p, maxRounds: Number(v) }))
              }
            >
              {[4, 6, 10, 16].map((n) => (
                <option key={n} value={n}>
                  {t("最多 {{count}} 步", { count: n })}
                </option>
              ))}
            </Select>
          </label>
          <button
            disabled={locked || h.images.length >= 4}
            onClick={() => void h.addDocumentImages(markdown)}
          >
            {t("添加文稿中的本地图片")}
          </button>
          <small>{t("图片与记忆不会因为文稿中存在链接而自动发送。")}</small>
        </div>
      )}
    </section>
  );
}
