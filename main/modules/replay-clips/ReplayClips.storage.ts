import { statSync } from "node:fs";
import { rm, stat, unlink } from "node:fs/promises";

import { app } from "electron";

import { resolveRecordingStorageRoot } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  createSafePathLogFields,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";

import type { ReplayClip } from "~/types";
import {
  areReplayClipPathsEqual,
  createReplayClipPathKey,
} from "./ReplayClips.file-operations";
import {
  resolveReplayClipFilePath,
  sanitizeReplayClipStoragePathList,
} from "./ReplayClips.files";
import type { ReplayClipsRepository } from "./ReplayClips.repository";

const logScope = "replay-clips";

class ReplayClipStorageService {
  constructor(private readonly repository: ReplayClipsRepository) {}

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

  async deleteStoredClipFiles(
    clip: ReplayClip,
    isReferenced: (path: string) => boolean = (path) =>
      this.isStoredPathReferenced(path),
  ): Promise<void> {
    const paths = new Set(
      [clip.processedClipPath, clip.originalObsPath].filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      ),
    );

    for (const path of paths) {
      const storedPath = this.resolveClipFilePath(path, {
        requireExistingFile: true,
      });
      if (!storedPath) {
        continue;
      }
      if (isReferenced(storedPath)) {
        logInfo(logScope, "Replay clip file retained", {
          clipId: clip.id,
          reason: "shared-path",
          ...createSafePathLogFields(storedPath, "recording"),
        });
        continue;
      }
      await unlink(storedPath);
    }
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
    return (counts.get(createReplayClipPathKey(path)) ?? 0) > 0;
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
      .map(createReplayClipPathKey),
  );
}

export { ReplayClipStorageService };
