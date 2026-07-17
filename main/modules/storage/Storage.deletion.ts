import type { BookmarksService } from "~/main/modules/bookmarks";
import type { DatabaseService } from "~/main/modules/database";
import type { RunRecordingItem } from "~/main/modules/recording-storage/RecordingStorage.dto";
import type { RecordingStorageRepository } from "~/main/modules/recording-storage/RecordingStorage.repository";
import type { ReplayClipsRepository } from "~/main/modules/replay-clips/ReplayClips.repository";
import {
  rollbackStagedFileDeletions,
  stageFilesForDeletion,
} from "~/main/utils/staged-file-deletion";
import { removeEmptyParentDirectories } from "~/main/utils/storage-files";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import type { GameId, ReplayClip } from "~/types";
import { collectDeleteFiles } from "./Storage.files";
import type { StorageFileDeletionService } from "./StorageFileDeletion.service";

interface DeleteGameLeagueStorageResult {
  failedFileCount: number;
  freedBytes: number;
}

const databaseDeleteBatchSize = 500;

async function deleteGameLeagueStorage(input: {
  bookmarks: BookmarksService;
  clips: ReplayClip[];
  database: DatabaseService;
  fileDeletions: StorageFileDeletionService;
  game: GameId;
  leagueName: string;
  recordingRepository: RecordingStorageRepository;
  recordings: RunRecordingItem[];
  replayClipsRepository: ReplayClipsRepository;
  storageRoot: string;
}): Promise<DeleteGameLeagueStorageResult> {
  const selectedClipIds = new Set(input.clips.map((clip) => clip.id));
  const selectedRecordingIds = new Set(
    input.recordings.map((recording) => recording.id),
  );
  const remainingPathKeys = collectRemainingPathKeys(input, {
    selectedClipIds,
    selectedRecordingIds,
  });

  const files = collectDeleteFiles(
    input.clips,
    input.recordings,
    input.storageRoot,
  ).filter((file) => !remainingPathKeys.has(createStoragePathKey(file.path)));
  const stagedFiles = await stageFilesForDeletion(input.storageRoot, files);
  try {
    input.database.transaction(() => {
      const currentRemainingPathKeys = collectRemainingPathKeys(input, {
        selectedClipIds,
        selectedRecordingIds,
      });
      if (
        files.some((file) =>
          currentRemainingPathKeys.has(createStoragePathKey(file.path)),
        )
      ) {
        throw new Error("Storage references changed during deletion");
      }
      input.bookmarks.deleteReplayClipLinksMany([...selectedClipIds]);
      input.bookmarks.deleteBookmarksForRecordings([...selectedRecordingIds]);
      deleteRowsById(input.database, "replay_clips", [...selectedClipIds]);
      deleteRowsById(input.database, "run_recordings", [
        ...selectedRecordingIds,
      ]);
      input.fileDeletions.markCommitted(stagedFiles, input.storageRoot);
    });
  } catch (error) {
    await rollbackStagedFileDeletions(stagedFiles);
    throw error;
  }

  const cleanup = await input.fileDeletions.finalize(stagedFiles);
  for (const path of cleanup.deletedPaths) {
    removeEmptyParentDirectories(path, input.storageRoot);
  }
  return {
    failedFileCount: cleanup.failed.length,
    freedBytes: cleanup.freedBytes,
  };
}

function collectRemainingPathKeys(
  input: Pick<
    Parameters<typeof deleteGameLeagueStorage>[0],
    "recordingRepository" | "replayClipsRepository"
  >,
  selected: {
    selectedClipIds: Set<string>;
    selectedRecordingIds: Set<string>;
  },
): Set<string> {
  const remainingPathKeys = new Set<string>();
  for (const clip of input.replayClipsRepository.listStoragePaths()) {
    if (selected.selectedClipIds.has(clip.id)) {
      continue;
    }
    for (const path of [clip.processedClipPath, clip.originalObsPath]) {
      if (path) {
        remainingPathKeys.add(createStoragePathKey(path));
      }
    }
  }
  for (const recording of input.recordingRepository.listRunRecordings()) {
    if (!selected.selectedRecordingIds.has(recording.id)) {
      remainingPathKeys.add(createStoragePathKey(recording.path));
    }
  }
  return remainingPathKeys;
}

function deleteRowsById(
  database: DatabaseService,
  table: "replay_clips" | "run_recordings",
  ids: string[],
): void {
  for (let index = 0; index < ids.length; index += databaseDeleteBatchSize) {
    database.runQuery(
      database.kysely
        .deleteFrom(table)
        .where("id", "in", ids.slice(index, index + databaseDeleteBatchSize)),
    );
  }
}

export { deleteGameLeagueStorage };
