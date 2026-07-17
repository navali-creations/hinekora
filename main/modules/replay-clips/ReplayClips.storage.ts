import { statSync } from "node:fs";
import { rm, stat } from "node:fs/promises";

import { app } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { resolveRecordingStorageRoot } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { StorageFileDeletionService } from "~/main/modules/storage/StorageFileDeletion.service";
import {
  createSafePathLogFields,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import {
  rollbackStagedFileDeletions,
  type StagedFileDeletion,
  stageFilesForDeletion,
} from "~/main/utils/staged-file-deletion";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import type { ReplayClip } from "~/types";
import { areReplayClipPathsEqual } from "./ReplayClips.file-operations";
import {
  resolveReplayClipFilePath,
  sanitizeReplayClipStoragePathList,
} from "./ReplayClips.files";
import type { ReplayClipsRepository } from "./ReplayClips.repository";

const logScope = "replay-clips";

interface ReplayClipStoredFileCleanupResult {
  deletedPaths: string[];
  failedPaths?: string[];
  freedBytes: number;
}

class ReplayClipStorageService {
  private readonly fileDeletions: StorageFileDeletionService;

  constructor(
    private readonly repository: ReplayClipsRepository,
    fileDeletions?: StorageFileDeletionService,
  ) {
    this.fileDeletions =
      fileDeletions ??
      new StorageFileDeletionService(DatabaseService.getInstance());
  }

  getStoredClipPath(id: string): string | null {
    const clip = this.repository.get(id);
    return clip ? this.getStoredClipPathForClip(clip) : null;
  }

  getStoredClipMediaPath(id: string): string | null {
    const clip = this.repository.get(id);
    return clip
      ? this.resolveClipFilePath(
          clip.processedClipPath ?? clip.originalObsPath,
          { requireExistingFile: false },
        )
      : null;
  }

  getStoredClipPathForClip(clip: ReplayClip): string | null {
    return this.resolveClipFilePath(
      clip.processedClipPath ?? clip.originalObsPath,
      { requireExistingFile: true, requireNonEmptyFile: true },
    );
  }

  resolveClipFilePath(
    path: string | null | undefined,
    options: { requireExistingFile?: boolean; requireNonEmptyFile?: boolean },
  ): string | null {
    return resolveReplayClipFilePath(path, {
      storageRoot: this.resolveStorageRoot(),
      ...options,
    });
  }

  resolveStorageRoot(): string {
    const settings = SettingsStoreService.getInstance().get();
    return resolveRecordingStorageRoot(
      settings.recordingStoragePath,
      app.getPath("videos"),
    );
  }

  sanitizeClips(
    clips: ReplayClip[],
    storageRoot = this.resolveStorageRoot(),
  ): ReplayClip[] {
    return sanitizeReplayClipStoragePathList(clips, storageRoot).map((clip) => {
      const paths = new Set(
        [clip.processedClipPath, clip.originalObsPath].filter(
          (path): path is string => path !== null,
        ),
      );
      const sizeBytes = Array.from(paths).reduce((total, path) => {
        const fileStats = statSync(path, { throwIfNoEntry: false });
        if (!fileStats) {
          return total;
        }
        if (!fileStats.isFile()) {
          return total;
        }
        return total + fileStats.size;
      }, 0);

      return { ...clip, sizeBytes };
    });
  }

  async withClipSize(clip: ReplayClip, persist = false): Promise<ReplayClip> {
    const paths = new Set(
      [clip.processedClipPath, clip.originalObsPath].filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      ),
    );
    const sizes = await Promise.all(
      Array.from(paths, async (path) => {
        const storedPath = this.resolveClipFilePath(path, {
          requireExistingFile: false,
        });
        if (!storedPath) {
          return 0;
        }

        try {
          const fileStats = await stat(storedPath);
          return fileStats.isFile() ? fileStats.size : 0;
        } catch {
          return 0;
        }
      }),
    );

    const sizeBytes = sizes.reduce((total, size) => total + size, 0);
    if (persist && sizeBytes !== clip.sizeBytes) {
      this.repository.updateSize(clip.id, sizeBytes);
    }
    return sizeBytes === clip.sizeBytes ? clip : { ...clip, sizeBytes };
  }

  async stageStoredClipFilesForDeletion(
    clips: ReplayClip[],
    pathReferenceCounts: Map<string, number>,
    root: string,
    options: { ignoreMissing?: boolean } = {},
  ): Promise<StagedFileDeletion[]> {
    const paths = new Map<string, string>();
    for (const clip of clips) {
      for (const path of [clip.processedClipPath, clip.originalObsPath]) {
        if (path) {
          const key = createStoragePathKey(path);
          if (!paths.has(key)) {
            paths.set(key, path);
          }
        }
      }
    }

    const deletionTargets: Array<{ path: string; size: number }> = [];
    for (const path of paths.values()) {
      const storedPath = resolveReplayClipFilePath(path, {
        requireExistingFile: false,
        storageRoot: root,
      });
      if (
        !storedPath ||
        this.isPathReferencedInCounts(storedPath, pathReferenceCounts)
      ) {
        if (storedPath) {
          logInfo(logScope, "Replay clip file retained", {
            reason: "shared-path",
            ...createSafePathLogFields(storedPath, "recording"),
          });
        }
        continue;
      }
      let fileStats: Awaited<ReturnType<typeof stat>>;
      try {
        fileStats = await stat(storedPath);
      } catch (error) {
        if (
          options.ignoreMissing === true &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          continue;
        }
        throw error;
      }
      if (!fileStats.isFile()) {
        throw new Error("Replay clip storage path is not a file");
      }
      deletionTargets.push({ path: storedPath, size: fileStats.size });
    }

    return stageFilesForDeletion(root, deletionTargets);
  }

  async rollbackStoredClipFileDeletion(
    stagedFiles: StagedFileDeletion[],
  ): Promise<void> {
    await rollbackStagedFileDeletions(stagedFiles);
  }

  markStoredClipFileDeletionCommitted(
    stagedFiles: StagedFileDeletion[],
    root: string,
  ): void {
    this.fileDeletions.markCommitted(stagedFiles, root);
  }

  async finalizeStoredClipFileDeletion(
    stagedFiles: StagedFileDeletion[],
  ): Promise<ReplayClipStoredFileCleanupResult> {
    const result = await this.fileDeletions.finalize(stagedFiles);

    return {
      deletedPaths: result.deletedPaths,
      ...(result.failed.length > 0
        ? { failedPaths: result.failed.map((file) => file.path) }
        : {}),
      freedBytes: result.freedBytes,
    };
  }

  async deleteStoredPathIfUnreferenced(path: string): Promise<void> {
    if (this.isStoredPathReferenced(path)) {
      return;
    }

    try {
      await rm(path, { force: true });
    } catch (error) {
      logWarn(logScope, "Obsolete replay file cleanup failed", {
        error: safeErrorMessage(error),
        ...createSafePathLogFields(path, "recording"),
      });
    }
  }

  createStoredPathReferenceCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const clip of this.repository.listStoragePaths()) {
      for (const path of uniqueClipPathKeys(clip)) {
        counts.set(path, (counts.get(path) ?? 0) + 1);
      }
    }
    return counts;
  }

  isPathReferencedInCounts(path: string, counts: Map<string, number>): boolean {
    return (counts.get(createStoragePathKey(path)) ?? 0) > 0;
  }

  removeClipPathReferences(
    clip: ReplayClip,
    counts: Map<string, number>,
  ): void {
    for (const path of uniqueClipPathKeys(clip)) {
      const nextCount = Math.max(0, counts.get(path)! - 1);
      if (nextCount === 0) {
        counts.delete(path);
      } else {
        counts.set(path, nextCount);
      }
    }
  }

  addClipPathReferences(clip: ReplayClip, counts: Map<string, number>): void {
    for (const path of uniqueClipPathKeys(clip)) {
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  }

  private isStoredPathReferenced(path: string): boolean {
    return this.repository
      .listStoragePaths()
      .some((clip) =>
        [clip.processedClipPath, clip.originalObsPath].some(
          (candidate) =>
            candidate !== null && areReplayClipPathsEqual(candidate, path),
        ),
      );
  }
}

function uniqueClipPathKeys(clip: {
  originalObsPath: string | null;
  processedClipPath: string | null;
}): Set<string> {
  return new Set(
    [clip.processedClipPath, clip.originalObsPath]
      .filter((path): path is string => path !== null)
      .map(createStoragePathKey),
  );
}

export { ReplayClipStorageService };
