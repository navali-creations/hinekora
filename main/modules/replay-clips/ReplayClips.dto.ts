import { z } from "zod";

import type {
  GameId,
  QuickClipTrimRange,
  ReplayClip,
  ReplayClipKind,
} from "~/types";
import type { ManagedReplayKind } from "../managed-recorder/ManagedRecorder.dto";

export interface DeathEvent {
  game: GameId;
  line: string;
  lineHash: string;
  detectedAt: string;
}

export interface ReplayTriggerEvent extends DeathEvent {
  kind: ManagedReplayKind;
}

export interface ReplayClipFileActionResult {
  ok: boolean;
  cleanupError?: string | null;
  error: string | null;
}

export type ReplayClipView = Omit<
  ReplayClip,
  "originalObsPath" | "processedClipPath"
> & {
  fileName: string | null;
  hasMediaFile: boolean;
};

export interface ReplayClipDetail {
  clip: ReplayClipView;
  durationSeconds: number | null;
  mediaUrl: string | null;
  previewMediaUrl?: string | null;
}

export interface ReplayClipSourceDetail {
  clip: ReplayClip;
  durationSeconds: number | null;
  mediaUrl: string | null;
}

export interface ReplayClipListFilter {
  game?: GameId;
  kind?: ReplayClipKind;
  league?: string;
}

export type ReplayClipTrimInput = QuickClipTrimRange;

export interface ReplayClipCopyInput {
  id: string;
  operationRequestId?: string | null;
  trim?: ReplayClipTrimInput | null;
  muteAudio?: boolean;
}

export interface ReplayClipUpdateInput {
  id: string;
  name?: string | null;
  operationRequestId?: string | null;
  trim?: ReplayClipTrimInput | null;
  muteAudio?: boolean;
}

export interface ReplayClipOperationProgress {
  operationRequestId: string;
  progress: number;
}

export interface ReplayClipPreviewProgress {
  clipId: string;
  progress: number;
}

const ReplayClipDeletedIdsSchema = z
  .array(z.string().min(1).max(128))
  .max(1_000);

export interface ReplayClipUpdateResult {
  detail: ReplayClipDetail | null;
  error: string | null;
  ok: boolean;
}

export type ReplayClipLibrarySortKey =
  | "createdAt"
  | "name"
  | "sourceLeague"
  | "targetDurationSeconds"
  | "sizeBytes";

export type ReplayClipLibrarySortDirection = "asc" | "desc";

export interface ReplayClipLibraryQuery extends ReplayClipListFilter {
  pageIndex?: number;
  pageSize?: number;
  sortBy?: ReplayClipLibrarySortKey;
  sortDirection?: ReplayClipLibrarySortDirection;
}

export interface ReplayClipLibraryPage {
  items: ReplayClipView[];
  availableLeagues: string[];
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
  sortBy: ReplayClipLibrarySortKey;
  sortDirection: ReplayClipLibrarySortDirection;
}

export interface ReplayClipBatchFileActionResult {
  ok: boolean;
  cleanupErrors?: Array<{ id: string; error: string }>;
  error: string | null;
  deletedIds: string[];
  failed: Array<{ id: string; error: string }>;
}

export type { ReplayClip };
export { ReplayClipDeletedIdsSchema };
