import { useEffect, useState } from "react";
import type { ModelCapabilities } from "../../shared/ipc/bindings";
import { t } from "../../shared/i18n";
import { Select } from "../../shared/ui/Select";
import { normalizeCapabilities } from "./capabilities";

export function CapabilityBadges({ value }: { value?: ModelCapabilities }) {
  const caps = normalizeCapabilities(value);
  return (
    <div className="capability-badges">
      <span>{t("文字")}</span>
      <span data-ready={caps.vision === "supported"}>
        {t(
          caps.vision === "supported"
            ? "图片理解"
            : caps.vision === "unsupported"
              ? "不支持图片"
              : "图片能力未确认",
        )}
      </span>
      <span data-ready={caps.tools === "supported"}>
        {t(
          caps.tools === "supported"
            ? "工具调用"
            : caps.tools === "unsupported"
              ? "不支持工具"
              : "工具能力未确认",
        )}
      </span>
      {caps.reasoning !== "none" && <span>{t("可调思考")}</span>}
    </div>
  );
}
export function CapabilityEditor({
  value,
  onChange,
}: {
  value?: ModelCapabilities;
  onChange: (value: ModelCapabilities) => void;
}) {
  const caps = normalizeCapabilities(value);
  const [capacity, setCapacity] = useState(String(caps.contextWindow));
  useEffect(() => {
    setCapacity(String(caps.contextWindow));
  }, [caps.contextWindow]);
  return (
    <details className="capability-editor connection-advanced">
      <summary>{t("模型能力与上下文")}</summary>
      <p>
        {t(
          "能力标记由你确认，连接成功不代表支持图片或思考。请按模型文档配置。",
        )}
      </p>
      <div className="capability-fields">
        {(["vision", "tools"] as const).map((key) => (
          <label key={key}>
            {t(key === "vision" ? "图片理解" : "工具调用")}
            <Select
              aria-label={t(key === "vision" ? "图片理解能力" : "工具调用能力")}
              value={caps[key]}
              onValueChange={(v) =>
                onChange({ ...caps, [key]: v as ModelCapabilities[typeof key] })
              }
            >
              <option value="unknown">{t("待确认")}</option>
              <option value="supported">{t("支持")}</option>
              <option value="unsupported">{t("不支持")}</option>
            </Select>
          </label>
        ))}
        <label>
          {t("思考协议")}
          <Select
            aria-label={t("思考协议")}
            value={caps.reasoning}
            onValueChange={(v) =>
              onChange({
                ...caps,
                reasoning: v as ModelCapabilities["reasoning"],
              })
            }
          >
            <option value="none">{t("使用服务默认值")}</option>
            <option value="openai">OpenAI · reasoning_effort</option>
            <option value="deepseek">DeepSeek · thinking</option>
            <option value="anthropic">Anthropic · budget_tokens</option>
            <option value="anthropic_adaptive">Anthropic · adaptive</option>
          </Select>
        </label>
        <label>
          {t("上下文容量（tokens）")}
          <input
            type="number"
            min={16384}
            max={2000000}
            step={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            onBlur={() => {
              const n = Number(capacity);
              if (Number.isInteger(n) && n >= 16384 && n <= 2000000)
                onChange({ ...caps, contextWindow: n });
              else setCapacity(String(caps.contextWindow));
            }}
          />
        </label>
      </div>
    </details>
  );
}
