import type { GameId } from "~/types";

export interface StorageBreakdownItem {
  category:
    | "death-clips"
    | "manual-replays"
    | "full-recordings"
    | "app-installation"
    | "rewind-buffer"
    | "temporary-files"
    | "database";
  estimated?: boolean;
  fileCount: number;
  label: string;
  sizeBytes: number;
}

export interface StorageInfo {
  storagePath: string;
  mediaSizeBytes: number;
  appInstallationSizeBytes: number;
  temporarySizeBytes: number;
  rewindBufferEstimateBytes: number;
  databaseSizeBytes: number;
  totalTrackedSizeBytes: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  appInstallationDiskTotalBytes: number;
  appInstallationDiskFreeBytes: number;
  databaseDiskTotalBytes: number;
  databaseDiskFreeBytes: number;
  breakdown: StorageBreakdownItem[];
  calculatedAt: string;
}

export interface StorageGameLeagueUsage {
  id: string;
  game: GameId;
  leagueName: string;
  clipCount: number;
  recordingCount: number;
  estimatedSizeBytes: number;
  hasActiveRecording: boolean;
}

export interface StorageGameLeagueInput {
  game: GameId;
  leagueName: string;
}

export interface DeleteGameLeagueDataResult {
  success: boolean;
  cleanupError?: string | null;
  freedBytes: number;
  failedFileCount?: number;
  deletedClipCount: number;
  deletedRecordingCount: number;
  error?: string;
}

export interface StorageRevealPathsResult {
  storagePath: string;
  databasePath: string;
}
