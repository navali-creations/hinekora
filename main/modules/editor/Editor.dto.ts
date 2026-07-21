import type {
  EditorMediaAssetCategory,
  EditorTimelinePlaybackRate,
  GameId,
} from "~/types";

export type { EditorMediaAssetCategory } from "~/types";

export type EditorMediaKind = "clip" | "recording";
export type EditorAssetStatus = "ready" | "missing" | "processing" | "failed";
export type EditorTrackKind = "video";
export type EditorExportMode = "overwrite" | "new-file";
export type EditorExportResolution = "720p" | "1080p";

export interface EditorMediaReference {
  id: string;
  kind: EditorMediaKind;
}

export interface EditorWorkspaceQuery {
  projectLimit?: number;
  projectId?: string | null;
  source?: EditorMediaReference | null;
}

export interface EditorMediaAssetPageQuery {
  category: EditorMediaAssetCategory;
  createdAfter?: string;
  excludeAssetKeys?: string[];
  game: GameId;
  includeAssetKeys?: string[];
  league?: string;
  pageIndex?: number;
  pageSize?: number;
}

export interface EditorCreateProjectInput extends EditorWorkspaceQuery {
  assetKeys?: string[];
  title?: string;
}

export interface EditorMediaAsset {
  assetKey: string;
  category: EditorMediaAssetCategory;
  createdAt: string;
  durationSeconds: number | null;
  exists: boolean;
  id: string;
  kind: EditorMediaKind;
  mediaUrl: string | null;
  name: string;
  sizeBytes: number;
  sourceGame: GameId;
  sourceLeague: string;
  status: EditorAssetStatus;
  subtitle: string;
}

export interface EditorTimelineClip {
  assetKey: string;
  color: "primary" | "secondary" | "accent";
  durationSeconds: number;
  id: string;
  inSeconds: number;
  mediaUrl: string | null;
  name: string;
  outSeconds: number;
  playbackRate: EditorTimelinePlaybackRate;
  sourceInSeconds?: number;
  sourceOutSeconds?: number;
  startSeconds: number;
  trackId: string;
}

export interface EditorTimelineTrack {
  clips: EditorTimelineClip[];
  id: string;
  kind: EditorTrackKind;
  label: string;
}

export interface EditorProjectHistoryMetadata {
  editCount: number;
  labels: string[];
  subtitles?: Array<string | null>;
  snapshots?: EditorProjectHistorySnapshot[];
}

export interface EditorProjectHistorySnapshot {
  activeClipId: string | null;
  assets: EditorMediaAsset[];
  createdAt: string;
  durationSeconds: number;
  id: string;
  isAudioMuted?: boolean;
  selectedAssetKey: string | null;
  sourceGame?: GameId | null;
  sourceLeague?: string | null;
  title: string;
  tracks: EditorTimelineTrack[];
  updatedAt: string;
}

export interface EditorProject {
  activeClipId: string | null;
  assets: EditorMediaAsset[];
  createdAt: string;
  durationSeconds: number;
  history?: EditorProjectHistoryMetadata;
  id: string;
  isAudioMuted?: boolean;
  selectedAssetKey: string | null;
  sourceGame?: GameId | null;
  sourceLeague?: string | null;
  title: string;
  tracks: EditorTimelineTrack[];
  updatedAt: string;
}

export interface EditorProjectSummary {
  clipCount: number;
  createdAt: string;
  durationSeconds: number;
  id: string;
  title: string;
  updatedAt: string;
}

export interface EditorWorkspace {
  assets: EditorMediaAsset[];
  hasMoreProjects: boolean;
  project: EditorProject;
  projects: EditorProjectSummary[];
}

export interface EditorMediaAssetPage {
  items: EditorMediaAsset[];
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}

export interface EditorSaveProjectInput {
  project: EditorProject;
}

export interface EditorExportClipInput {
  durationSeconds: number;
  inSeconds: number;
  outSeconds: number;
  playbackRate: EditorTimelinePlaybackRate;
  source: EditorMediaReference;
  startSeconds: number;
}

export interface EditorExportInput {
  exportRequestId: string;
  fileName: string;
  mode: EditorExportMode;
  project: EditorProject;
  resolution: EditorExportResolution;
}

export interface EditorCancelExportInput {
  exportRequestId: string;
}

export interface EditorCancelExportResult {
  cancelled: boolean;
}

export interface EditorCopyToClipboardInput {
  fileName: string;
  project: EditorProjectHistorySnapshot;
  resolution: EditorExportResolution;
}

export interface EditorExportResult {
  createdAt: string;
  durationSeconds: number;
  exportId: string;
  fileName: string;
  mediaUrl: string | null;
  mode: EditorExportMode;
  resolution: EditorExportResolution;
  sizeBytes: number;
}

export interface EditorExportProgress {
  exportRequestId: string;
  progress: number;
}

export type EditorExportLifecycleStatus =
  | "failed"
  | "exporting"
  | "idle"
  | "ready";

export interface EditorExportPreviewClip {
  durationSeconds: number;
  id: string;
  inSeconds: number;
  mediaUrl: string;
  name: string;
  outSeconds: number;
  playbackRate: EditorTimelinePlaybackRate;
  startSeconds: number;
}

export interface EditorExportLifecycle {
  canCancel: boolean;
  error: string | null;
  exportRequestId: string | null;
  fileName: string | null;
  previewClips: EditorExportPreviewClip[];
  progress: number;
  projectId: string | null;
  result: EditorExportResult | null;
  startedAt: string | null;
  status: EditorExportLifecycleStatus;
}

export interface EditorExportLifecycleUpdate
  extends Omit<EditorExportLifecycle, "previewClips"> {
  previewClips?: EditorExportPreviewClip[];
}

export interface EditorExportFileActionResult {
  error: string | null;
  ok: boolean;
}
