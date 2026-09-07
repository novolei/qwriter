export type SourceHistory = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};
