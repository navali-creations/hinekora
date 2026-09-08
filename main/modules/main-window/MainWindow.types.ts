import type { QuickClipTrimRange } from "~/types";

enum WindowName {
  Main = "main",
  RecorderOverlay = "recorder-overlay",
  ReplayStatusOverlay = "replay-status-overlay",
  ClipPreviewOverlay = "clip-preview-overlay",
  AuraOverlay = "aura-overlay",
  CropSelectorOverlay = "crop-selector-overlay",
}

const WINDOW_ROLE_ARGUMENT_PREFIX = "--hinekora-window-role=";

function createWindowRoleArgument(windowName: WindowName): string {
  return `${WINDOW_ROLE_ARGUMENT_PREFIX}${windowName}`;
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
export { createWindowRoleArgument, WINDOW_ROLE_ARGUMENT_PREFIX, WindowName };
