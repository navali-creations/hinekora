import type {
  EditorCreateProjectInput,
  EditorExportFileActionResult,
  EditorExportInput,
  EditorExportResolution,
  EditorExportResult,
  EditorMediaAssetPage,
  EditorMediaAssetPageQuery,
  EditorMediaReference,
  EditorProject,
  EditorWorkspace,
} from "~/main/modules/editor";

import type {
  EditorMediaFilter,
  EditorTimelinePlaybackRate,
  QuickClipTrimRange,
} from "~/types";
import type {
  EditorTimelineGap,
  TimelineTrimEdge,
} from "../Editor.utils/Editor.utils";

type EditorExportStatus = "idle" | "exporting" | "ready" | "failed";
type EditorExportNoticeId =
  | "cancel-without-leftovers"
  | "keep-editing-safely"
  | "keep-using-hinekora";
type EditorClipboardStatus = "copied" | "copying" | "failed" | "idle";
type EditorMediaRailTab = "all" | "in-timeline" | "recently-clipped";
type EditorSidePanelKind = "bookmarks" | "history" | "shortcuts";

interface EditorClipboardState {
  error: string | null;
  requestId: string | null;
  status: EditorClipboardStatus;
}

interface EditorExportState {
  dismissedNoticeIds: EditorExportNoticeId[];
  error: string | null;
  fileName: string | null;
  isCancelConfirmationOpen: boolean;
  isCancellationPending: boolean;
  isViewOpen: boolean;
  progress: number;
  projectId: string | null;
  requestId: string | null;
  result: EditorExportResult | null;
  status: EditorExportStatus;
}

interface SetProjectOptions {
  historyLabel?: string;
  historySubtitle?: string | null;
  recordHistory?: boolean;
  resetHistory?: boolean;
  resetViewState?: boolean;
}

interface SaveProjectOptions {
  applyResponse?: boolean;
}

interface HydrateMediaAssetsOptions {
  force?: boolean;
}

interface EditorSingleClipTrimDraft extends QuickClipTrimRange {
  source: EditorMediaReference;
  title?: string | null;
}

interface EditorSlice {
  editor: {
    clipboardState: EditorClipboardState;
    error: string | null;
    exportState: EditorExportState;
    historyFuture: EditorProject[];
    historyFutureLabels: string[];
    historyFutureSubtitles: Array<string | null>;
    historyPast: EditorProject[];
    historyPastLabels: string[];
    historyPastSubtitles: Array<string | null>;
    historyTransactionLabel: string | null;
    historyTransactionSubtitle: string | null;
    historyTransactionProject: EditorProject | null;
    areTimelineGapsHighlighted: boolean;
    hoveredTimelineGap: EditorTimelineGap | null;
    isLoading: boolean;
    isPreviewPlaying: boolean;
    isTimelineFitToEdit: boolean;
    mediaFilter: EditorMediaFilter;
    mediaRailTab: EditorMediaRailTab;
    mediaAssetPage: EditorMediaAssetPage | null;
    mediaAssetPendingQuery: EditorMediaAssetPageQuery | null;
    mediaAssetQuery: EditorMediaAssetPageQuery | null;
    mediaPageIndex: number;
    mediaRecentlyClippedSince: string;
    playbackSeconds: number;
    previewHasAudio: boolean | null;
    previewVolume: number;
    project: EditorProject | null;
    projectLimit: number;
    selectedAssetKey: string | null;
    selectedClipId: string | null;
    savedEditPageIndex: number;
    visibleSidePanel: EditorSidePanelKind | null;
    workspace: EditorWorkspace | null;
    zoom: number;
    addAssetToTimelineAt: (assetKey: string, timelineSeconds: number) => void;
    applySingleClipTrimDraft: (draft: EditorSingleClipTrimDraft) => void;
    beginHistoryTransaction: (label?: string, subtitle?: string | null) => void;
    commitHistoryTransaction: () => void;
    copyExport: (exportId: string) => Promise<EditorExportFileActionResult>;
    copyProjectToClipboard: () => Promise<EditorExportFileActionResult>;
    closeSidePanel: () => void;
    closeExportCancellationConfirmation: () => void;
    cancelExport: () => Promise<void>;
    createProject: (input?: EditorCreateProjectInput) => Promise<void>;
    deleteAllProjects: () => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    dismissExportNotice: (noticeId: EditorExportNoticeId) => void;
    exportProject: (input: {
      fileName: string;
      mode: EditorExportInput["mode"];
      resolution: EditorExportResolution;
    }) => Promise<void>;
    fitTimelineToEdit: () => void;
    hydrate: (source?: EditorMediaReference | null) => Promise<boolean>;
    hydrateExportState: () => Promise<void>;
    hydrateMediaAssets: (
      query: EditorMediaAssetPageQuery,
      options?: HydrateMediaAssetsOptions,
    ) => Promise<void>;
    keepEditingAfterExport: () => void;
    loadMoreProjects: () => Promise<void>;
    removeAllTimelineGaps: () => void;
    moveTimelineClip: (
      clipId: string,
      timelineSeconds: number,
      cursorSeconds?: number,
    ) => void;
    redoProjectChange: () => void;
    openProject: (projectId: string) => Promise<boolean>;
    openExportCancellationConfirmation: () => void;
    refreshMedia: () => Promise<void>;
    refreshMediaRecentlyClippedSince: () => string;
    renameProject: (title: string) => void;
    removeTimelineClip: (clipId: string) => void;
    removeTimelineGap: (gap: {
      endSeconds: number;
      startSeconds: number;
    }) => void;
    revealExport: (exportId: string) => Promise<void>;
    resetMediaPagination: () => void;
    selectAsset: (assetKey: string | null) => void;
    selectTimelineClip: (clipId: string | null) => void;
    setMediaFilter: (filter: EditorMediaFilter) => void;
    setMediaPageIndex: (pageIndex: number) => void;
    setMediaRailTab: (tab: EditorMediaRailTab) => void;
    setSavedEditPageIndex: (pageIndex: number) => void;
    setSelectedTimelineClipPlaybackRate: (
      playbackRate: EditorTimelinePlaybackRate,
    ) => void;
    setTimelineGapsHighlighted: (isHighlighted: boolean) => void;
    setHoveredTimelineGap: (gap: EditorTimelineGap | null) => void;
    setPlaybackSeconds: (seconds: number) => void;
    setPreviewHasAudio: (hasAudio: boolean | null) => void;
    setPreviewPlaying: (isPlaying: boolean) => void;
    setPreviewVolume: (volume: number) => void;
    setZoom: (zoom: number) => void;
    saveProject: (
      project: EditorProject,
      options?: SaveProjectOptions,
    ) => Promise<EditorProject>;
    splitTimelineClipAt: (timelineSeconds: number) => void;
    startExportStateListening: () => () => void;
    toggleProjectAudioMuted: () => void;
    toggleSidePanel: (panel: EditorSidePanelKind) => void;
    trimTimelineClipEdge: (
      clipId: string,
      edge: TimelineTrimEdge,
      timelineSeconds: number,
    ) => void;
    undoProjectChange: () => void;
    viewExport: () => void;
  };
}

export type {
  EditorClipboardState,
  EditorClipboardStatus,
  EditorExportNoticeId,
  EditorExportState,
  EditorExportStatus,
  EditorMediaFilter,
  EditorMediaRailTab,
  EditorSidePanelKind,
  EditorSingleClipTrimDraft,
  EditorSlice,
  SaveProjectOptions,
  SetProjectOptions,
};
