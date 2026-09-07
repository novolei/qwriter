import { useRef, useState, type ComponentProps } from "react";
import { MemoryLibrary } from "../../features/knowledge/MemoryLibrary";
import { FeatureBoundary } from "../../shared/ui/FeatureBoundary";
import { LibraryDrawer } from "../components/LibraryDrawer";
import { NavigationRail } from "../components/NavigationRail";
import type { Workspace } from "../useWorkspace";
import { LibrarySidebar } from "./LibrarySidebar";

type Props = ComponentProps<typeof LibrarySidebar> &
  Pick<Workspace, "compact" | "setLeft" | "current" | "dismissLibraryHint"> & {
    onSearch: () => void;
    onQuickNote: () => void;
    onGit: () => void;
  };

export function NavigationPanel(props: Props) {
  const [knowledge, setKnowledge] = useState(false);
  const focusSearch = useRef(false);
  const open = props.left && !props.focus;
  function openLibrary() {
    props.dismissLibraryHint();
    focusSearch.current = true;
    props.setLeft(true);
  }
  return (
    <>
      {!props.focus && (props.compact || !props.left) && (
        <NavigationRail
          libraryOpen={open}
          dark={props.dark}
          focus={props.focus}
          onLibrary={openLibrary}
          onSearch={props.onSearch}
          onQuickNote={props.onQuickNote}
          onKnowledge={() => setKnowledge(true)}
          onGit={props.onGit}
          onTheme={() => props.setDark(!props.dark)}
          onFocus={() => props.setFocus(!props.focus)}
          onAppearance={() => props.setAppearance(true)}
          onSettings={() => props.setSettings(true)}
        />
      )}
      <LibraryDrawer
        compact={props.compact}
        open={open}
        onClose={() => props.setLeft(false)}
      >
        <LibrarySidebar
          left={props.left}
          focus={props.focus}
          search={props.search}
          setSearch={props.setSearch}
          searchRef={(input) => {
            if (input && focusSearch.current) {
              if (!props.compact) input.focus();
              focusSearch.current = false;
            }
          }}
          newDoc={() => {
            props.newDoc();
            if (props.compact) props.setLeft(false);
          }}
          docs={props.docs}
          active={props.active}
          selectDoc={(doc) => {
            props.selectDoc(doc);
            if (props.compact) props.setLeft(false);
          }}
          headings={props.headings}
          importDoc={props.importDoc}
          captureEntry={props.captureEntry}
          dark={props.dark}
          setDark={props.setDark}
          setAppearance={props.setAppearance}
          setSettings={props.setSettings}
          setFocus={props.setFocus}
        />
      </LibraryDrawer>
      {knowledge && (
        <FeatureBoundary
          resetKey={props.current.id}
          onClose={() => setKnowledge(false)}
        >
          <MemoryLibrary
            current={props.current}
            onClose={() => setKnowledge(false)}
          />
        </FeatureBoundary>
      )}
    </>
  );
}
