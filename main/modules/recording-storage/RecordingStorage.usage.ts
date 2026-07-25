import { resolve } from "node:path";

import {
  defaultEditorExportInventoryMaxEntries,
  defaultEditorExportInventoryMaxFiles,
  type EditorExportFile,
  scanEditorExportFiles,
} from "~/main/modules/editor/EditorExport.inventory";
import type { ReplayClipsRepository } from "~/main/modules/replay-clips/ReplayClips.repository";
import { isPathInsideOrEqual } from "~/main/utils/storage-files";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import {
  getManagedStoragePaths,
  hydrateStoragePathSizes,
  type RecordingStoragePathSize,
  sumPositiveValues,
} from "./RecordingStorage.inventory";
import type { RecordingStorageRepository } from "./RecordingStorage.repository";

const storageUsagePageSize = 500;

interface RecordingStorageUsageTotals {
  clipsSizeBytes: number;
  recordingsSizeBytes: number;
  exportVideosSizeBytes: number;
  exportVideosUsageTruncated: boolean;
  usageBytes: number;
}

interface ReplayClipUsageEntry {
  pathKeys: string[];
  paths: string[];
  sizeBytes: number;
}

interface RecordingStorageUsageCalculationInput {
  exportRoots: readonly string[];
  recordingRepository: RecordingStorageRepository;
  replayClipsRepository: ReplayClipsRepository;
  root: string;
  shouldAbort?: () => boolean;
  statFile?: (path: string) => Promise<{
    isFile: () => boolean;
    size: number;
  }>;
  maxExportEntries?: number;
  maxExportFiles?: number;
  isExportVideoOwned?: (file: EditorExportFile) => boolean;
  scanExportFiles?: typeof scanEditorExportFiles;
}

async function calculateRecordingStorageUsage(
  input: RecordingStorageUsageCalculationInput,
): Promise<RecordingStorageUsageTotals | null> {
  const root = resolve(input.root);
  const shouldAbort = input.shouldAbort ?? (() => false);

  const clipPathKeys = new Set<string>();
  const clipEntries: ReplayClipUsageEntry[] = [];
  let clipCursor: { createdAt: string; id: string } | null = null;
  for (;;) {
    await yieldToEventLoop();
    if (shouldAbort()) {
      return null;
    }
    const clips = input.replayClipsRepository.listStorageEntriesPage(
      clipCursor,
      storageUsagePageSize,
    );
    for (const clip of clips) {
      const paths = getManagedStoragePaths(root, clip);
      if (paths.length === 0) {
        continue;
      }
      for (const path of paths) {
        clipPathKeys.add(createStoragePathKey(path));
      }
      clipEntries.push({
        pathKeys: paths.map(createStoragePathKey),
        paths,
        sizeBytes: Math.max(0, clip.sizeBytes),
      });
    }
    if (clips.length < storageUsagePageSize) {
      break;
    }
    const lastClip = clips.at(-1)!;
    clipCursor = { createdAt: lastClip.createdAt, id: lastClip.id };
  }

  const clipsSizeBytes = await calculateReplayClipUsage(
    clipEntries,
    shouldAbort,
  );
  if (clipsSizeBytes === null) {
    return null;
  }

  let recordingsSizeBytes = 0;
  const managedPathKeys = new Set(clipPathKeys);
  let recordingCursor: { mtimeMs: number; path: string } | null = null;
  for (;;) {
    await yieldToEventLoop();
    if (shouldAbort()) {
      return null;
    }
    const recordings = input.recordingRepository.listStorageEntriesPage(
      recordingCursor,
      storageUsagePageSize,
    );
    for (const recording of recordings) {
      const path = resolve(recording.path);
      if (
        isPathInsideOrEqual(root, path) &&
        !clipPathKeys.has(createStoragePathKey(path))
      ) {
        recordingsSizeBytes += Math.max(0, recording.size);
        managedPathKeys.add(createStoragePathKey(path));
      }
    }
    if (recordings.length < storageUsagePageSize) {
      break;
    }
    const lastRecording = recordings.at(-1)!;
    recordingCursor = {
      mtimeMs: lastRecording.mtimeMs,
      path: lastRecording.path,
    };
  }

  const exportVideosUsage = await calculateExportVideosUsage(
    input.exportRoots,
    managedPathKeys,
    shouldAbort,
    input.statFile,
    input.maxExportEntries ?? defaultEditorExportInventoryMaxEntries,
    input.maxExportFiles ?? defaultEditorExportInventoryMaxFiles,
    input.isExportVideoOwned ?? (() => true),
    input.scanExportFiles ?? scanEditorExportFiles,
  );
  if (exportVideosUsage === null) {
    return null;
  }

  return {
    clipsSizeBytes,
    recordingsSizeBytes,
    exportVideosSizeBytes: exportVideosUsage.sizeBytes,
    exportVideosUsageTruncated: exportVideosUsage.isTruncated,
    usageBytes: clipsSizeBytes + recordingsSizeBytes,
  };
}

async function calculateExportVideosUsage(
  roots: readonly string[],
  excludedPathKeys: ReadonlySet<string>,
  shouldAbort: () => boolean,
  statFile: RecordingStorageUsageCalculationInput["statFile"],
  maxEntries: number,
  maxFiles: number,
  isExportVideoOwned: (file: EditorExportFile) => boolean,
  scanExportFiles: typeof scanEditorExportFiles,
): Promise<{ isTruncated: boolean; sizeBytes: number } | null> {
  if (shouldAbort()) {
    return null;
  }

  let total = 0;
  const result = await scanExportFiles({
    maxEntries,
    maxFiles,
    onFiles: (files) => {
      total += sumPositiveValues(
        files.filter(
          (file) =>
            isExportVideoOwned(file) &&
            !excludedPathKeys.has(createStoragePathKey(file.path)),
        ),
        (file) => file.sizeBytes,
      );
    },
    roots,
    shouldAbort,
    ...(statFile === undefined ? {} : { statFile }),
  });
  return result ? { isTruncated: result.isTruncated, sizeBytes: total } : null;
}

async function calculateReplayClipUsage(
  clips: ReplayClipUsageEntry[],
  shouldAbort: () => boolean,
): Promise<number | null> {
  const parents = clips.map((_, index) => index);
  const ownerByPath = new Map<string, number>();
  for (let index = 0; index < clips.length; index += 1) {
    if (await shouldAbortAtChunkBoundary(index, shouldAbort)) {
      return null;
    }
    for (const pathKey of clips[index]!.pathKeys) {
      const owner = ownerByPath.get(pathKey);
      if (owner === undefined) {
        ownerByPath.set(pathKey, index);
      } else {
        unionClipGroups(parents, index, owner);
      }
    }
  }

  const groups = new Map<number, ReplayClipUsageEntry[]>();
  for (let index = 0; index < clips.length; index += 1) {
    if (await shouldAbortAtChunkBoundary(index, shouldAbort)) {
      return null;
    }
    const root = findClipGroup(parents, index);
    const group = groups.get(root) ?? [];
    group.push(clips[index]!);
    groups.set(root, group);
  }

  let total = 0;
  let groupIndex = 0;
  for (const group of groups.values()) {
    if (await shouldAbortAtChunkBoundary(groupIndex, shouldAbort)) {
      return null;
    }
    groupIndex += 1;
    const pathSignatures = new Set(
      group.map((clip) => [...clip.pathKeys].sort().join("\0")),
    );
    if (group.length === 1 || pathSignatures.size === 1) {
      total += group.reduce(
        (largestSize, clip) => Math.max(largestSize, clip.sizeBytes),
        0,
      );
      continue;
    }

    const pathSizes = new Map<string, RecordingStoragePathSize>();
    for (const clip of group) {
      for (let index = 0; index < clip.paths.length; index += 1) {
        const key = clip.pathKeys[index]!;
        pathSizes.set(
          key,
          pathSizes.get(key) ?? {
            path: clip.paths[index]!,
            size: 0,
          },
        );
      }
    }
    const hydrated = await hydrateStoragePathSizes(
      pathSizes,
      pathSizes.keys(),
      shouldAbort,
    );
    if (!hydrated) {
      return null;
    }
    total += sumPositiveValues(pathSizes.values(), (entry) => entry.size);
  }

  return total;
}

async function shouldAbortAtChunkBoundary(
  index: number,
  shouldAbort: () => boolean,
): Promise<boolean> {
  if (index % storageUsagePageSize !== 0) {
    return false;
  }
  await yieldToEventLoop();
  return shouldAbort();
}

function findClipGroup(parents: number[], index: number): number {
  let root = index;
  while (parents[root] !== root) {
    root = parents[root]!;
  }
  while (parents[index] !== index) {
    const parent = parents[index]!;
    parents[index] = root;
    index = parent;
  }
  return root;
}

function unionClipGroups(parents: number[], left: number, right: number): void {
  const leftRoot = findClipGroup(parents, left);
  const rightRoot = findClipGroup(parents, right);
  if (leftRoot !== rightRoot) {
    parents[rightRoot] = leftRoot;
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolvePromise) => setImmediate(resolvePromise));
}

export { calculateRecordingStorageUsage };
