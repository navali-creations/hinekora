import type {
  EditorCreateProjectInput,
  EditorExportFileActionResult,
  EditorExportInput,
  EditorExportResolution,
  EditorExportResult,
  EditorMediaReference,
  EditorProject,
  EditorWorkspace,
} from "~/main/modules/editor";

import type {
  EditorTimelineGap,
  TimelineTrimEdge,
} from "../Editor.utils/Editor.utils";

type EditorExportStatus = "idle" | "exporting" | "ready" | "failed";

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
  recordHistory?: boolean;
  resetHistory?: boolean;
  resetViewState?: boolean;
  syncProjectList?: boolean;
}

interface EditorSlice {
  editor: {
    error: string | null;
    exportState: EditorExportState;
    historyFuture: EditorProject[];
    historyFutureLabels: string[];
    historyPast: EditorProject[];
    historyPastLabels: string[];
    historyTransactionLabel: string | null;
    historyTransactionProject: EditorProject | null;
    hoveredTimelineGap: EditorTimelineGap | null;
    isLoading: boolean;
    isPreviewPlaying: boolean;
    playbackSeconds: number;
    project: EditorProject | null;
    projectLimit: number;
    selectedAssetKey: string | null;
    selectedClipId: string | null;
    workspace: EditorWorkspace | null;
    zoom: number;
    addAssetToTimelineAt: (assetKey: string, timelineSeconds: number) => void;
    beginHistoryTransaction: (label?: string) => void;
    commitHistoryTransaction: () => void;
    copyExport: (exportId: string) => Promise<EditorExportFileActionResult>;
    copyProjectToClipboard: () => Promise<EditorExportFileActionResult>;
    createProject: (input?: EditorCreateProjectInput) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    exportProject: (input: {
      fileName: string;
      mode: EditorExportInput["mode"];
      resolution: EditorExportResolution;
    }) => Promise<void>;
    hydrate: (source?: EditorMediaReference | null) => Promise<void>;
    keepEditingAfterExport: () => void;
    loadMoreProjects: () => Promise<void>;
    moveTimelineClip: (
      clipId: string,
      timelineSeconds: number,
      cursorSeconds?: number,
    ) => void;
    redoProjectChange: () => void;
    openProject: (projectId: string) => Promise<void>;
    refreshMedia: () => Promise<void>;
    removeTimelineClip: (clipId: string) => void;
    removeTimelineGap: (gap: {
      endSeconds: number;
      startSeconds: number;
    }) => void;
    revealExport: (exportId: string) => Promise<void>;
    selectAsset: (assetKey: string | null) => void;
    selectTimelineClip: (clipId: string | null) => void;
    setHoveredTimelineGap: (gap: EditorTimelineGap | null) => void;
    setPlaybackSeconds: (seconds: number) => void;
    setPreviewPlaying: (isPlaying: boolean) => void;
    setZoom: (zoom: number) => void;
    saveProject: (project: EditorProject) => Promise<EditorProject>;
    splitTimelineClipAt: (timelineSeconds: number) => void;
    trimTimelineClipEdge: (
      clipId: string,
      edge: TimelineTrimEdge,
      timelineSeconds: number,
    ) => void;
    undoProjectChange: () => void;
  };
}

export type {
  EditorExportState,
  EditorExportStatus,
  EditorSlice,
  SetProjectOptions,
};
