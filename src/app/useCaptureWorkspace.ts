import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { commands, type Asset } from "../shared/ipc/bindings";
import { getAsset, importAsset } from "../shared/media/assets";
import { errorText, t } from "../shared/i18n";
import { newCard, type Card } from "../features/capture/cards";
import { recoverDraft } from "../features/capture/drafts";
import { cardMarkdown } from "../features/editor/media/content";
import { useCards } from "../features/capture/useCards";
import { useNativeCapture } from "../features/capture/desktop/useNativeCapture";
import type { Workspace } from "./useWorkspace";
export type CapturePanel =
  "inbox" | "note" | "media" | "screenshot" | "annotate" | "result" | null;
export function useCaptureWorkspace(
  workspace: Pick<
    Workspace,
    "editor" | "current" | "setDocs" | "setNotice" | "showSource" | "library"
  >,
) {
  useNativeCapture();
  const cards = useCards();
  const [panel, setPanel] = useState<CapturePanel>(null);
  const [card, setCard] = useState<Card>(newCard);
  const [asset, setAsset] = useState<Asset>();
  const current = useRef(workspace);
  current.current = workspace;
  const target = useRef({
    id: workspace.current.id,
    base: workspace.current.markdown,
    position: 0,
  });
  const pending = useRef(false);
  function remember() {
    const { current: doc, editor } = current.current;
    target.current = {
      id: doc.id,
      base: doc.markdown,
      position: editor?.state.selection.to ?? 0,
    };
  }
  function open(value: CapturePanel) {
    remember();
    if (value === "media") setAsset(undefined);
    setPanel(value);
  }
  function quickNote(initial?: Card) {
    setCard(initial ?? recoverDraft());
    setPanel("note");
  }
  async function insert(markdown: string) {
    const now = current.current;
    if (
      !now.library.ready ||
      target.current.id !== now.current.id ||
      target.current.base !== now.current.markdown
    )
      throw new Error("文稿已发生变化，请重新打开插入窗口后再试");
    if (now.editor && !now.showSource) {
      const content =
        now.editor.storage.markdown.manager.parse(markdown).content ?? [];
      // Insert after the caret, without replacing the user's selected passage.
      if (
        !now.editor
          .chain()
          .focus()
          .insertContentAt(target.current.position, content)
          .run()
      )
        throw new Error("无法在此位置插入，请把光标移到正文后重试");
    } else
      now.setDocs((docs) =>
        docs.map((doc) =>
          doc.id === now.current.id
            ? {
                ...doc,
                markdown: `${doc.markdown}\n\n${markdown}\n`,
                updated: Date.now(),
              }
            : doc,
        ),
      );
    now.setNotice(t("素材已插入文稿"));
  }
  async function insertCard(value: Card) {
    if (pending.current) return;
    pending.current = true;
    try {
      await insert(await cardMarkdown(value));
      setPanel(null);
    } catch (error) {
      current.current.setNotice(errorText(error));
    } finally {
      pending.current = false;
    }
  }
  function reviewAsset(value: Asset) {
    remember();
    setAsset(value);
    setPanel("media");
  }
  useEffect(() => {
    if (!isTauri()) return;
    let stop: (() => void) | undefined;
    let alive = true;
    const consume = async () => {
      const id = await commands.capturePendingInsert();
      if (id) {
        const asset = await getAsset(id);
        if (alive) reviewAsset(asset);
      }
    };
    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        const cleanup = await listen("capture-insert", () => {
          void consume().catch((error) =>
            current.current.setNotice(errorText(error)),
          );
        });
        if (!alive) cleanup();
        else {
          stop = cleanup;
          await consume();
        }
      })
      .catch((error) => current.current.setNotice(errorText(error)));
    return () => {
      alive = false;
      stop?.();
    };
  }, []);
  useEffect(() => {
    const editor = workspace.editor;
    if (!editor || editor.isDestroyed) return;
    const element = editor.view.dom;
    const capture = (event: ClipboardEvent | DragEvent) => {
      const data =
        "clipboardData" in event ? event.clipboardData : event.dataTransfer;
      const files = Array.from(data?.files ?? []).filter((file) =>
        /^(image|video)\//.test(file.type),
      );
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      remember();
      if (pending.current) return;
      pending.current = true;
      void importAsset(files[0], files[0].name)
        .then((value) => {
          setAsset(value);
          setPanel("media");
        })
        .catch((error) => current.current.setNotice(errorText(error)))
        .finally(() => {
          pending.current = false;
        });
    };
    element.addEventListener("paste", capture, true);
    element.addEventListener("drop", capture, true);
    return () => {
      element.removeEventListener("paste", capture, true);
      element.removeEventListener("drop", capture, true);
    };
  }, [workspace.editor]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (isTauri() || !(event.ctrlKey || event.metaKey)) return;
      if (event.altKey && event.code === "KeyN") {
        event.preventDefault();
        quickNote();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return {
    cards,
    panel,
    setPanel,
    card,
    setCard,
    asset,
    setAsset,
    open,
    quickNote,
    insert,
    insertCard,
    reviewAsset,
    targetTitle: workspace.current.title,
  };
}
