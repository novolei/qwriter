import type { Asset } from "../../../shared/media/assets";

export interface ImageEditHistory {
  versions: Asset[];
  cursor: number;
}
export type ImageEditAction =
  { type: "edit"; asset: Asset } | { type: "undo" | "redo" | "restore" };

export const emptyImageHistory: ImageEditHistory = { versions: [], cursor: -1 };

/** Store immutable asset references. Restoring the original retains redo history. */
export function imageEditHistory(
  state: ImageEditHistory,
  action: ImageEditAction,
): ImageEditHistory {
  switch (action.type) {
    case "edit": {
      if (state.versions[state.cursor]?.id === action.asset.id) return state;
      const versions = [
        ...state.versions.slice(0, state.cursor + 1),
        action.asset,
      ];
      return { versions, cursor: versions.length - 1 };
    }
    case "undo":
      return { ...state, cursor: Math.max(-1, state.cursor - 1) };
    case "redo":
      return {
        ...state,
        cursor: Math.min(state.versions.length - 1, state.cursor + 1),
      };
    case "restore":
      return { ...state, cursor: -1 };
  }
}
