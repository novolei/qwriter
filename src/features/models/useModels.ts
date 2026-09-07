import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "../../shared/types";
import { credentialOrigin } from "./connection";
import {
  loadWorkspace,
  MODEL_STORAGE_KEY,
  serializeWorkspace,
} from "./persistence";
import { presets } from "./presets";
import type { ModelWorkspace, PoolModel, Provider } from "./types";
import { useProviderCredentials } from "./useProviderCredentials";
import type { ModelBackup } from "./backup/format";
import { planImport, type DuplicatePolicy } from "./backup/merge";
export { presets } from "./presets";
export { publicProfiles } from "./persistence";

export function useModels() {
  const [workspace, setWorkspace] = useState(loadWorkspace);
  const latest = useRef(workspace);
  latest.current = workspace;
  const [error, setError] = useState("");
  const saved = useCallback((id: string, origin?: string) => {
    setWorkspace((old) => ({
      ...old,
      providers: old.providers.map((p) =>
        p.id === id ? { ...p, credentialOrigin: origin } : p,
      ),
    }));
  }, []);
  const credentials = useProviderCredentials(workspace.providers, saved);
  useEffect(() => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, serializeWorkspace(workspace));
      setError("");
    } catch {
      setError("模型配置保存失败");
    }
  }, [workspace]);
  function resolve(model: PoolModel): Profile {
    const provider = workspace.providers.find((p) => p.id === model.providerId);
    return {
      id: model.id,
      name: model.name || model.model,
      provider: provider?.kind ?? "自定义兼容服务",
      baseUrl: provider?.baseUrl ?? "",
      protocol: provider?.protocol ?? "openai",
      apiKey: provider ? credentials.value(provider) : "",
      model: model.model,
    };
  }
  const profiles = workspace.models.filter((m) => m.enabled).map(resolve);
  const config = profiles.find((p) => p.id === workspace.selected) ??
    profiles[0] ?? {
      id: "",
      name: "",
      provider: "自定义兼容服务",
      baseUrl: "",
      protocol: "openai",
      apiKey: "",
      model: "",
    };
  function select(id: string) {
    setWorkspace((old) =>
      old.models.some((m) => m.id === id && m.enabled)
        ? { ...old, selected: id }
        : old,
    );
  }
  function importBackup(backup: ModelBackup, policy: DuplicatePolicy) {
    const plan = planImport(latest.current, backup, policy);
    if (!plan.providersAdded) return plan;
    try {
      localStorage.setItem(
        MODEL_STORAGE_KEY,
        serializeWorkspace(plan.workspace),
      );
    } catch {
      throw new Error("模型配置保存失败，未导入任何配置");
    }
    latest.current = plan.workspace;
    setWorkspace(plan.workspace);
    return plan;
  }
  function addProvider(kind = "DeepSeek") {
    const id = crypto.randomUUID();
    const preset = presets[kind] ?? presets["自定义兼容服务"];
    setWorkspace((old) => ({
      ...old,
      providers: [
        ...old.providers,
        {
          id,
          kind,
          name: kind,
          baseUrl: preset.baseUrl,
          protocol: preset.protocol,
          catalog: [],
        },
      ],
    }));
    return id;
  }
  function updateProvider(next: Provider) {
    const current = latest.current.providers.find((p) => p.id === next.id);
    if (
      current &&
      (current.kind !== next.kind ||
        credentialOrigin(current.baseUrl) !== credentialOrigin(next.baseUrl))
    )
      credentials.setKey(next, "");
    setWorkspace((old) => {
      const before = old.providers.find((p) => p.id === next.id);
      const changed =
        before?.baseUrl !== next.baseUrl ||
        before?.protocol !== next.protocol ||
        before?.kind !== next.kind;
      return {
        ...old,
        providers: old.providers.map((p) =>
          p.id === next.id
            ? {
                ...next,
                ...(changed ? { catalog: [], discoveredAt: undefined } : {}),
              }
            : p,
        ),
        models: changed
          ? old.models.map((m) =>
              m.providerId === next.id ? { ...m, verification: undefined } : m,
            )
          : old.models,
      };
    });
  }
  async function removeProvider(id: string) {
    const provider = latest.current.providers.find((p) => p.id === id);
    if (!provider) return false;
    if (
      provider.credentialOrigin &&
      !(await credentials.operation(provider, "forget"))
    )
      return false;
    setWorkspace((old) =>
      repair({
        ...old,
        providers: old.providers.filter((p) => p.id !== id),
        models: old.models.filter((m) => m.providerId !== id),
      }),
    );
    credentials.setKey(provider, "");
    return true;
  }
  function addModels(providerId: string, ids: string[], name?: string) {
    setWorkspace((old) => {
      if (!old.providers.some((p) => p.id === providerId)) return old;
      const models = [...old.models];
      for (const raw of ids) {
        const model = raw.trim();
        if (
          !model ||
          model.length > 512 ||
          models.some((m) => m.providerId === providerId && m.model === model)
        )
          continue;
        models.push({
          id: crypto.randomUUID(),
          providerId,
          model,
          name: name?.trim() || model,
          enabled: true,
        });
      }
      // Registering a model preserves an existing primary. Only an empty pool picks its first entry.
      return repair({ ...old, models });
    });
  }
  function updateModel(next: PoolModel) {
    setWorkspace((old) =>
      repair({
        ...old,
        models: old.models.map((m) => (m.id === next.id ? next : m)),
      }),
    );
  }
  function removeModel(id: string) {
    setWorkspace((old) =>
      repair({ ...old, models: old.models.filter((m) => m.id !== id) }),
    );
  }
  function recordDiscovery(provider: Provider, ids: string[]) {
    setWorkspace((old) => ({
      ...old,
      providers: old.providers.map((p) =>
        p.id === provider.id &&
        p.baseUrl === provider.baseUrl &&
        p.protocol === provider.protocol
          ? { ...p, catalog: [...new Set(ids)], discoveredAt: Date.now() }
          : p,
      ),
    }));
  }
  function recordVerification(
    provider: Provider,
    modelId: string,
    tools: boolean,
  ) {
    setWorkspace((old) => ({
      ...old,
      models: old.models.map((m) =>
        m.providerId === provider.id &&
        m.model === modelId &&
        old.providers.some(
          (p) =>
            p.id === provider.id &&
            p.baseUrl === provider.baseUrl &&
            p.protocol === provider.protocol,
        )
          ? {
              ...m,
              verification: {
                at: Date.now(),
                baseUrl: provider.baseUrl,
                protocol: provider.protocol,
                tools,
              },
            }
          : m,
      ),
    }));
  }
  return {
    ...workspace,
    config,
    profiles,
    error,
    credentials: {
      ...credentials,
      setKey: (provider: Provider, value: string) => {
        credentials.setKey(provider, value);
        setWorkspace((old) => ({
          ...old,
          models: old.models.map((m) =>
            m.providerId === provider.id
              ? { ...m, verification: undefined }
              : m,
          ),
        }));
      },
    },
    resolve,
    importBackup,
    select,
    addProvider,
    updateProvider,
    removeProvider,
    addModels,
    updateModel,
    removeModel,
    recordDiscovery,
    recordVerification,
  };
}

function repair(workspace: ModelWorkspace): ModelWorkspace {
  return {
    ...workspace,
    selected:
      workspace.models.find((m) => m.id === workspace.selected && m.enabled)
        ?.id ??
      workspace.models.find((m) => m.enabled)?.id ??
      "",
  };
}
