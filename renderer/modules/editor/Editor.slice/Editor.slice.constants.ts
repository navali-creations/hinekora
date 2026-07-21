import type {
  EditorClipboardState,
  EditorExportState,
} from "./Editor.slice.types";

const clipboardStatusResetMs = 1_800;
const editorHistoryLimit = 50;
const editorAssetRailPageSize = 5;
const editorMaxZoom = 4;
const editorMinZoom = 1;
const editorProjectPageSize = 5;
const editorVisibleHistoryPageSize = 10;
const editorZoomStep = 0.25;
const minimumExportDurationMs = 900;
const initialExportState: EditorExportState = {
  canCancel: false,
  dismissedNoticeIds: [],
  error: null,
  fileName: null,
  isCancelConfirmationOpen: false,
  isCancellationPending: false,
  isViewOpen: false,
  previewClips: [],
  progress: 0,
  projectId: null,
  requestId: null,
  result: null,
  startedAt: null,
  status: "idle",
};
const initialClipboardState: EditorClipboardState = {
  error: null,
  requestId: null,
  status: "idle",
};

export {
  clipboardStatusResetMs,
  editorAssetRailPageSize,
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
