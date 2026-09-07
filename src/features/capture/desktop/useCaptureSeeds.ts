import { useCallback, useEffect, useRef, useState } from "react";
import { commands, type CaptureSeed } from "../../../shared/ipc/bindings";
import { errorText, t } from "../../../shared/i18n";
export function useCaptureSeeds() {
  const [seeds, setSeeds] = useState<CaptureSeed[]>([]);
  const [error, setError] = useState("");
  const draining = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let alive = true;
    let cleanup: (() => void) | undefined;
    async function drain() {
      if (draining.current) return;
      draining.current = true;
      try {
        while (mounted.current) {
          const seed = await commands.captureTake();
          if (!seed) break;
          if (mounted.current)
            setSeeds((old) =>
              old.some((value) => value.id === seed.id) ? old : [...old, seed],
            );
        }
      } catch (error) {
        if (mounted.current) setError(errorText(error));
      } finally {
        draining.current = false;
      }
    }
    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        const stop = await listen("capture-seed", () => {
          void drain();
        });
        if (!alive) {
          stop();
          return;
        }
        cleanup = stop;
        const busy = await listen("capture-busy", () => {
          if (mounted.current) setError(t("请先处理已捕捉的灵感"));
        });
        if (!alive) {
          stop();
          busy();
        } else {
          cleanup = () => {
            stop();
            busy();
          };
          await drain();
        }
      })
      .catch((error) => {
        if (alive) setError(errorText(error));
      });
    return () => {
      alive = false;
      mounted.current = false;
      cleanup?.();
    };
  }, []);
  const next = useCallback(() => {
    setError("");
    setSeeds((old) => old.slice(1));
  }, []);
  return { seed: seeds[0], count: seeds.length, next, error };
}
