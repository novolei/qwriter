import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { errorText } from "../../shared/i18n/index";
import {
  commands,
  type ModelList,
  type ModelVerification,
} from "../../shared/ipc/bindings";
import type { Profile } from "../../shared/types";
import { connectionIssue, sameConnection } from "./connection";
type Action = "discover" | "verify";
type Captured<T> = { config: Profile; value: T };
export function useConnection(
  config: Profile,
  callbacks?: {
    onDiscover?: (data: ModelList) => void;
    onVerify?: (data: ModelVerification) => void;
  },
) {
  const latest = useRef(config);
  const generation = useRef(0);
  if (
    !sameConnection(latest.current, config) ||
    latest.current.model !== config.model
  )
    generation.current++;
  latest.current = config;
  const request = useRef(0);
  const pending = useRef(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [discovered, setDiscovered] = useState<Captured<ModelList> | null>(
    null,
  );
  const [verified, setVerified] = useState<Captured<ModelVerification> | null>(
    null,
  );
  const [failure, setFailure] = useState<Captured<string> | null>(null);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const models =
    discovered && sameConnection(discovered.config, config)
      ? discovered.value
      : null;
  const verification =
    verified &&
    sameConnection(verified.config, config) &&
    verified.config.model === config.model
      ? verified.value
      : null;
  const error =
    failure &&
    sameConnection(failure.config, config) &&
    failure.config.model === config.model
      ? failure.value
      : "";
  async function run(action: Action) {
    if (pending.current) return;
    const snapshot = config;
    const snapshotGeneration = generation.current;
    const invalid = connectionIssue(snapshot, action === "verify");
    if (invalid || !isTauri()) {
      setFailure({
        config: snapshot,
        value: invalid || "连接检测需要桌面版；可先管理供应商与模型池",
      });
      return;
    }
    const id = ++request.current;
    pending.current = true;
    setBusy(action);
    setFailure(null);
    if (action === "verify") setVerified(null);
    const current = () =>
      request.current === id &&
      generation.current === snapshotGeneration &&
      sameConnection(snapshot, latest.current) &&
      (action === "discover" || snapshot.model === latest.current.model);
    try {
      if (action === "discover") {
        const value = await commands.listModels(snapshot);
        if (current()) {
          setDiscovered({ config: snapshot, value });
          callbacks?.onDiscover?.(value);
        }
      } else {
        const value = await commands.modelVerify(snapshot);
        if (current()) {
          setVerified({ config: snapshot, value });
          callbacks?.onVerify?.(value);
        }
      }
    } catch (error) {
      if (current()) {
        if (action === "discover") setDiscovered(null);
        setFailure({ config: snapshot, value: errorText(error) });
      }
    } finally {
      if (request.current === id) {
        pending.current = false;
        setBusy(null);
      }
    }
  }
  return { models, verification, busy, error, run };
}
