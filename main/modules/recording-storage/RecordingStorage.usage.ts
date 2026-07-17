import { resolve } from "node:path";

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
  usageBytes: number;
}

interface ReplayClipUsageEntry {
  pathKeys: string[];
  paths: string[];
  sizeBytes: number;
}

async function calculateRecordingStorageUsage(input: {
  recordingRepository: RecordingStorageRepository;
  replayClipsRepository: ReplayClipsRepository;
  root: string;
}): Promise<RecordingStorageUsageTotals> {
  const root = resolve(input.root);

  const clipPathKeys = new Set<string>();
  const clipEntries: ReplayClipUsageEntry[] = [];
  let clipCursor: { createdAt: string; id: string } | null = null;
  for (;;) {
    await yieldToEventLoop();
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

  const clipsSizeBytes = await calculateReplayClipUsage(clipEntries);

  let recordingsSizeBytes = 0;
  let recordingCursor: { mtimeMs: number; path: string } | null = null;
  for (;;) {
    await yieldToEventLoop();
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

  return {
    clipsSizeBytes,
    recordingsSizeBytes,
    usageBytes: clipsSizeBytes + recordingsSizeBytes,
  };
}

async function calculateReplayClipUsage(
  clips: ReplayClipUsageEntry[],
): Promise<number> {
  const parents = clips.map((_, index) => index);
  const ownerByPath = new Map<string, number>();
  for (let index = 0; index < clips.length; index += 1) {
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
    const root = findClipGroup(parents, index);
    const group = groups.get(root) ?? [];
    group.push(clips[index]!);
    groups.set(root, group);
  }

  let total = 0;
  for (const group of groups.values()) {
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
    await hydrateStoragePathSizes(pathSizes, pathSizes.keys());
    total += sumPositiveValues(pathSizes.values(), (entry) => entry.size);
  }

  return total;
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
