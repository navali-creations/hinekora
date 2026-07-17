import { stat } from "node:fs/promises";

import type { BookmarksService } from "~/main/modules/bookmarks";
import type { DatabaseService } from "~/main/modules/database";
import type { ReplayClipsRepository } from "~/main/modules/replay-clips/ReplayClips.repository";
import type { StorageFileDeletionService } from "~/main/modules/storage/StorageFileDeletion.service";
import {
  rollbackStagedFileDeletions,
  stageFilesForDeletion,
} from "~/main/utils/staged-file-deletion";
import { removeEmptyParentDirectories } from "~/main/utils/storage-files";

import type { RecordingStorageRepository } from "./RecordingStorage.repository";

interface RecordingStorageDeletionDependencies {
  bookmarks: BookmarksService;
  database: DatabaseService;
  fileDeletions: StorageFileDeletionService;
  recordingRepository: RecordingStorageRepository;
  replayClipsRepository: ReplayClipsRepository;
}

interface RecordingStorageFileDeletionResult {
  cleanupError: string | null;
  deletedMetadata: boolean;
  deletedPaths: string[];
  freedBytes: number;
  recordingId: string | null;
}

async function deleteRecordingFile(input: {
  dependencies: RecordingStorageDeletionDependencies;
  path: string;
  root: string;
}): Promise<RecordingStorageFileDeletionResult> {
  const {
    bookmarks,
    database,
    fileDeletions,
    recordingRepository,
    replayClipsRepository,
  } = input.dependencies;
  const recording = recordingRepository.getItemByPath(input.path);
  let fileStats: Awaited<ReturnType<typeof stat>> | null = null;
  try {
    fileStats = await stat(input.path);
  } catch (error) {
    /* v8 ignore next -- Native stat failures other than a missing path are passed through unchanged. */
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  if (!fileStats && !recording) {
    throw new Error("Recording file is not available");
  }
  if (fileStats && !fileStats.isFile()) {
    throw new Error("Recording storage path is not a file");
  }

  const fileHasReplayClipReference = replayClipsRepository.hasStoragePath(
    input.path,
  );
  const stagedFiles =
    fileStats && !fileHasReplayClipReference
      ? await stageFilesForDeletion(input.root, [
          { path: input.path, size: fileStats.size },
        ])
      : [];
  let deletedMetadata = false;
  try {
    database.transaction(() => {
      if (
        stagedFiles.length > 0 &&
        replayClipsRepository.hasStoragePath(input.path)
      ) {
        throw new Error("Recording storage references changed during deletion");
      }
      if (recording) {
        bookmarks.deleteBookmarksForRecording(recording.id);
      }
      deletedMetadata = recordingRepository.deleteRunRecordingByPath(
        input.path,
      );
      fileDeletions.markCommitted(stagedFiles, input.root);
    });
  } catch (error) {
    await rollbackStagedFileDeletions(stagedFiles);
    throw error;
  }

  const cleanup = await fileDeletions.finalize(stagedFiles);
  if (cleanup.failed.length === 0 && fileStats) {
    removeEmptyParentDirectories(input.path, input.root);
  }

  return {
    cleanupError:
      cleanup.failed.length > 0
        ? "A staged recording file could not be removed"
        : null,
    deletedMetadata,
    deletedPaths: cleanup.deletedPaths,
    freedBytes: cleanup.freedBytes,
    recordingId: recording?.id ?? null,
  };
}

async function recoverRecordingStorageDeletions(input: {
  fileDeletions: StorageFileDeletionService;
  root: string;
}): Promise<{ hasMore: boolean }> {
  const recovery = await input.fileDeletions.recover(input.root);
  if (recovery.failed.length > 0) {
    throw new Error("One or more staged storage files could not be recovered");
  }

  return { hasMore: recovery.hasMore };
}

export { deleteRecordingFile, recoverRecordingStorageDeletions };
