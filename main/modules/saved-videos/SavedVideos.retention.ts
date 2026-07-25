import {
  type EditorExportFile,
  type ScanEditorExportFilesOptions,
  scanEditorExportFiles,
} from "~/main/modules/editor/EditorExport.inventory";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import { storageCleanupTargetRatio } from "~/types";

const maxCleanupFilesPerPass = 100;

interface SavedVideosRetentionPlan {
  files: EditorExportFile[];
  hasMoreCandidates: boolean;
  isTruncated: boolean;
  targetUsageBytes: number;
  usageBytes: number;
}

interface CreateSavedVideosRetentionPlanOptions {
  batchSize?: number;
  limitBytes: number;
  maxCandidates?: number;
  maxEntries?: number;
  maxFiles?: number;
  openDirectory?: ScanEditorExportFilesOptions["openDirectory"];
  isOwned?: (file: EditorExportFile) => boolean;
  protectedPaths?: string[];
  roots: readonly string[];
  scanFiles?: typeof scanEditorExportFiles;
  shouldAbort?: () => boolean;
  statFile?: ScanEditorExportFilesOptions["statFile"];
}

async function createSavedVideosRetentionPlan(
  options: CreateSavedVideosRetentionPlanOptions,
): Promise<SavedVideosRetentionPlan | null> {
  const candidates: EditorExportFile[] = [];
  const protectedPathKeys = new Set(
    (options.protectedPaths ?? []).map(createStoragePathKey),
  );
  const candidateLimit = Math.max(
    1,
    options.maxCandidates ?? maxCleanupFilesPerPass,
  );
  const isOwned = options.isOwned ?? (() => true);
  let eligibleFileCount = 0;
  let usageBytes = 0;
  const result = await (options.scanFiles ?? scanEditorExportFiles)({
    ...(options.batchSize === undefined
      ? {}
      : { batchSize: options.batchSize }),
    ...(options.maxEntries === undefined
      ? {}
      : { maxEntries: options.maxEntries }),
    ...(options.maxFiles === undefined ? {} : { maxFiles: options.maxFiles }),
    onFiles: (files) => {
      for (const file of files) {
        if (!isOwned(file)) {
          continue;
        }
        usageBytes += file.sizeBytes;
        if (
          file.sizeBytes <= 0 ||
          protectedPathKeys.has(createStoragePathKey(file.path))
        ) {
          continue;
        }
        eligibleFileCount += 1;
        candidates.push(file);
      }
      candidates.sort(compareRetentionCandidates);
      if (candidates.length > candidateLimit) {
        candidates.length = candidateLimit;
      }
    },
    ...(options.openDirectory === undefined
      ? {}
      : { openDirectory: options.openDirectory }),
    roots: options.roots,
    ...(options.shouldAbort === undefined
      ? {}
      : { shouldAbort: options.shouldAbort }),
    ...(options.statFile === undefined ? {} : { statFile: options.statFile }),
  });
  if (!result) {
    return null;
  }

  const targetUsageBytes =
    options.limitBytes > 0
      ? Math.floor(options.limitBytes * storageCleanupTargetRatio)
      : 0;
  const shouldClean =
    options.limitBytes > 0 &&
    (usageBytes > options.limitBytes || result.isTruncated);

  return {
    files: shouldClean ? candidates : [],
    hasMoreCandidates:
      result.isTruncated || eligibleFileCount > candidates.length,
    isTruncated: result.isTruncated,
    targetUsageBytes,
    usageBytes,
  };
}

function compareRetentionCandidates(
  left: EditorExportFile,
  right: EditorExportFile,
): number {
  return (
    left.modifiedAt.getTime() - right.modifiedAt.getTime() ||
    createStoragePathKey(left.path).localeCompare(
      createStoragePathKey(right.path),
    )
  );
}

export type { SavedVideosRetentionPlan };
export { createSavedVideosRetentionPlan };
