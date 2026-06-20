import {
  editorProjectPageSize,
  initialExportState,
} from "./Editor.slice.constants";
import type { EditorSlice } from "./Editor.slice.types";

type EditorStateFields = Omit<
  EditorSlice["editor"],
  | "addAssetToTimelineAt"
  | "beginHistoryTransaction"
  | "commitHistoryTransaction"
  | "copyExport"
  | "copyProjectToClipboard"
  | "createProject"
  | "deleteProject"
  | "exportProject"
  | "hydrate"
  | "keepEditingAfterExport"
  | "loadMoreProjects"
  | "moveTimelineClip"
  | "openProject"
  | "redoProjectChange"
  | "refreshMedia"
  | "removeTimelineClip"
  | "removeTimelineGap"
  | "revealExport"
  | "saveProject"
  | "selectAsset"
  | "selectTimelineClip"
  | "setHoveredTimelineGap"
  | "setPlaybackSeconds"
  | "setPreviewPlaying"
  | "setZoom"
  | "splitTimelineClipAt"
  | "trimTimelineClipEdge"
  | "undoProjectChange"
>;

function createEditorInitialState(): EditorStateFields {
  return {
    error: null,
    exportState: initialExportState,
    historyFuture: [],
    historyFutureLabels: [],
    historyPast: [],
    historyPastLabels: [],
    historyTransactionLabel: null,
    historyTransactionProject: null,
    hoveredTimelineGap: null,
    isLoading: false,
    isPreviewPlaying: false,
    playbackSeconds: 0,
    project: null,
    projectLimit: editorProjectPageSize,
    selectedAssetKey: null,
    selectedClipId: null,
    workspace: null,
    zoom: 1,
  };
}

export { createEditorInitialState };
