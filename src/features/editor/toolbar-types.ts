import { type Editor } from "@tiptap/react";
import type { Typography } from "../settings/typography";
import type { SourceHistory } from "./source-history";

export type ToolbarProps = {
  onMedia?: () => void;
  editor: Editor | null;
  source: boolean;
  sourceHistory?: SourceHistory | null;
  onSource: () => void;
  typography: Typography;
  onTypography: (value: Typography) => void;
  onAppearance: () => void;
  onSelectionAi: () => void;
  aiBusy: boolean;
  paragraphFocus: boolean;
  typewriter: boolean;
  onParagraphFocus: () => void;
  onTypewriter: () => void;
};
