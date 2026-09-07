import { useEffect, useState } from "react";
import { readLocal } from "../shared/storage";

export function usePanelLayout() {
  const [left, setLeft] = useState(true);
  const [compact, setCompact] = useState(false);
  const [libraryHint, setLibraryHint] = useState(false);
  function dismissLibraryHint() {
    setLibraryHint(false);
    try {
      localStorage.setItem("qwriter.library-hint-seen", "true");
    } catch {
      /* The hint remains dismissed for this session. */
    }
  }
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setCompact(media.matches);
      setLibraryHint(
        media.matches && !readLocal("qwriter.library-hint-seen", false),
      );
      if (media.matches) setLeft(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return { left, setLeft, compact, libraryHint, dismissLibraryHint };
}
