import { z } from "zod";

import type { GameId } from "~/types";

const RecordingStorageUsageSchema = z.object({
  clipsSizeBytes: z.number().finite().nonnegative(),
  diskFreeBytes: z.number().finite().nonnegative().nullable(),
  lowDiskSpace: z.boolean(),
  recordingsSizeBytes: z.number().finite().nonnegative(),
});
const RecordingStorageChangedIdsSchema = z
  .array(z.string().min(1).max(2_048))
  .max(100);
export type RecordingStorageUsage = z.infer<typeof RecordingStorageUsageSchema>;

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

export { RecordingStorageChangedIdsSchema, RecordingStorageUsageSchema };

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
