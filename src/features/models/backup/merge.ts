import type { ModelWorkspace, Provider } from "../types";
import { sanitizeWorkspace, type ModelBackup } from "./format";

export type DuplicatePolicy = "skip" | "copy";
function fingerprint(workspace: ModelWorkspace, provider: Provider) {
  const models = workspace.models
    .filter((m) => m.providerId === provider.id)
    .map((m) => JSON.stringify([m.model, m.name, m.enabled, m.capabilities]))
    .sort();
  return JSON.stringify([
    provider.kind,
    provider.baseUrl.replace(/\/$/, ""),
    provider.protocol,
    models,
  ]);
}
function sameName(existing: string, incoming: string) {
  return (
    existing === incoming ||
    (existing.startsWith(`${incoming} (`) &&
      /^\d+\)$/.test(existing.slice(incoming.length + 2)))
  );
}
export function planImport(
  current: ModelWorkspace,
  backup: ModelBackup,
  policy: DuplicatePolicy,
  uuid = () => crypto.randomUUID(),
) {
  const incoming = sanitizeWorkspace(backup.workspace);
  const providers = [...current.providers];
  const models = [...current.models];
  const known = current.providers.map((p) => ({
    name: p.name || p.kind,
    key: fingerprint(current, p),
  }));
  const names = new Set(providers.map((p) => p.name));
  const rows: {
    name: string;
    baseUrl: string;
    models: number;
    skipped: boolean;
  }[] = [];
  let importedSelection = "";
  for (const p of incoming.providers) {
    const key = fingerprint(incoming, p);
    const group = incoming.models.filter((m) => m.providerId === p.id);
    if (
      policy === "skip" &&
      known.some(
        (entry) => entry.key === key && sameName(entry.name, p.name || p.kind),
      )
    ) {
      rows.push({
        name: p.name || p.kind,
        baseUrl: p.baseUrl,
        models: group.length,
        skipped: true,
      });
      continue;
    }
    let name = p.name || p.kind;
    for (let index = 2; names.has(name); index++)
      name = `${p.name || p.kind} (${index})`;
    names.add(name);
    known.push({ name, key });
    const providerId = uuid();
    providers.push({ ...p, id: providerId, name });
    for (const m of group) {
      const id = uuid();
      models.push({ ...m, id, providerId });
      if (m.id === incoming.selected) importedSelection = id;
    }
    rows.push({
      name,
      baseUrl: p.baseUrl,
      models: group.length,
      skipped: false,
    });
  }
  if (providers.length > 100 || models.length > 2000)
    throw new Error("模型池最多支持 100 个供应商和 2000 个模型");
  const selected =
    models.find((m) => m.id === current.selected && m.enabled)?.id ??
    models.find((m) => m.id === importedSelection && m.enabled)?.id ??
    models.find((m) => m.enabled)?.id ??
    "";
  return {
    workspace: { version: 1 as const, providers, models, selected },
    rows,
    providersAdded: providers.length - current.providers.length,
    modelsAdded: models.length - current.models.length,
  };
}
