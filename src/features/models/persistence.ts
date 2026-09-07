import { readLocal } from "../../shared/storage";
import type { Profile } from "../../shared/types";
import { presets } from "./presets";
import type { ModelWorkspace, PoolModel, Provider } from "./types";

export const MODEL_STORAGE_KEY = "qwriter.model-workspace.v1";
export function publicProfiles(profiles: Profile[]) {
  return profiles.map(({ apiKey: _, ...profile }) => profile);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string";
}
export function normalizeWorkspace(value: unknown): ModelWorkspace | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.providers) ||
    !Array.isArray(value.models)
  )
    return null;
  const ids = new Set<string>();
  const providers: Provider[] = value.providers
    .filter(isRecord)
    .flatMap((p) => {
      if (
        !text(p.id) ||
        !text(p.name) ||
        !text(p.kind) ||
        !text(p.baseUrl) ||
        !text(p.protocol) ||
        !["openai", "anthropic"].includes(p.protocol) ||
        ids.has(p.id)
      )
        return [];
      ids.add(p.id);
      return [
        {
          id: p.id,
          name: p.name,
          kind: p.kind,
          baseUrl: p.baseUrl,
          protocol: p.protocol,
          ...(text(p.credentialOrigin)
            ? { credentialOrigin: p.credentialOrigin }
            : {}),
          catalog: Array.isArray(p.catalog)
            ? [...new Set(p.catalog.filter(text))].slice(0, 2000)
            : [],
          discoveredAt:
            typeof p.discoveredAt === "number" ? p.discoveredAt : undefined,
        },
      ];
    });
  const modelIds = new Set<string>();
  const refs = new Set<string>();
  const models: PoolModel[] = value.models.filter(isRecord).flatMap((m) => {
    if (
      !text(m.id) ||
      !text(m.providerId) ||
      !text(m.model) ||
      !m.model.trim() ||
      !ids.has(m.providerId) ||
      modelIds.has(m.id)
    )
      return [];
    const ref = JSON.stringify([m.providerId, m.model]);
    if (refs.has(ref)) return [];
    modelIds.add(m.id);
    refs.add(ref);
    const v = m.verification;
    return [
      {
        id: m.id,
        providerId: m.providerId,
        model: m.model,
        name: text(m.name) ? m.name : m.model,
        enabled: m.enabled !== false,
        ...(isRecord(v) &&
        typeof v.at === "number" &&
        text(v.baseUrl) &&
        text(v.protocol) &&
        typeof v.tools === "boolean"
          ? {
              verification: {
                at: v.at,
                baseUrl: v.baseUrl,
                protocol: v.protocol,
                tools: v.tools,
              },
            }
          : {}),
      },
    ];
  });
  const selected =
    models.find((m) => m.id === value.selected && m.enabled)?.id ??
    models.find((m) => m.enabled)?.id ??
    "";
  return { version: 1, providers, models, selected };
}

export function migrateProfiles(
  profiles: Profile[],
  selected: string,
): ModelWorkspace {
  // Preserve separate accounts even when old profiles share an origin. Never merge secrets.
  return (
    normalizeWorkspace({
      version: 1,
      providers: profiles.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.provider,
        baseUrl: p.baseUrl,
        protocol: p.protocol,
      })),
      models: profiles
        .filter((p) => p.model.trim())
        .map((p) => ({
          id: p.id,
          providerId: p.id,
          model: p.model,
          name: p.model,
          enabled: true,
        })),
      selected,
    }) ?? { version: 1, providers: [], models: [], selected: "" }
  );
}

export function loadWorkspace(): ModelWorkspace {
  const saved = normalizeWorkspace(readLocal(MODEL_STORAGE_KEY, null));
  if (saved) return saved;
  const legacy = readLocal<unknown>("qwriter.profiles", []);
  if (Array.isArray(legacy)) {
    const profiles = legacy.filter(
      (p): p is Profile =>
        isRecord(p) &&
        [p.id, p.name, p.provider, p.baseUrl, p.model, p.protocol].every(text),
    );
    if (profiles.length)
      return migrateProfiles(
        profiles,
        readLocal("qwriter.profile-id", "default"),
      );
  }
  const raw = readLocal<unknown>("qwriter.config", {});
  const old = isRecord(raw) ? raw : {};
  const provider = text(old.provider) ? old.provider : "Ollama";
  const preset = presets[provider] ?? presets.Ollama;
  return migrateProfiles(
    [
      {
        id: "default",
        name: provider,
        provider,
        ...preset,
        baseUrl: text(old.baseUrl) ? old.baseUrl : preset.baseUrl,
        protocol: text(old.protocol) ? old.protocol : preset.protocol,
        model: text(old.model) ? old.model : preset.model,
        apiKey: "",
      },
    ],
    "default",
  );
}

export function serializeWorkspace(workspace: ModelWorkspace) {
  // Explicit whitelist also strips accidental runtime credentials from nested records.
  return JSON.stringify(normalizeWorkspace(workspace));
}
