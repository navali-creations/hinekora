import type {
  EditorCreateProjectInput,
  EditorExportFileActionResult,
  EditorExportInput,
  EditorExportResolution,
  EditorExportResult,
  EditorMediaAssetCategory,
  EditorMediaAssetPage,
  EditorMediaAssetPageQuery,
  EditorMediaReference,
  EditorProject,
  EditorWorkspace,
} from "~/main/modules/editor";

import type {
  EditorTimelineGap,
  TimelineTrimEdge,
} from "../Editor.utils/Editor.utils";

type EditorExportStatus = "idle" | "exporting" | "ready" | "failed";
type EditorClipboardStatus = "copied" | "copying" | "failed" | "idle";
type EditorMediaFilter = EditorMediaAssetCategory | "saved-edits";
type EditorMediaRailTab = "all" | "in-timeline" | "recently-clipped";

interface EditorClipboardState {
  error: string | null;
  requestId: string | null;
  status: EditorClipboardStatus;
}

interface EditorExportState {
  error: string | null;
  fileName: string | null;
  progress: number;
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
    workspace: EditorWorkspace | null;
    zoom: number;
    addAssetToTimelineAt: (assetKey: string, timelineSeconds: number) => void;
    beginHistoryTransaction: (label?: string, subtitle?: string | null) => void;
    commitHistoryTransaction: () => void;
    copyExport: (exportId: string) => Promise<EditorExportFileActionResult>;
    copyProjectToClipboard: () => Promise<EditorExportFileActionResult>;
    createProject: (input?: EditorCreateProjectInput) => Promise<void>;
    deleteAllProjects: () => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    exportProject: (input: {
      fileName: string;
      mode: EditorExportInput["mode"];
      resolution: EditorExportResolution;
    }) => Promise<void>;
    fitTimelineToEdit: () => void;
    hydrate: (source?: EditorMediaReference | null) => Promise<boolean>;
    hydrateMediaAssets: (query: EditorMediaAssetPageQuery) => Promise<void>;
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
    refreshMedia: () => Promise<void>;
    refreshMediaRecentlyClippedSince: () => string;
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
    setTimelineGapsHighlighted: (isHighlighted: boolean) => void;
    setHoveredTimelineGap: (gap: EditorTimelineGap | null) => void;
    setPlaybackSeconds: (seconds: number) => void;
    setPreviewHasAudio: (hasAudio: boolean | null) => void;
    setPreviewPlaying: (isPlaying: boolean) => void;
    setPreviewVolume: (volume: number) => void;
    setZoom: (zoom: number) => void;
    saveProject: (project: EditorProject) => Promise<EditorProject>;
    splitTimelineClipAt: (timelineSeconds: number) => void;
    toggleProjectAudioMuted: () => void;
    trimTimelineClipEdge: (
      clipId: string,
      edge: TimelineTrimEdge,
      timelineSeconds: number,
    ) => void;
    undoProjectChange: () => void;
  };
}

export type {
  EditorClipboardState,
  EditorClipboardStatus,
  EditorExportState,
  EditorExportStatus,
  EditorMediaFilter,
  EditorMediaRailTab,
  EditorSlice,
  SetProjectOptions,
};
