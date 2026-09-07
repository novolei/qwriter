// Development-only fixture: real AgentPanel, hook, editor and styles; all document
// writes stay in React state. No model requests or persistent task/source fixtures.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorContent, useEditor } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import i18n, { t } from "../../../src/shared/i18n";
import { editorExtensions } from "../../../src/features/editor/editor-extensions";
import { AgentPanel } from "../../../src/features/agent/AgentPanel";
import { useWritingAgent } from "../../../src/features/agent/useWritingAgent";
import { knowledgeChunk } from "../../../src/test/fixtures/knowledge";
import "../../../src/styles/index.css";
import "./fixture.css";

const original = {
  id: "citation-qa",
  title: "Citation QA",
  markdown: "# Citation QA\n\nLocal fixture · 文稿只保留在此页面内存中。",
  updated: 1,
};
function Fixture() {
  useTranslation();
  const [dark, setDark] = useState(false);
  const [docs, setDocs] = useState([original]);
  const [current, setCurrent] = useState(original);
  const [notice, setNotice] = useState("");
  const editor = useEditor(
    {
      extensions: editorExtensions({
        onMissingTarget: () =>
          setNotice(t("文内链接的目标已不存在，请检查对应标题。")),
      }),
      content: current.markdown,
      contentType: "markdown",
      onUpdate: ({ editor }) =>
        setCurrent((doc) => ({ ...doc, markdown: editor.getMarkdown() })),
    },
    [current.id],
  );
  const agent = useWritingAgent({
    docs,
    current,
    editor,
    flush: async () => {},
    setDocs,
    selectDoc: setCurrent,
    notify: (message) => setNotice(t(message)),
    config: {
      id: "qa",
      provider: "Ollama",
      name: "QA",
      protocol: "openai",
      baseUrl: "http://localhost:11434/v1",
      model: "local-fixture",
      apiKey: "",
    },
  });
  function load() {
    agent.resume({
      id: "citation-fixture",
      instruction: "Write with sources",
      model: "Local fixture",
      documentId: current.id,
      createdAt: 1,
      output: {
        status: "complete",
        answer: "",
        rounds: 2,
        readIds: [],
        memoryReadIds: [],
        memories: [],
        knowledgeSources: [knowledgeChunk],
        draft: {
          title: "清晨的花园 · Morning notes",
          summary: "Citation QA · 固定样本，不调用模型。",
          markdown: `# 清晨的花园\n\n清晨的光影，让文字慢慢生长。[花园观察](#knowledge-${knowledgeChunk.id})\n\n${Array(5).fill("写作从观察开始。Look closely, write simply, and let each detail find its place.").join("\n\n")}\n\n[未找到的引用](#knowledge-unknown)`,
        },
      },
    });
  }
  useEffect(load, []);
  return (
    <div className={`app citation-fixture${dark ? " dark" : ""}`}>
      <header lang="en">
        <strong>Citation QA · in-memory fixture</strong>
        <button onClick={() => void i18n.changeLanguage("zh-CN")} lang="zh-CN">
          中文
        </button>
        <button onClick={() => void i18n.changeLanguage("en")} lang="en">
          English
        </button>
        <button onClick={() => setDark(!dark)}>Light / dark</button>
        <button onClick={load}>Load example task</button>
      </header>
      <div className="qa-workspace">
        <main className="editor">
          <div className="paper">
            <EditorContent editor={editor} />
          </div>
          <div className="qa-status" role="status">
            {notice}
          </div>
          <details>
            <summary lang="en">Saved Markdown (read only)</summary>
            <pre>{current.markdown}</pre>
          </details>
        </main>
        <aside className="companion">
          <AgentPanel
            agent={agent}
            docs={docs}
            current={current}
            modelSelector={<span>Local fixture</span>}
            onSettings={() => {}}
            otherBusy={false}
          />
        </aside>
      </div>
    </div>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<Fixture />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
