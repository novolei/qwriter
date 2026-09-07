import type { ModelWorkspace } from "../types";
import { normalizeCapabilities } from "../capabilities";

export const BACKUP_LIMIT = 2 * 1024 * 1024;
export type ModelBackup = {
  format: "qwriter.models";
  version: 1;
  workspace: ModelWorkspace;
};
const invalid = () => new Error("模型备份格式无效或版本不受支持");
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, empty = false): string {
  if (
    typeof value !== "string" ||
    value.length > limit ||
    (!empty && !value.trim())
  )
    throw invalid();
  return value;
}
function address(value: unknown): string {
  const raw = text(value, 2048, true);
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid();
  }
  if (!["http:", "https:"].includes(url.protocol)) throw invalid();
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "备份地址不能包含账号、密码、查询参数或片段，请使用纯服务地址",
    );
  }
  return raw;
}
export function sanitizeWorkspace(value: unknown): ModelWorkspace {
  const data = record(value);
  if (
    !Array.isArray(data.providers) ||
    !Array.isArray(data.models) ||
    data.providers.length > 100 ||
    data.models.length > 2000
  )
    throw invalid();
  const ids = new Set<string>();
  const providers = data.providers.map((item) => {
    const p = record(item);
    const id = text(p.id, 128);
    if (ids.has(id) || !["openai", "anthropic"].includes(String(p.protocol)))
      throw invalid();
    ids.add(id);
    // Credentials, vault bindings, discovery caches and verification are device-local.
    return {
      id,
      name: text(p.name, 256, true),
      kind: text(p.kind, 128),
      baseUrl: address(p.baseUrl),
      protocol: text(p.protocol, 32),
    };
  });
  const modelIds = new Set<string>();
  const refs = new Set<string>();
  const models = data.models.map((item) => {
    const m = record(item);
    const id = text(m.id, 128);
    const providerId = text(m.providerId, 128);
    const model = text(m.model, 512);
    const ref = JSON.stringify([providerId, model]);
    if (
      !ids.has(providerId) ||
      modelIds.has(id) ||
      refs.has(ref) ||
      typeof m.enabled !== "boolean"
    )
      throw invalid();
    modelIds.add(id);
    refs.add(ref);
    return {
      id,
      providerId,
      model,
      name: text(m.name, 512, true),
      enabled: m.enabled,
      ...(m.capabilities
        ? { capabilities: normalizeCapabilities(m.capabilities) }
        : {}),
    };
  });
  const selected = text(data.selected, 128, true);
  if (selected && !models.some((m) => m.id === selected && m.enabled))
    throw invalid();
  return { version: 1, providers, models, selected };
}
export function parseBackup(source: string): ModelBackup {
  if (new TextEncoder().encode(source).length > BACKUP_LIMIT)
    throw new Error("模型备份不能超过 2 MB");
  let raw: unknown;
  try {
    raw = JSON.parse(source.replace(/^\uFEFF/, ""));
  } catch {
    throw invalid();
  }
  const data = record(raw);
  if (data.format !== "qwriter.models" || data.version !== 1) throw invalid();
  return {
    format: "qwriter.models",
    version: 1,
    workspace: sanitizeWorkspace(data.workspace),
  };
}
export function exportBackup(workspace: ModelWorkspace): string {
  const json = JSON.stringify(
    {
      format: "qwriter.models",
      version: 1,
      workspace: sanitizeWorkspace(workspace),
    },
    null,
    2,
  );
  parseBackup(json);
  return json;
}
