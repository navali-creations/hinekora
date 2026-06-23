import type {
  EditorClipboardState,
  EditorExportState,
} from "./Editor.slice.types";

const clipboardStatusResetMs = 1_800;
const editorHistoryLimit = 100;
const editorMaxZoom = 4;
const editorMinZoom = 0.5;
const editorProjectPageSize = 5;
const editorVisibleHistoryPageSize = 10;
const editorZoomStep = 0.25;
const minimumExportDurationMs = 900;
const initialExportState: EditorExportState = {
  error: null,
  fileName: null,
  progress: 0,
  requestId: null,
  result: null,
  status: "idle",
};
const initialClipboardState: EditorClipboardState = {
  error: null,
  requestId: null,
  status: "idle",
};

export {
  clipboardStatusResetMs,
  editorHistoryLimit,
  editorMaxZoom,
  editorMinZoom,
  editorProjectPageSize,
  editorVisibleHistoryPageSize,
  editorZoomStep,
  initialClipboardState,
  initialExportState,
  minimumExportDurationMs,
};
