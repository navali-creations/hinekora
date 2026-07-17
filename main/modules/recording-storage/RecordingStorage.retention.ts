import { resolve } from "node:path";

import { isPathInsideOrEqual } from "~/main/utils/storage-files";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import type { ReplayClipStorageEntry } from "../replay-clips/ReplayClips.repository";
import {
  addReplayClipStoragePaths,
  hydrateStoragePathSizes,
  sumPositiveValues,
} from "./RecordingStorage.inventory";
import type { RunRecordingStorageEntry } from "./RecordingStorage.repository";

const maxCleanupItemsPerPass = 100;
const yieldInterval = 500;

interface RecordingStorageRetentionOptions {
  protectedDirectories?: string[];
  protectedPaths?: string[];
}

interface RecordingStorageInventory {
  clipGroups: ReplayClipStorageGroup[];
  clipsSizeBytes: number;
  recordingEntries: RunRecordingStorageEntry[];
  recordingsSizeBytes: number;
  usageBytes: number;
}

interface ReplayClipStorageGroup {
  clipIds: string[];
  mtimeMs: number;
  paths: string[];
  size: number;
}

interface RecordingCleanupCandidate extends RunRecordingStorageEntry {
  kind: "recording";
}

interface ReplayClipRetentionCandidate extends ReplayClipStorageGroup {
  kind: "clip";
}

type RecordingStorageRetentionCandidate =
  | RecordingCleanupCandidate
  | ReplayClipRetentionCandidate;

interface RecordingStorageCleanupSelection {
  files: RecordingStorageRetentionCandidate[];
  hasMoreCandidates: boolean;
  targetUsageBytes: number;
  usageBytes: number;
}

async function createRecordingStorageInventory(input: {
  clips: ReplayClipStorageEntry[];
  recordings: RunRecordingStorageEntry[];
  root: string;
}): Promise<RecordingStorageInventory> {
  const root = resolve(input.root);
  const clipRows: Array<ReplayClipStorageEntry & { paths: string[] }> = [];
  const clipPaths = new Map<string, { path: string; size: number }>();
  const ambiguousPathKeys = new Set<string>();
  for (let index = 0; index < input.clips.length; index += 1) {
    if (index > 0 && index % yieldInterval === 0) {
      await yieldToEventLoop();
    }
    const clip = input.clips[index]!;
    const paths = addReplayClipStoragePaths(
      root,
      clip,
      clipPaths,
      ambiguousPathKeys,
    );
    if (paths.length > 0) {
      clipRows.push({ ...clip, paths });
    }
  }

  await hydrateStoragePathSizes(clipPaths, ambiguousPathKeys);
  const clipGroups = await createClipGroups(clipRows, clipPaths);
  const clipPathKeys = new Set(clipPaths.keys());
  const recordingEntries = input.recordings.filter(
    (recording) =>
      isPathInsideOrEqual(root, resolve(recording.path)) &&
      !clipPathKeys.has(createStoragePathKey(recording.path)),
  );
  const clipsSizeBytes = sumPositiveValues(
    clipPaths.values(),
    (entry) => entry.size,
  );
  const recordingsSizeBytes = sumPositiveValues(
    recordingEntries,
    (recording) => recording.size,
  );

  return {
    clipGroups,
    clipsSizeBytes,
    recordingEntries,
    recordingsSizeBytes,
    usageBytes: clipsSizeBytes + recordingsSizeBytes,
  };
}

function selectRecordingStorageCleanupCandidates(input: {
  inventory: RecordingStorageInventory;
  limitBytes: number;
  options?: RecordingStorageRetentionOptions;
}): RecordingStorageCleanupSelection {
  const { inventory, limitBytes } = input;
  const targetUsageBytes = limitBytes > 0 ? Math.floor(limitBytes * 0.95) : 0;
  if (limitBytes <= 0 || inventory.usageBytes <= limitBytes) {
    return {
      files: [],
      hasMoreCandidates: false,
      targetUsageBytes,
      usageBytes: inventory.usageBytes,
    };
  }

  const protectedPaths = new Set(
    (input.options?.protectedPaths ?? []).map(createStoragePathKey),
  );
  const protectedDirectories = (input.options?.protectedDirectories ?? []).map(
    (path) => resolve(path),
  );
  const candidates: RecordingStorageRetentionCandidate[] = [
    ...inventory.recordingEntries
      .filter(
        (recording) =>
          !isProtectedPath(
            recording.path,
            protectedPaths,
            protectedDirectories,
          ),
      )
      .map((recording) => ({ ...recording, kind: "recording" as const })),
    ...inventory.clipGroups
      .filter(
        (group) =>
          group.size > 0 &&
          !group.paths.some((path) =>
            isProtectedPath(path, protectedPaths, protectedDirectories),
          ),
      )
      .map((group) => ({ ...group, kind: "clip" as const })),
  ].sort((left, right) => left.mtimeMs - right.mtimeMs);

  const files: RecordingStorageRetentionCandidate[] = [];
  let hasMoreCandidates = false;
  let itemCount = 0;
  for (const candidate of candidates) {
    const candidateItemCount =
      candidate.kind === "clip" ? candidate.clipIds.length : 1;
    const remainingCapacity = maxCleanupItemsPerPass - itemCount;
    if (remainingCapacity <= 0) {
      hasMoreCandidates = true;
      break;
    }
    if (candidateItemCount > remainingCapacity) {
      /* v8 ignore next -- A recording always costs one item and this branch only runs while capacity is positive. */
      if (candidate.kind === "clip") {
        files.push({
          ...candidate,
          clipIds: candidate.clipIds.slice(0, remainingCapacity),
          size: 0,
        });
        itemCount += remainingCapacity;
      }
      hasMoreCandidates = true;
      break;
    }

    files.push(candidate);
    itemCount += candidateItemCount;
  }

  return {
    files,
    hasMoreCandidates,
    targetUsageBytes,
    usageBytes: inventory.usageBytes,
  };
}

async function createClipGroups(
  clips: Array<ReplayClipStorageEntry & { paths: string[] }>,
  pathSizes: Map<string, { path: string; size: number }>,
): Promise<ReplayClipStorageGroup[]> {
  const parents = new Map(clips.map((clip) => [clip.id, clip.id]));
  const pathOwner = new Map<string, string>();
  for (let index = 0; index < clips.length; index += 1) {
    if (index > 0 && index % yieldInterval === 0) {
      await yieldToEventLoop();
    }
    const clip = clips[index]!;
    for (const path of clip.paths) {
      const key = createStoragePathKey(path);
      const owner = pathOwner.get(key);
      if (owner) {
        unionClipIds(parents, owner, clip.id);
      } else {
        pathOwner.set(key, clip.id);
      }
    }
  }

  const groups = new Map<
    string,
    { clipIds: Set<string>; mtimeMs: number; pathKeys: Set<string> }
  >();
  for (let index = 0; index < clips.length; index += 1) {
    if (index > 0 && index % yieldInterval === 0) {
      await yieldToEventLoop();
    }
    const clip = clips[index]!;
    const rootId = findClipRoot(parents, clip.id);
    const createdAtMs = Date.parse(clip.createdAt);
    const group = groups.get(rootId) ?? {
      clipIds: new Set<string>(),
      mtimeMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
      pathKeys: new Set<string>(),
    };
    group.clipIds.add(clip.id);
    group.mtimeMs = Math.max(
      group.mtimeMs,
      Number.isFinite(createdAtMs) ? createdAtMs : 0,
    );
    for (const path of clip.paths) {
      group.pathKeys.add(createStoragePathKey(path));
    }
    groups.set(rootId, group);
  }

  return [...groups.values()].map((group) => ({
    clipIds: [...group.clipIds],
    mtimeMs: group.mtimeMs,
    paths: [...group.pathKeys]
      .map((key) => pathSizes.get(key)?.path)
      .filter((path): path is string => path !== undefined),
    size: sumPositiveValues(
      group.pathKeys,
      /* v8 ignore next -- Group path keys originate from the populated path-size map. */
      (key) => pathSizes.get(key)?.size ?? 0,
    ),
  }));
}

function findClipRoot(parents: Map<string, string>, id: string): string {
  /* v8 ignore next -- Every clip id is inserted into the parent map before grouping begins. */
  const parent = parents.get(id) ?? id;
  if (parent === id) {
    return id;
  }
  const root = findClipRoot(parents, parent);
  parents.set(id, root);
  return root;
}

function unionClipIds(
  parents: Map<string, string>,
  left: string,
  right: string,
): void {
  const leftRoot = findClipRoot(parents, left);
  const rightRoot = findClipRoot(parents, right);
  if (leftRoot !== rightRoot) {
    parents.set(rightRoot, leftRoot);
  }
}

function isProtectedPath(
  path: string,
  protectedPaths: Set<string>,
  protectedDirectories: string[],
): boolean {
  const resolvedPath = resolve(path);
  return (
    protectedPaths.has(createStoragePathKey(resolvedPath)) ||
    protectedDirectories.some((directory) =>
      isPathInsideOrEqual(directory, resolvedPath),
    )
  );
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolvePromise) => setImmediate(resolvePromise));
}

export type {
  RecordingStorageCleanupSelection,
  RecordingStorageInventory,
  RecordingStorageRetentionOptions,
};
export {
  createRecordingStorageInventory,
  selectRecordingStorageCleanupCandidates,
};
