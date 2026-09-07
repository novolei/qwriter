import { documentCharacters } from "../features/editor/media/metrics";
import { documentIdentity } from "../features/editor/document-identity";
import { isTauri } from "@tauri-apps/api/core";
import { Focus, Placeholder } from "@tiptap/extensions";
import { useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAiWriting } from "../features/ai/useAiWriting";
import {
  editorExtensions,
  requiresSource,
} from "../features/editor/editor-extensions";
import { createSeedDocs } from "../features/library/seeds";
import { useLibrary } from "../features/library/useLibrary";
import { useModels } from "../features/models/useModels";
import { normalizeTypography } from "../features/settings/typography";
import { requestComfy } from "../features/studio/service";
import { errorText, t } from "../shared/i18n/index";
import type { Doc, Snapshot } from "../shared/types";
import { usePanelLayout } from "./usePanelLayout";
import { readLocal } from "../shared/storage";
export function useWorkspace() {
  useTranslation();
  const [seeds] = useState(createSeedDocs);
  const library = useLibrary(seeds);
  const { docs, setDocs, status: saveState } = library;
  const [active, setActive] = useState(() =>
    readLocal("qwriter.active", docs[0].id),
  );
  const current = docs.find((d) => d.id === active) ?? docs[0];
  const activeRef = useRef(current.id);
  activeRef.current = current.id;
  const currentRef = useRef(current);
  currentRef.current = current;
  useEffect(() => {
    if (!docs.some((d) => d.id === active)) setActive(docs[0].id);
    else {
      try {
        localStorage.setItem("qwriter.active", JSON.stringify(active));
      } catch {}
    }
  }, [docs, active]);
  const modelStore = useModels();
  const { config } = modelStore;
  const [tab, setTab] = useState<"agent" | "studio">("agent");
  const [settings, setSettings] = useState(false);
  const { left, setLeft, compact, libraryHint, dismissLibraryHint } =
    usePanelLayout();
  const [right, setRight] = useState(true);
  const [focus, setFocus] = useState(false);
  const [dark, setDark] = useState(() => readLocal("qwriter.dark", false));
  const [appearance, setAppearance] = useState(false);
  const [typography, setTypography] = useState(() =>
    normalizeTypography(readLocal("qwriter.typography", {})),
  );
  useEffect(() => {
    try {
      localStorage.setItem("qwriter.dark", JSON.stringify(dark));
      localStorage.setItem("qwriter.typography", JSON.stringify(typography));
    } catch {}
  }, [dark, typography]);
  const [history, setHistory] = useState(false);
  const [gitWorkspace, setGitWorkspace] = useState(false);
  const [source, setSource] = useState(false);
  const [paragraphFocus, setParagraphFocus] = useState(false);
  const [typewriter, setTypewriter] = useState(false);
  const paperScroll = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [comfy, setComfy] = useState("http://127.0.0.1:8188");
  const [workflow, setWorkflow] = useState("");
  const [job, setJob] = useState("");
  const [jobResult, setJobResult] = useState("");
  const [studioBusy, setStudioBusy] = useState(false);
  const editor = useEditor(
    {
      extensions: [
        ...editorExtensions({
          onMissingTarget: () =>
            setNotice("文内链接的目标已不存在，请检查对应标题。"),
        }),
        documentIdentity(current.id),
        Focus.configure({ className: "current-block", mode: "shallowest" }),
        Placeholder.configure({
          placeholder: () => t("在这里落笔，让想法慢慢成形…"),
        }),
      ],
      content: current.markdown,
      contentType: "markdown",
      onUpdate: ({ editor }) => {
        const markdown = editor.getMarkdown();
        setDocs((old) =>
          old.map((d) =>
            d.id === editor.storage.documentIdentity.id
              ? {
                  ...d,
                  markdown,
                  updated: Date.now(),
                }
              : d,
          ),
        );
      },
    },
    [current.id, library.ready],
  );
  const ai = useAiWriting({
    current,
    currentRef,
    config,
    setDocs,
    selectDoc,
    setNotice,
    setRight,
    setTab,
    library,
    editor,
  });
  const { setReview } = ai;
  useEffect(() => {
    if (!editor || !typewriter || source) return;
    let frame = 0;
    const center = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scroll = paperScroll.current;
        if (!scroll || !editor.isFocused || editor.isDestroyed) return;
        const caret = editor.view.coordsAtPos(editor.state.selection.head);
        const top =
          caret.top -
          scroll.getBoundingClientRect().top -
          scroll.clientHeight * 0.42;
        if (Math.abs(top) > 2) scroll.scrollBy({ top, behavior: "instant" });
      });
    };
    editor.on("selectionUpdate", center);
    editor.on("focus", center);
    center();
    return () => {
      cancelAnimationFrame(frame);
      editor.off("selectionUpdate", center);
      editor.off("focus", center);
    };
  }, [editor, typewriter, source]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  function selectDoc(d: Doc) {
    activeRef.current = d.id;
    setActive(d.id);
    setReview(false);
  }
  function newDoc() {
    const d = {
      id: crypto.randomUUID(),
      title: t("未命名文稿"),
      markdown: t("# 未命名文稿\n\n"),
      updated: Date.now(),
    };
    setDocs((old) => [d, ...old]);
    selectDoc(d);
  }
  async function exportDoc() {
    try {
      if (/qwriter-asset:\/\/|^```qwriter-media/m.test(current.markdown)) {
        const { exportMediaBundle } =
          await import("../features/editor/media/export");
        await exportMediaBundle(current.title, current.markdown);
        return;
      }
      if (isTauri()) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const path = await save({
          defaultPath: `${current.title.replace(/[<>:"/\\|?*]/g, "_")}.md`,
          filters: [
            {
              name: "Markdown",
              extensions: ["md"],
            },
          ],
        });
        if (path) await writeTextFile(path, current.markdown);
      } else {
        const url = URL.createObjectURL(
          new Blob([current.markdown], {
            type: "text/markdown;charset=utf-8",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${current.title}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setNotice(errorText(e));
    }
  }
  async function importDoc() {
    try {
      if (!isTauri()) {
        fileRef.current?.click();
        return;
      }
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await open({
        multiple: false,
        filters: [
          {
            name: "Markdown",
            extensions: ["md", "txt"],
          },
        ],
      });
      if (path) {
        addImported(path.split(/[\\/]/).pop()!, await readTextFile(path));
      }
    } catch (e) {
      setNotice(errorText(e));
    }
  }
  function addImported(name: string, markdown: string) {
    const d = {
      id: crypto.randomUUID(),
      title: name.replace(/\.(md|txt)$/i, ""),
      markdown,
      updated: Date.now(),
    };
    setDocs((old) => [d, ...old]);
    selectDoc(d);
  }
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void library
          .flush()
          .then(() => setNotice(isTauri() ? "文稿已保存到磁盘" : "草稿已保存"))
          .catch((e) => setNotice(errorText(e)));
      }
      if (
        e.key === "Escape" &&
        !document.querySelector("[role=dialog], [data-ui-overlay]")
      ) {
        setFocus(false);
        setSettings(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });
  async function restoreVersion(snapshot: Snapshot) {
    const docId = currentRef.current.id;
    await library.flush();
    if (currentRef.current.id !== docId)
      throw new Error(t("文稿已切换，请重新打开历史"));
    editor?.commands.setContent(snapshot.markdown, {
      contentType: "markdown",
      emitUpdate: false,
    });
    setDocs((old) =>
      old.map((d) =>
        d.id === docId
          ? {
              ...d,
              title: snapshot.title,
              markdown: snapshot.markdown,
              updated: Date.now(),
            }
          : d,
      ),
    );
    setNotice("历史内容已恢复，恢复前的版本也已保留");
  }
  async function studio(action: "test" | "submit" | "history") {
    setStudioBusy(true);
    try {
      if (!isTauri()) throw new Error(t("工作流调用需要运行桌面版"));
      const result = await requestComfy(
        comfy,
        action === "submit" ? JSON.parse(workflow) : null,
        action === "history" ? job : null,
      );
      setJobResult(JSON.stringify(result, null, 2));
      if (typeof result.prompt_id === "string") setJob(result.prompt_id);
      setNotice(
        action === "submit" ? "工作流已提交到 ComfyUI" : "已获取服务响应",
      );
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setStudioBusy(false);
    }
  }
  const protectedSource = requiresSource(current.markdown);
  const showSource = source || protectedSource;
  const headings = current.markdown
    .split("\n")
    .filter((l) => /^#{1,6} /.test(l));
  const words = documentCharacters(current.markdown);
  return {
    ...ai,
    compact,
    libraryHint,
    dismissLibraryHint,
    active,
    setActive,
    tab,
    setTab,
    settings,
    setSettings,
    left,
    setLeft,
    right,
    setRight,
    focus,
    setFocus,
    dark,
    setDark,
    appearance,
    setAppearance,
    typography,
    setTypography,
    history,
    setHistory,
    gitWorkspace,
    setGitWorkspace,
    source,
    setSource,
    paragraphFocus,
    setParagraphFocus,
    typewriter,
    setTypewriter,
    search,
    setSearch,
    notice,
    setNotice,
    comfy,
    setComfy,
    workflow,
    setWorkflow,
    job,
    setJob,
    jobResult,
    setJobResult,
    studioBusy,
    setStudioBusy,
    selectDoc,
    newDoc,
    exportDoc,
    importDoc,
    addImported,
    restoreVersion,
    studio,
    library,
    docs,
    setDocs,
    saveState,
    current,
    modelStore,
    config,
    editor,
    protectedSource,
    showSource,
    headings,
    words,
    paperScroll,
    fileRef,
  };
}
export type Workspace = ReturnType<typeof useWorkspace>;
