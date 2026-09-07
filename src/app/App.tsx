import { InspirationEntry } from "../features/capture/InspirationInbox";
import { useCaptureWorkspace } from "./useCaptureWorkspace";
import { CaptureDialogs } from "./components/CaptureDialogs";
import { LoaderCircle } from "lucide-react";
import { BrandIcon } from "../shared/brand/BrandIcon";
import React, { lazy, Suspense, useState } from "react";
import { useQuickActions } from "./useQuickActions";
import { useWritingAgent } from "../features/agent/useWritingAgent";
import { ModelSwitcher } from "../features/models/ModelSwitcher";
import { fontFamily } from "../features/settings/typography";
import { language, t } from "../shared/i18n/index";
import { AppearancePanel } from "./panels/AppearancePanel";
import { CompanionPanel } from "./panels/CompanionPanel";
import { EditorPane } from "./panels/EditorPane";
import { LibrarySidebar } from "./panels/LibrarySidebar";
import { StudioPanel } from "./panels/StudioPanel";
import { WorkspaceDialogs } from "./panels/WorkspaceDialogs";
import { useWorkspace } from "./useWorkspace";
import { LibraryDrawer } from "./components/LibraryDrawer";
const CommandPalette = lazy(() =>
  import("../features/navigation/CommandPalette").then((module) => ({
    default: module.CommandPalette,
  })),
);
const AgentPanel = lazy(() =>
  import("../features/agent/AgentPanel").then((module) => ({
    default: module.AgentPanel,
  })),
);
function FeatureLoading() {
  return (
    <div className="feature-loading" role="status">
      <LoaderCircle size={17} className="spin" />
      {t("正在打开…")}
    </div>
  );
}
export function App() {
  const workspace = useWorkspace();
  const capture = useCaptureWorkspace(workspace);
  const [agentMode, setAgentMode] = useState<"quick" | "task">("quick");
  const writingAgent = useWritingAgent({
    docs: workspace.docs,
    current: workspace.current,
    config: workspace.config,
    editor: workspace.editor,
    flush: workspace.library.flush,
    setDocs: workspace.setDocs,
    selectDoc: workspace.selectDoc,
    notify: workspace.setNotice,
  });
  const quick = useQuickActions({
    ...workspace,
    onScreenshot: () => capture.open("screenshot"),
    onQuickNote: () => capture.quickNote(),
    onAgent: () => {
      workspace.setFocus(false);
      workspace.setRight(true);
      workspace.setTab("agent");
      setAgentMode("task");
    },
  });
  const {
    active,
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
    review,
    setReview,
    applying,
    writeMode,
    setWriteMode,
    resultMode,
    resultStatus,
    canCancel,
    source,
    setSource,
    paragraphFocus,
    setParagraphFocus,
    typewriter,
    setTypewriter,
    resultSelection,
    search,
    setSearch,
    notice,
    setNotice,
    prompt,
    setPrompt,
    busy,
    answer,
    setAnswer,
    resultDoc,
    resultBase,
    contextEnabled,
    setContextEnabled,
    selectDoc,
    newDoc,
    exportDoc,
    importDoc,
    addImported,
    runAi,
    polishSelection,
    cancelAi,
    applyResult,
    saveAnswer,
    restoreVersion,
    library,
    docs,
    setDocs,
    saveState,
    current,
    modelStore,
    editor,
    protectedSource,
    showSource,
    headings,
    words,
    paperScroll,
    fileRef,
    proposed,
  } = workspace;
  return (
    <div
      data-language={language()}
      className={`app ${dark ? "dark" : ""} ${focus ? "focus" : ""} ${paragraphFocus ? "paragraph-focus" : ""} ${typewriter ? "typewriter-mode" : ""}`}
      style={
        {
          "--writing-size": `${typography.fontSize}px`,
          "--writing-line": typography.lineHeight,
          "--writing-width": `${typography.width}px`,
          "--ui-font": fontFamily(typography.uiFont, typography.uiLatin),
          "--document-font": fontFamily(
            typography.documentFont,
            typography.documentLatin,
          ),
        } as React.CSSProperties
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".md,.txt"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) addImported(f.name, await f.text());
          e.target.value = "";
        }}
      />
      <div className="workspace">
        <LibraryDrawer
          compact={workspace.compact}
          open={left && !focus}
          onClose={() => setLeft(false)}
        >
          <LibrarySidebar
            captureEntry={
              <InspirationEntry
                cards={capture.cards.cards}
                onOpen={() => capture.open("inbox")}
                onNew={() => capture.quickNote()}
              />
            }
            left={left}
            focus={focus}
            search={search}
            setSearch={setSearch}
            newDoc={() => {
              newDoc();
              if (workspace.compact) setLeft(false);
            }}
            docs={docs}
            active={active}
            selectDoc={(doc) => {
              selectDoc(doc);
              if (workspace.compact) setLeft(false);
            }}
            headings={headings}
            importDoc={importDoc}
            dark={dark}
            setDark={setDark}
            setAppearance={setAppearance}
            setSettings={setSettings}
            setFocus={setFocus}
          />
        </LibraryDrawer>
        <EditorPane
          onMedia={() => capture.open("media")}
          onCapture={() => capture.open("inbox")}
          find={quick.find}
          onCloseFind={() => quick.setFind(false)}
          onOpenCommands={() => quick.setPalette(true)}
          compact={workspace.compact}
          libraryHint={workspace.libraryHint}
          dismissLibraryHint={workspace.dismissLibraryHint}
          setLeft={setLeft}
          left={left}
          current={current}
          setDocs={setDocs}
          active={active}
          setGitWorkspace={setGitWorkspace}
          setHistory={setHistory}
          setNotice={setNotice}
          exportDoc={exportDoc}
          setRight={setRight}
          right={right}
          editor={editor}
          showSource={showSource}
          protectedSource={protectedSource}
          setSource={setSource}
          source={source}
          typography={typography}
          setTypography={setTypography}
          setAppearance={setAppearance}
          polishSelection={() => {
            setAgentMode("quick");
            polishSelection();
          }}
          busy={busy || writingAgent.busy}
          paragraphFocus={paragraphFocus}
          typewriter={typewriter}
          setParagraphFocus={setParagraphFocus}
          setTypewriter={setTypewriter}
          library={library}
          paperScroll={paperScroll}
          saveState={saveState}
          words={words}
          focus={focus}
          setFocus={setFocus}
          dark={dark}
          setDark={setDark}
          setSettings={setSettings}
        />
        <CompanionPanel
          modelSelector={
            <ModelSwitcher
              store={modelStore}
              disabled={busy || writingAgent.busy}
              onSettings={() => setSettings(true)}
            />
          }
          mode={agentMode}
          onMode={setAgentMode}
          taskBusy={writingAgent.busy}
          agentView={
            <Suspense fallback={<FeatureLoading />}>
              <AgentPanel
                agent={writingAgent}
                docs={docs}
                current={current}
                modelSelector={
                  <ModelSwitcher
                    store={modelStore}
                    disabled={busy || writingAgent.busy}
                    onSettings={() => setSettings(true)}
                  />
                }
                onSettings={() => setSettings(true)}
                otherBusy={busy}
              />
            </Suspense>
          }
          right={right}
          focus={focus}
          tab={tab}
          setTab={setTab}
          setRight={setRight}
          busy={busy}
          answer={answer}
          runAi={runAi}
          setPrompt={setPrompt}
          setWriteMode={setWriteMode}
          resultSelection={resultSelection}
          contextEnabled={contextEnabled}
          setContextEnabled={setContextEnabled}
          current={current}
          canCancel={canCancel}
          cancelAi={cancelAi}
          resultStatus={resultStatus}
          resultMode={resultMode}
          resultDoc={resultDoc}
          setReview={setReview}
          saveAnswer={saveAnswer}
          setAnswer={setAnswer}
          writeMode={writeMode}
          prompt={prompt}
          studioView={<StudioPanel {...workspace} />}
        />
      </div>
      {quick.palette && (
        <Suspense fallback={<FeatureLoading />}>
          <CommandPalette
            docs={docs}
            active={current.id}
            actions={quick.actions}
            onSelect={(doc) => {
              selectDoc(doc);
              if (workspace.compact) setLeft(false);
            }}
            onClose={() => quick.setPalette(false)}
          />
        </Suspense>
      )}
      <CaptureDialogs capture={capture} />
      <WorkspaceDialogs
        notice={notice}
        setNotice={setNotice}
        settings={settings}
        modelStore={modelStore}
        setSettings={setSettings}
        setAppearance={setAppearance}
        history={history}
        current={current}
        library={library}
        restoreVersion={restoreVersion}
        setHistory={setHistory}
        gitWorkspace={gitWorkspace}
        setGitWorkspace={setGitWorkspace}
        review={review}
        resultSelection={resultSelection}
        resultBase={resultBase}
        proposed={proposed}
        applying={applying}
        applyResult={applyResult}
        setReview={setReview}
      />
      <AppearancePanel
        appearance={appearance}
        typography={typography}
        setTypography={setTypography}
        dark={dark}
        setDark={setDark}
        setAppearance={setAppearance}
        setSettings={setSettings}
        library={library}
      />
      {((!library.ready && !library.error) || library.closing) && (
        <div className="boot-overlay">
          <BrandIcon size={54} />
          <p>
            {library.closing ? t("正在保存你的文字…") : t("正在整理你的书房…")}
          </p>
          <LoaderCircle className="spin" size={18} />
        </div>
      )}
    </div>
  );
}
