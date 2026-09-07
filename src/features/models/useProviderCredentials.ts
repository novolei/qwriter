import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { errorText } from "../../shared/i18n/index";
import { commands } from "../../shared/ipc/bindings";
import { credentialOrigin } from "./connection";
import type { Provider } from "./types";

type KeyState = { origin: string; value: string; source: "session" | "system" };
export function useProviderCredentials(
  providers: Provider[],
  onSaved: (id: string, origin?: string) => void,
) {
  const [keys, setKeys] = useState<Record<string, KeyState>>({});
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const latest = useRef(providers);
  latest.current = providers;
  const attempts = useRef(new Set<string>());
  const revisions = useRef<Record<string, number>>({});
  const mounted = useRef(true);
  const pending = useRef(new Set<string>());
  const [busy, setBusy] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function revision(id: string) {
    revisions.current[id] = (revisions.current[id] ?? 0) + 1;
    return revisions.current[id];
  }
  function put(id: string, key: KeyState) {
    keysRef.current = { ...keysRef.current, [id]: key };
    setKeys(keysRef.current);
  }
  function setKey(provider: Provider, value: string) {
    revision(provider.id);
    put(provider.id, {
      origin: credentialOrigin(provider.baseUrl),
      value: value.trim(),
      source: "session",
    });
    setErrors((old) => ({ ...old, [provider.id]: "" }));
  }
  function value(provider: Provider) {
    const key = keys[provider.id];
    return key?.origin === credentialOrigin(provider.baseUrl) ? key.value : "";
  }
  async function operation(
    provider: Provider,
    action: "load" | "save" | "forget",
  ) {
    if (pending.current.has(provider.id)) return false;
    if (!isTauri()) {
      setErrors((old) => ({ ...old, [provider.id]: "系统凭据存储需要桌面版" }));
      return false;
    }
    pending.current.add(provider.id);
    setBusy([...pending.current]);
    const version = revision(provider.id);
    const origin = credentialOrigin(provider.baseUrl);
    const snapshot = value(provider);
    setErrors((old) => ({ ...old, [provider.id]: "" }));
    try {
      if (action === "load") {
        if (provider.credentialOrigin !== origin) return false;
        const key = await commands.credentialRead(provider.id, origin);
        if (
          mounted.current &&
          revisions.current[provider.id] === version &&
          latest.current.some(
            (p) =>
              p.id === provider.id && credentialOrigin(p.baseUrl) === origin,
          )
        ) {
          put(provider.id, {
            origin,
            value: key ?? "",
            source: key ? "system" : "session",
          });
          if (key === null) onSaved(provider.id);
        }
      } else if (action === "save") {
        if (!snapshot) throw new Error("请先填写此服务的 API Key");
        if (provider.credentialOrigin && provider.credentialOrigin !== origin)
          await commands.credentialRemove(
            provider.id,
            provider.credentialOrigin,
          );
        await commands.credentialWrite(provider.id, origin, snapshot);
        if (mounted.current) {
          onSaved(provider.id, origin);
          if (revisions.current[provider.id] === version)
            put(provider.id, { origin, value: snapshot, source: "system" });
        }
      } else if (provider.credentialOrigin) {
        await commands.credentialRemove(provider.id, provider.credentialOrigin);
        if (mounted.current) {
          onSaved(provider.id);
          if (revisions.current[provider.id] === version)
            put(provider.id, { origin, value: snapshot, source: "session" });
        }
      }
      return true;
    } catch (error) {
      if (mounted.current)
        setErrors((old) => ({ ...old, [provider.id]: errorText(error) }));
      return false;
    } finally {
      pending.current.delete(provider.id);
      if (mounted.current) setBusy([...pending.current]);
    }
  }
  useEffect(() => {
    for (const provider of providers) {
      const key = `${provider.id}:${provider.credentialOrigin}`;
      if (
        isTauri() &&
        provider.credentialOrigin &&
        provider.credentialOrigin === credentialOrigin(provider.baseUrl) &&
        !keysRef.current[provider.id] &&
        !attempts.current.has(key)
      ) {
        attempts.current.add(key);
        void operation(provider, "load");
      }
    }
  }, [providers]);
  return {
    value,
    setKey,
    operation,
    busy,
    errors,
    source: (provider: Provider) =>
      keys[provider.id]?.origin === credentialOrigin(provider.baseUrl)
        ? keys[provider.id]?.source
        : "session",
  };
}
