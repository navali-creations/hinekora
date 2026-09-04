import type { QuickClipTrimRange } from "~/types";

enum WindowName {
  Main = "main",
  RecorderOverlay = "recorder-overlay",
  ReplayStatusOverlay = "replay-status-overlay",
  ClipPreviewOverlay = "clip-preview-overlay",
  AuraOverlay = "aura-overlay",
  CropSelectorOverlay = "crop-selector-overlay",
}

type MainWindowOpenEditorClipOptions =
  | {
      title?: string | null;
      trim: QuickClipTrimRange;
    }
  | {
      title?: null;
      trim?: null;
    };

export type { MainWindowOpenEditorClipOptions };
export { WindowName };
