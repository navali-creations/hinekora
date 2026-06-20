import type { GameId } from "~/types";

export type EditorMediaKind = "clip" | "recording";
export type EditorMediaAssetCategory =
  | "death-clip"
  | "manual-replay"
  | "recording";
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

export interface EditorProject {
  activeClipId: string | null;
  assets: EditorMediaAsset[];
  createdAt: string;
  durationSeconds: number;
  id: string;
  selectedAssetKey: string | null;
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

export interface EditorSaveProjectInput {
  project: EditorProject;
}

export interface EditorExportClipInput {
  durationSeconds: number;
  inSeconds: number;
  outSeconds: number;
  source: EditorMediaReference;
  startSeconds: number;
}

export interface EditorExportInput {
  clips: EditorExportClipInput[];
  durationSeconds: number;
  exportRequestId: string;
  fileName: string;
  mode: EditorExportMode;
  overwriteSource: EditorMediaReference | null;
  resolution: EditorExportResolution;
}

export interface EditorCopyToClipboardInput {
  clips: EditorExportClipInput[];
  durationSeconds: number;
  fileName: string;
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

export interface EditorExportFileActionResult {
  error: string | null;
  ok: boolean;
}
