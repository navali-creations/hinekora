import type { GameId, ReplayClip, ReplayClipKind } from "~/types";
import type { ManagedReplayKind } from "../managed-recorder/ManagedRecorder.dto";

export interface DeathEvent {
  kind?: ManagedReplayKind;
  game: GameId;
  line: string;
  lineHash: string;
  detectedAt: string;
}

export interface ReplayClipFileActionResult {
  ok: boolean;
  cleanupError?: string | null;
  error: string | null;
}

export interface ReplayClipDetail {
  clip: ReplayClip;
  mediaUrl: string | null;
}

export interface ReplayClipListFilter {
  game?: GameId;
  kind?: ReplayClipKind;
  league?: string;
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
  items: ReplayClip[];
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
