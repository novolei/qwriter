import { readLocal } from "../../shared/storage";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { errorText, t } from "../../shared/i18n/index";
import { commands, type Library } from "../../shared/ipc/bindings";
import type { Doc } from "../../shared/types";
export function validDocs(value: unknown): value is Doc[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    new Set(value.map((d) => d?.id)).size === value.length &&
    value.every(
      (d) =>
        d &&
        typeof d.id === "string" &&
        d.id.length > 0 &&
        typeof d.title === "string" &&
        typeof d.markdown === "string" &&
        Number.isSafeInteger(d.updated) &&
        d.updated >= 0,
    )
  );
}

type Pending = {
  docs: Doc[];
  baseRevision: number;
};
export function recoverDrafts(disk: Doc[], pending: Doc[]): Doc[] {
  const recovered = pending
    .filter(
      (d) =>
        !disk.some(
          (x) =>
            x.id === d.id && x.title === d.title && x.markdown === d.markdown,
        ),
    )
    .map((d) => ({
      ...d,
      id: crypto.randomUUID(),
      title: t("{{value0}}（恢复的草稿）", {
        value0: d.title,
      }),
      updated: Date.now(),
    }));
  return [...recovered, ...disk];
}
export function useLibrary(seeds: Doc[]) {
  const [docs, setDocs] = useState<Doc[]>(() => {
    const stored = readLocal<unknown>("qwriter.docs", null);
    return validDocs(stored) ? stored : seeds;
  });
  const [ready, setReady] = useState(!isTauri());
  const [status, setStatus] = useState(
    isTauri() ? "正在打开文稿库…" : "浏览器草稿已保存",
  );
  const [error, setError] = useState("");
  const [location, setLocation] = useState("浏览器本地缓存");
  const [closing, setClosing] = useState(false);
  const latest = useRef(docs);
  latest.current = docs;
  const revision = useRef(0);
  const saved = useRef<Doc[] | null>(null);
  const queue = useRef<Promise<void> | null>(null);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const boot = useRef<Promise<Library> | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    boot.current ??= commands.libraryLoad();
    void boot.current
      .then((data) => {
        if (!alive) return;
        const pending = readLocal<Pending | null>("qwriter.pending", null);
        let chosen = data.docs.length ? data.docs : latest.current;
        saved.current = data.docs.length ? data.docs : null;
        if (pending && validDocs(pending.docs)) {
          chosen =
            pending.baseRevision === data.revision
              ? pending.docs
              : recoverDrafts(data.docs, pending.docs);
        }
        revision.current = data.revision;
        latest.current = chosen;
        setDocs(chosen);
        setLocation(data.location);
        setReady(true);
        setStatus("磁盘已保存");
      })
      .catch((e) => {
        if (alive) {
          setError(errorText(e));
          setStatus("文稿库打开失败 · 草稿可导出");
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  async function flush(): Promise<void> {
    if (!readyRef.current) throw new Error(t("文稿库尚未就绪"));
    if (queue.current) return queue.current;
    const run = async () => {
      try {
        while (saved.current !== latest.current) {
          const snapshot = latest.current;
          // Synchronous recovery cache is written before the IPC/disk transaction.
          try {
            localStorage.setItem("qwriter.docs", JSON.stringify(snapshot));
          } catch (e) {
            // Cache quota must not prevent a desktop disk commit.
            if (!isTauri()) throw e;
          }
          if (isTauri()) {
            try {
              localStorage.setItem(
                "qwriter.pending",
                JSON.stringify({
                  docs: snapshot,
                  baseRevision: revision.current,
                }),
              );
            } catch {
              /* SQLite remains available even if WebView storage is full. */
            }
            setStatus("正在写入磁盘…");
            revision.current = await commands.librarySave(
              snapshot,
              revision.current,
            );
          }
          saved.current = snapshot;
        }
        if (isTauri()) {
          try {
            localStorage.removeItem("qwriter.pending");
          } catch {}
        }
        setStatus(isTauri() ? "磁盘已保存" : "浏览器草稿已保存");
        setError("");
      } catch (e) {
        setError(errorText(e));
        setStatus("保存失败 · 草稿待恢复");
        throw e;
      }
    };
    queue.current = run().finally(() => {
      queue.current = null;
    });
    return queue.current;
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("qwriter.docs", JSON.stringify(docs));
      if (isTauri() && saved.current !== docs)
        localStorage.setItem(
          "qwriter.pending",
          JSON.stringify({
            docs,
            baseRevision: revision.current,
          }),
        );
      if (saved.current !== docs)
        setStatus(isTauri() ? "草稿已缓存 · 等待写入磁盘" : "正在保存草稿…");
    } catch (e) {
      setError(
        t("本机缓存写入失败：{{value0}}", {
          value0: errorText(e),
        }),
      );
    }
    const timer = setTimeout(() => {
      void flushRef.current().catch(() => {});
    }, 650);
    return () => clearTimeout(timer);
  }, [docs, ready]);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        const stop = await win.onCloseRequested(async (event) => {
          event.preventDefault();
          setClosing(true);
          try {
            await flushRef.current();
            await win.destroy();
          } catch {
            setClosing(false);
            setError(t("关闭前保存失败，窗口已保留。请重试保存或导出文稿。"));
          }
        });
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((e) =>
        setError(
          t("关闭保护未能启用：{{value0}}", {
            value0: errorText(e),
          }),
        ),
      );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  return {
    docs,
    setDocs,
    ready,
    status,
    error,
    location,
    flush,
    closing,
  };
}
