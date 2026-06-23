import type { GameId } from "~/types";

export interface RecordingStorageUsage {
  storageDirectory: string;
  databasePath: string;
  clipsSizeBytes: number;
  recordingsSizeBytes: number;
  databaseSizeBytes: number;
  totalTrackedSizeBytes: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  diskWarningThresholdBytes: number;
  lowDiskSpace: boolean;
  calculatedAt: string;
}

export interface RunRecordingMetadata {
  id: string;
  path: string;
  sourceGame: GameId;
  sourceLeague: string;
  startedAt: string;
  stoppedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunRecordingItem extends RunRecordingMetadata {
  fileName: string;
  durationSeconds: number | null;
  sizeBytes: number;
  exists: boolean;
}

export interface RunRecordingDetail {
  mediaUrl: string | null;
  recording: RunRecordingItem;
}

export type RunRecordingLibrarySortKey =
  | "createdAt"
  | "durationSeconds"
  | "fileName"
  | "sizeBytes"
  | "sourceLeague";

export type RunRecordingLibrarySortDirection = "asc" | "desc";

export interface RunRecordingLibraryQuery {
  game?: GameId;
  league?: string;
  pageIndex?: number;
  pageSize?: number;
  sortBy?: RunRecordingLibrarySortKey;
  sortDirection?: RunRecordingLibrarySortDirection;
}

export interface RunRecordingLibraryPage {
  items: RunRecordingItem[];
  availableLeagues: string[];
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
  sortBy: RunRecordingLibrarySortKey;
  sortDirection: RunRecordingLibrarySortDirection;
}

export interface RunRecordingCreateInput {
  id?: string;
  path: string;
  startedAt: string;
  stoppedAt: string;
  sourceGame: GameId;
  sourceLeague: string;
  createdAt?: string;
  durationSeconds?: number | null;
  exists?: boolean;
  mtimeMs?: number;
  sizeBytes?: number;
}

export interface RecordingStorageFileActionResult {
  ok: boolean;
  cleanupError?: string | null;
  error: string | null;
}

export interface RecordingStorageBatchFileActionResult {
  ok: boolean;
  cleanupErrors?: Array<{ path: string; error: string }>;
  error: string | null;
  deletedPaths: string[];
  failed: Array<{ path: string; error: string }>;
}
