import type {
  ModelCapabilities,
  CapabilitySupport,
  ReasoningAdapter,
} from "../../shared/ipc/bindings";
import type { PoolModel, Provider } from "./types";

export const defaultCapabilities: ModelCapabilities = {
  vision: "unknown",
  tools: "unknown",
  reasoning: "none",
  contextWindow: 32768,
};
export function normalizeCapabilities(value: unknown): ModelCapabilities {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const support = (v: unknown): CapabilitySupport =>
    v === "supported" || v === "unsupported" ? v : "unknown";
  const reasoning: ReasoningAdapter = [
    "openai",
    "deepseek",
    "anthropic",
    "anthropic_adaptive",
  ].includes(String(raw.reasoning))
    ? (raw.reasoning as ReasoningAdapter)
    : "none";
  return {
    vision: support(raw.vision),
    tools: support(raw.tools),
    reasoning,
    contextWindow:
      typeof raw.contextWindow === "number" &&
      Number.isInteger(raw.contextWindow) &&
      raw.contextWindow >= 16384 &&
      raw.contextWindow <= 2_000_000
        ? raw.contextWindow
        : 32768,
  };
}
export function modelCapabilities(
  model: PoolModel,
  provider?: Provider,
): ModelCapabilities {
  const caps = normalizeCapabilities(model.capabilities);
  const verified =
    model.verification &&
    model.verification.baseUrl === provider?.baseUrl &&
    model.verification.protocol === provider?.protocol;
  return {
    ...caps,
    tools:
      caps.tools === "unknown" && verified && model.verification?.tools
        ? "supported"
        : caps.tools,
  };
}
