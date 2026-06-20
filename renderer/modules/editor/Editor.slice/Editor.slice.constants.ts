import type { EditorExportState } from "./Editor.slice.types";

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

export {
  editorHistoryLimit,
  editorMaxZoom,
  editorMinZoom,
  editorProjectPageSize,
  editorVisibleHistoryPageSize,
  editorZoomStep,
  initialExportState,
  minimumExportDurationMs,
};
