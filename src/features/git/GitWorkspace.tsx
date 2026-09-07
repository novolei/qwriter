import { isTauri } from "@tauri-apps/api/core";
import {
  Check,
  Download,
  FileText,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorText, locale, t } from "../../shared/i18n/index";
import { commands, type RepoInfo, type Patch } from "../../shared/ipc/bindings";
import type { Doc } from "../../shared/types";
import { Modal } from "../../shared/ui/Modal";
import { readLocal } from "../../shared/storage";
export function GitWorkspace({
  doc,
  onClose,
}: {
  doc: Doc;
  onClose: () => void;
}) {
  const [path, setPath] = useState(() =>
    readLocal<string>("qwriter.git.path", ""),
  );
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [tab, setTab] = useState<"changes" | "history">("changes");
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState("");
  const [patch, setPatch] = useState<Patch | null>(null);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  async function refresh(target = path) {
    const token = ++generation.current;
    setBusy(true);
    setError("");
    setPatch(null);
    setFile("");
    setSelected([]);
    try {
      const value = await commands.gitInspect(target);
      if (token !== generation.current) return;
      setRepo(value);
      setName(
        (old) => value.authorName || (repo?.path === value.path ? old : ""),
      );
      setEmail(
        (old) => value.authorEmail || (repo?.path === value.path ? old : ""),
      );
      try {
        localStorage.setItem("qwriter.git.path", JSON.stringify(value.path));
      } catch {}
    } catch (e) {
      if (token === generation.current) {
        setError(errorText(e));
        setRepo(null);
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (path && isTauri()) void refresh();
    return () => {
      generation.current++;
    };
  }, [path]);
  useEffect(() => {
    let alive = true;
    setPatch(null);
    if (file && repo)
      void commands
        .gitFileDiff(repo.path, file)
        .then((value) => {
          if (alive) setPatch(value);
        })
        .catch((e) => {
          if (alive) setError(errorText(e));
        });
    return () => {
      alive = false;
    };
  }, [file, repo]);
  async function choose() {
    if (!isTauri()) return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const chosen = await open({
      directory: true,
      multiple: false,
      title: t("选择文稿仓库"),
    });
    if (chosen) {
      setNotice("");
      if (chosen === path) void refresh();
      else setPath(chosen);
    }
  }
  async function initialize() {
    setBusy(true);
    setError("");
    try {
      await commands.gitInit(path);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportCopy() {
    if (!repo) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const target = await save({
        defaultPath:
          repo.path.replace(/[\\/]$/, "") +
          "/" +
          doc.title.replace(/[<>:"/\\|?*]/g, "_") +
          ".md",
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!target) return;
      await writeTextFile(target, doc.markdown);
      setNotice("已导出文稿副本，请检查更改后提交");
      await refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function commit() {
    if (!repo) return;
    setBusy(true);
    setError("");
    try {
      await commands.gitCommit({
        path: repo.path,
        files: selected,
        message,
        name,
        email,
        expectedHead: repo.head,
      });
      setMessage("");
      setNotice("本地版本已提交");
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const kinds: Record<string, string> = {
    added: "新增",
    modified: "修改",
    deleted: "删除",
    renamed: "重命名",
    conflicted: "冲突",
  };
  return (
    <Modal
      title={t("Git 文稿工作区")}
      eyebrow={t("EVERY DRAFT, A CHAPTER")}
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {!isTauri() ? (
        <div className="git-empty">
          <GitBranch size={30} />
          <h3>{t("为每次创作留下版本")}</h3>
          <p>
            {t(
              "请在桌面版打开 Git 工作区，可查看更改、审阅差异与提交本地版本。",
            )}
          </p>
          <small>{t("内置 libgit2，无需另外安装 Git 命令行。")}</small>
        </div>
      ) : (
        <>
          <div className="git-topline">
            <span>
              <GitBranch size={16} />
              {repo?.branch ?? t("尚未连接仓库")}
            </span>
            <div>
              <button
                disabled={busy}
                onClick={() =>
                  void choose().catch((e) => setError(errorText(e)))
                }
              >
                <FolderOpen size={15} />
                {t(path ? "切换仓库" : "选择文稿仓库")}
              </button>
              {path && (
                <button
                  title={t("刷新仓库")}
                  aria-label={t("刷新仓库")}
                  disabled={busy}
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={15} className={busy ? "spin" : ""} />
                </button>
              )}
            </div>
          </div>
          {path && <p className="git-path">{repo?.path ?? path}</p>}
          <p className="git-intro">
            {t(
              "文稿库仍自动保存在本机。导出 Markdown 副本到此仓库后，可独立管理 Git 版本。",
            )}
          </p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="git-notice" role="status">
              <Check size={14} />
              {t(notice)}
            </p>
          )}
          {busy && (
            <p className="git-loading">
              <LoaderCircle size={14} className="spin" />
              {t("正在处理 Git 工作区…")}
            </p>
          )}
          {path && !repo && !busy && (
            <div className="git-empty">
              <p>{t("若该目录尚未启用 Git，可以为它建立本地仓库。")}</p>
              <button className="primary" onClick={() => void initialize()}>
                {t("初始化本地仓库")}
              </button>
            </div>
          )}
          {repo && (
            <>
              <div className="git-tabs">
                <button
                  className={tab === "changes" ? "chosen" : ""}
                  onClick={() => setTab("changes")}
                >
                  {t("工作区更改")}
                  <span>
                    {repo.changes.length}
                    {repo.truncated ? "+" : ""}
                  </span>
                </button>
                <button
                  className={tab === "history" ? "chosen" : ""}
                  onClick={() => setTab("history")}
                >
                  {t("提交记录")}
                </button>
                <button disabled={busy} onClick={() => void exportCopy()}>
                  <Download size={14} />
                  {t("导出当前文稿")}
                </button>
              </div>
              {tab === "changes" ? (
                <>
                  {repo.changes.length === 0 ? (
                    <div className="git-empty">
                      <Check size={26} />
                      <h3>{t("工作区干净，安心写作")}</h3>
                      <p>{t("新文稿或修改后的副本会出现在这里。")}</p>
                    </div>
                  ) : (
                    <div className="git-changes-layout">
                      <div className="git-file-list">
                        {repo.changes.map((change) => (
                          <div
                            key={change.path}
                            className={file === change.path ? "chosen" : ""}
                          >
                            <input
                              type="checkbox"
                              aria-label={t("选择文件 {{path}}", {
                                path: change.path,
                              })}
                              disabled={
                                busy ||
                                change.kind === "conflicted" ||
                                change.kind === "renamed"
                              }
                              checked={selected.includes(change.path)}
                              onChange={(e) =>
                                setSelected((old) =>
                                  e.target.checked
                                    ? [...old, change.path]
                                    : old.filter((p) => p !== change.path),
                                )
                              }
                            />
                            <button
                              disabled={busy}
                              onClick={() => setFile(change.path)}
                              title={change.path}
                            >
                              <FileText size={13} />
                              <span>{change.path}</span>
                              <small className={`git-kind ${change.kind}`}>
                                {t(kinds[change.kind] ?? "修改")}
                              </small>
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="git-patch">
                        {!file ? (
                          <p>{t("选择一个文件，查看与上次提交的差异。")}</p>
                        ) : patch ? (
                          <>
                            <div className="git-patch-title">{file}</div>
                            <pre>
                              {patch.text
                                ? patch.text.split("\n").map((line, i) => (
                                    <span
                                      key={i}
                                      className={
                                        line.startsWith("+") &&
                                        !line.startsWith("+++")
                                          ? "patch-add"
                                          : line.startsWith("-") &&
                                              !line.startsWith("---")
                                            ? "patch-remove"
                                            : ""
                                      }
                                    >
                                      {line || " "}
                                    </span>
                                  ))
                                : t("没有文本差异，文件可能是二进制内容。")}
                            </pre>
                            {patch.truncated && (
                              <small>
                                {t(
                                  "差异较长，预览已截断。请用完整 Git 工具审阅。",
                                )}
                              </small>
                            )}
                          </>
                        ) : (
                          <p>{t("正在读取差异…")}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {repo.truncated && (
                    <small>
                      {t(
                        "仅显示前 500 项更改，请使用完整 Git 工具处理大型仓库。",
                      )}
                    </small>
                  )}
                  {repo.changes.length > 0 && (
                    <form
                      className="git-commit-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void commit();
                      }}
                    >
                      <label>
                        {t("提交说明")}
                        <input
                          value={message}
                          maxLength={4000}
                          disabled={busy}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder={t("这次创作，有哪些值得记录的变化？")}
                        />
                      </label>
                      <div className="git-author">
                        <label>
                          {t("提交署名")}
                          <input
                            value={name}
                            disabled={busy}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </label>
                        <label>
                          {t("提交邮箱")}
                          <input
                            type="email"
                            value={email}
                            disabled={busy}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="modal-footer">
                        <small>{t("提交保留在本机，不会自动推送。")}</small>
                        <button
                          type="submit"
                          className="primary"
                          disabled={
                            busy ||
                            !selected.length ||
                            !message.trim() ||
                            !name.trim() ||
                            !email.trim() ||
                            repo.state !== "Clean"
                          }
                        >
                          <GitCommitHorizontal size={15} />
                          {t("提交所选更改")} ({selected.length})
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <div className="git-history">
                  {repo.history.length ? (
                    repo.history.map((item) => (
                      <div key={item.id}>
                        <GitCommitHorizontal size={16} />
                        <section>
                          <strong>{item.summary}</strong>
                          <small>
                            {item.author} ·{" "}
                            {new Date(item.time * 1000).toLocaleString(
                              locale(),
                            )}
                          </small>
                        </section>
                        <code>{item.id.slice(0, 7)}</code>
                      </div>
                    ))
                  ) : (
                    <div className="git-empty">
                      {t("提交第一个版本后，记录会出现在这里。")}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
