import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { isManagedRecordingFilePath } from "~/main/modules/recording-storage/RecordingStorage.utils";

import type { ReplayClip } from "~/types";

interface ReplayClipFilePathOptions {
  requireExistingFile?: boolean;
  requireNonEmptyFile?: boolean;
  storageRoot: string;
}

function resolveReplayClipFilePath(
  path: string | null | undefined,
  options: ReplayClipFilePathOptions,
): string | null {
  if (!path) {
    return null;
  }

  const resolvedPath = resolve(path);
  if (!isManagedRecordingFilePath(options.storageRoot, resolvedPath)) {
    return null;
  }

  if (!options.requireExistingFile) {
    return resolvedPath;
  }

  if (!existsSync(resolvedPath)) {
    return null;
  }

  try {
    const stats = statSync(resolvedPath);
    if (!stats.isFile()) {
      return null;
    }

    if (options.requireNonEmptyFile === true && stats.size <= 0) {
      return null;
    }

    return resolvedPath;
  } catch {
    return null;
  }
}

function sanitizeReplayClipStoragePaths(
  clip: ReplayClip,
  storageRoot: string,
): ReplayClip {
  const originalObsPath = resolveReplayClipFilePath(clip.originalObsPath, {
    storageRoot,
    requireExistingFile: false,
  });
  const processedClipPath = resolveReplayClipFilePath(clip.processedClipPath, {
    storageRoot,
    requireExistingFile: false,
  });
  const hadUnsafePath =
    (clip.originalObsPath !== null && originalObsPath === null) ||
    (clip.processedClipPath !== null && processedClipPath === null);
  const hasUsablePath = originalObsPath !== null || processedClipPath !== null;

  return {
    ...clip,
    originalObsPath,
    processedClipPath,
    status: hadUnsafePath && !hasUsablePath ? "failed" : clip.status,
    error:
      hadUnsafePath && !hasUsablePath
        ? (clip.error ?? "Clip file path is outside managed recording storage")
        : clip.error,
  };
}

function sanitizeReplayClipStoragePathList(
  clips: ReplayClip[],
  storageRoot: string,
): ReplayClip[] {
  return clips.map((clip) => sanitizeReplayClipStoragePaths(clip, storageRoot));
}

export {
  resolveReplayClipFilePath,
  sanitizeReplayClipStoragePathList,
  sanitizeReplayClipStoragePaths,
};
