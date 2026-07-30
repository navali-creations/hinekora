import { z } from "zod";

import { type GameId, GameIdSchema } from "~/types";

export type StorageAnalysisAvailability = "deferred" | "ready";

const StorageAnalysisAvailabilitySchema: z.ZodType<StorageAnalysisAvailability> =
  z.enum(["deferred", "ready"]);

export interface StorageBreakdownItem {
  category:
    | "death-clips"
    | "manual-replays"
    | "export-videos"
    | "full-recordings"
    | "app-installation"
    | "rewind-buffer"
    | "temporary-files"
    | "database";
  estimated?: boolean | undefined;
  fileCount: number;
  label: string;
  sizeBytes: number;
}

export interface StorageExportVolume {
  diskFreeBytes: number;
  diskTotalBytes: number;
  exportVideosSizeBytes: number;
  id: string;
  isRecordingStorage: boolean;
  path: string;
}

const nonnegativeStorageNumber = z.number().finite().nonnegative();
const StorageBreakdownItemSchema: z.ZodType<StorageBreakdownItem> = z.object({
  category: z.enum([
    "death-clips",
    "manual-replays",
    "export-videos",
    "full-recordings",
    "app-installation",
    "rewind-buffer",
    "temporary-files",
    "database",
  ]),
  estimated: z.boolean().optional(),
  fileCount: z.number().int().nonnegative(),
  label: z.string().min(1).max(256),
  sizeBytes: nonnegativeStorageNumber,
});
const StorageExportVolumeSchema: z.ZodType<StorageExportVolume> = z.object({
  diskFreeBytes: nonnegativeStorageNumber,
  diskTotalBytes: nonnegativeStorageNumber,
  exportVideosSizeBytes: nonnegativeStorageNumber,
  id: z.string().min(1).max(256),
  isRecordingStorage: z.boolean(),
  path: z.string().min(1).max(32_768),
});
const StorageInfoSchema: z.ZodType<StorageInfo> = z.object({
  appInstallationOnStorageDrive: z.boolean(),
  appInstallationSizeBytes: nonnegativeStorageNumber,
  breakdown: z.array(StorageBreakdownItemSchema).max(100),
  calculatedAt: z.string().min(1).max(64),
  databaseOnStorageDrive: z.boolean(),
  databaseSizeBytes: nonnegativeStorageNumber,
  diskFreeBytes: nonnegativeStorageNumber,
  diskTotalBytes: nonnegativeStorageNumber,
  exportStorageVolumes: z.array(StorageExportVolumeSchema).max(32),
  exportVideosUsageTruncated: z.boolean(),
  recordingUsageTruncated: z.boolean(),
  recordingsSizeBytes: nonnegativeStorageNumber,
  rewindBufferEstimateBytes: nonnegativeStorageNumber,
  storagePath: z.string().min(1).max(32_768),
  temporarySizeBytes: nonnegativeStorageNumber,
  totalTrackedSizeBytes: nonnegativeStorageNumber,
});
const StorageGameLeagueUsageSchema: z.ZodType<StorageGameLeagueUsage> =
  z.object({
    clipCount: z.number().int().nonnegative(),
    estimatedSizeBytes: nonnegativeStorageNumber,
    game: GameIdSchema,
    hasActiveRecording: z.boolean(),
    id: z.string().min(1).max(256),
    leagueName: z.string().min(1).max(80),
    recordingCount: z.number().int().nonnegative(),
  });
const StorageGameLeagueUsageListSchema = z
  .array(StorageGameLeagueUsageSchema)
  .max(10_000);
const DeleteGameLeagueDataResultSchema: z.ZodType<DeleteGameLeagueDataResult> =
  z.object({
    cleanupError: z.string().max(2_048).nullable().optional(),
    deletedClipCount: z.number().int().nonnegative(),
    deletedRecordingCount: z.number().int().nonnegative(),
    error: z.string().max(2_048).optional(),
    failedFileCount: z.number().int().nonnegative().optional(),
    freedBytes: nonnegativeStorageNumber,
    success: z.boolean(),
  });
const StorageRevealPathsResultSchema: z.ZodType<StorageRevealPathsResult> =
  z.object({
    databasePath: z.string().min(1).max(32_768),
    exportStoragePath: z.string().min(1).max(32_768),
    exportStorageVolumes: z
      .array(
        z.object({
          id: z.string().min(1).max(256),
          path: z.string().min(1).max(32_768),
        }),
      )
      .max(32),
    storagePath: z.string().min(1).max(32_768),
  });

export {
  DeleteGameLeagueDataResultSchema,
  StorageAnalysisAvailabilitySchema,
  StorageGameLeagueUsageListSchema,
  StorageInfoSchema,
  StorageRevealPathsResultSchema,
};

export interface StorageInfo {
  storagePath: string;
  recordingsSizeBytes: number;
  recordingUsageTruncated: boolean;
  exportStorageVolumes: StorageExportVolume[];
  exportVideosUsageTruncated: boolean;
  appInstallationSizeBytes: number;
  temporarySizeBytes: number;
  rewindBufferEstimateBytes: number;
  databaseSizeBytes: number;
  totalTrackedSizeBytes: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  appInstallationOnStorageDrive: boolean;
  databaseOnStorageDrive: boolean;
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
  cleanupError?: string | null | undefined;
  freedBytes: number;
  failedFileCount?: number | undefined;
  deletedClipCount: number;
  deletedRecordingCount: number;
  error?: string | undefined;
}

export interface StorageRevealPathsResult {
  storagePath: string;
  exportStoragePath: string;
  exportStorageVolumes: Array<{ id: string; path: string }>;
  databasePath: string;
}
