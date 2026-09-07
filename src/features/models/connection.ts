import type { Profile } from "../../shared/types";

export function credentialOrigin(baseUrl: string) {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return "";
  }
}
export function sameConnection(a: Profile, b: Profile) {
  return (
    a.id === b.id &&
    a.provider === b.provider &&
    a.baseUrl === b.baseUrl &&
    a.apiKey === b.apiKey &&
    a.protocol === b.protocol
  );
}
export function connectionIssue(config: Profile, requireModel = false): string {
  try {
    const url = new URL(config.baseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return "请填写不含凭据、查询参数的 HTTP(S) 服务地址";
  } catch {
    return "请先填写有效的 API 服务地址";
  }
  if (
    !["Ollama", "LM Studio", "自定义兼容服务"].includes(config.provider) &&
    !config.apiKey.trim()
  )
    return "请先填写此服务的 API Key";
  if (requireModel && !config.model.trim()) return "请先选择或填写模型 ID";
  return "";
}
