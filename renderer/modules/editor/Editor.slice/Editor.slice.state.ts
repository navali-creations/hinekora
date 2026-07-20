import {
  editorProjectPageSize,
  initialClipboardState,
  initialExportState,
} from "./Editor.slice.constants";
import type { EditorSlice } from "./Editor.slice.types";
import { createEditorRecentlyClippedSince } from "./Editor.slice.utils";

type EditorStateFields = Omit<
  EditorSlice["editor"],
  | "addAssetToTimelineAt"
  | "applySingleClipTrimDraft"
  | "beginHistoryTransaction"
  | "commitHistoryTransaction"
  | "copyExport"
  | "copyProjectToClipboard"
  | "cancelExport"
  | "closeSidePanel"
  | "closeExportCancellationConfirmation"
  | "createProject"
  | "deleteAllProjects"
  | "deleteProject"
  | "dismissExportNotice"
  | "exportProject"
  | "fitTimelineToEdit"
  | "hydrate"
  | "hydrateExportState"
  | "hydrateMediaAssets"
  | "keepEditingAfterExport"
  | "loadMoreProjects"
  | "moveTimelineClip"
  | "openProject"
  | "openExportCancellationConfirmation"
  | "redoProjectChange"
  | "refreshMedia"
  | "refreshMediaRecentlyClippedSince"
  | "renameProject"
  | "removeAllTimelineGaps"
  | "removeTimelineClip"
  | "removeTimelineGap"
  | "revealExport"
  | "resetMediaPagination"
  | "saveProject"
  | "selectAsset"
  | "selectTimelineClip"
  | "setMediaFilter"
  | "setMediaPageIndex"
  | "setMediaRailTab"
  | "setSavedEditPageIndex"
  | "setSelectedTimelineClipPlaybackRate"
  | "setHoveredTimelineGap"
  | "setTimelineGapsHighlighted"
  | "setPlaybackSeconds"
  | "setPreviewHasAudio"
  | "setPreviewPlaying"
  | "setPreviewVolume"
  | "setZoom"
  | "splitTimelineClipAt"
  | "startExportStateListening"
  | "toggleProjectAudioMuted"
  | "toggleSidePanel"
  | "trimTimelineClipEdge"
  | "undoProjectChange"
  | "viewExport"
>;

function createEditorInitialState(): EditorStateFields {
  return {
    clipboardState: initialClipboardState,
    error: null,
    exportState: initialExportState,
    historyFuture: [],
    historyFutureLabels: [],
    historyFutureSubtitles: [],
    historyPast: [],
    historyPastLabels: [],
    historyPastSubtitles: [],
    historyTransactionLabel: null,
    historyTransactionSubtitle: null,
    historyTransactionProject: null,
    areTimelineGapsHighlighted: false,
    hoveredTimelineGap: null,
    isLoading: false,
    isPreviewPlaying: false,
    isTimelineFitToEdit: false,
    mediaFilter: "death-clip",
    mediaRailTab: "all",
    mediaAssetPage: null,
    mediaAssetPendingQuery: null,
    mediaAssetQuery: null,
    mediaPageIndex: 0,
    mediaRecentlyClippedSince: createEditorRecentlyClippedSince(),
    playbackSeconds: 0,
    previewHasAudio: null,
    previewVolume: 1,
    project: null,
    projectLimit: editorProjectPageSize,
    selectedAssetKey: null,
    selectedClipId: null,
    savedEditPageIndex: 0,
    visibleSidePanel: null,
    workspace: null,
    zoom: 1,
  };
}

export { createEditorInitialState };
