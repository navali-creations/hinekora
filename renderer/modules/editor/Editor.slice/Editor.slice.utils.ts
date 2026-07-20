import type {
  EditorCopyToClipboardInput,
  EditorExportClipInput,
  EditorExportInput,
  EditorExportResolution,
  EditorMediaAsset,
  EditorMediaAssetPageQuery,
  EditorProject,
  EditorProjectHistorySnapshot,
  EditorTimelineClip,
  EditorWorkspace,
} from "~/main/modules/editor";

import { normalizeTimelineProject } from "~/types";
import {
  createEditorDefaultFileName,
  roundToMilliseconds,
} from "../Editor.utils/Editor.utils";
import {
  editorAssetRailPageSize,
  editorHistoryLimit,
} from "./Editor.slice.constants";

const editorRecentlyClippedWindowMs = 60 * 60 * 1_000;

function findTimelineClip(
  project: EditorProject | null,
  clipId: string | null,
): EditorTimelineClip | null {
  if (!project || !clipId) {
    return null;
  }

  return (
    project.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === clipId) ?? null
  );
}

function mergeProjectAssets(
  project: EditorProject,
  assets: EditorMediaAsset[],
): EditorMediaAsset[] {
  const assetByKey = new Map(
    project.assets.map((asset) => [asset.assetKey, asset] as const),
  );

  for (const asset of assets) {
    assetByKey.set(asset.assetKey, asset);
  }

  return Array.from(assetByKey.values());
}

function refreshProjectAssets(
  project: EditorProject,
  refreshedAssets: EditorMediaAsset[],
): EditorProject {
  const currentAssetByKey = new Map(
    project.assets.map((asset) => [asset.assetKey, asset] as const),
  );
  const refreshedAssetByKey = new Map(
    refreshedAssets.map((asset) => [asset.assetKey, asset] as const),
  );
  const assetKeys = new Set([
    ...project.assets.map((asset) => asset.assetKey),
    ...project.tracks.flatMap((track) =>
      track.clips.map((clip) => clip.assetKey),
    ),
  ]);
  const assets = Array.from(assetKeys)
    .map(
      (assetKey) =>
        refreshedAssetByKey.get(assetKey) ?? currentAssetByKey.get(assetKey),
    )
    .filter((asset): asset is EditorMediaAsset => asset !== undefined);
  const tracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      const refreshedAsset = refreshedAssetByKey.get(clip.assetKey);
      if (!refreshedAsset) {
        return clip;
      }

      return {
        ...clip,
        mediaUrl: refreshedAsset.mediaUrl,
        name: refreshedAsset.name,
      };
    }),
  }));

  return {
    ...project,
    assets,
    tracks,
  };
}

function refreshWorkspaceAssets(input: {
  currentWorkspace: EditorWorkspace | null;
  project: EditorProject;
  refreshedWorkspace: EditorWorkspace;
}): EditorWorkspace {
  return {
    ...(input.currentWorkspace ?? input.refreshedWorkspace),
    assets: input.refreshedWorkspace.assets,
    hasMoreProjects: input.refreshedWorkspace.hasMoreProjects,
    project: input.project,
    projects: input.refreshedWorkspace.projects,
  };
}

function createEditorExportInput(
  project: EditorProject | null,
  input: {
    exportRequestId: string;
    fileName: string;
    mode: EditorExportInput["mode"];
    resolution: EditorExportResolution;
  },
): EditorExportInput | null {
  if (!project) {
    return null;
  }

  const clips = createEditorExportClips(project);
  if (clips.length === 0) {
    return null;
  }
  const overwriteSource =
    input.mode === "overwrite" ? resolveEditorOverwriteSource(project) : null;
  if (input.mode === "overwrite" && !overwriteSource) {
    return null;
  }

  return {
    clips,
    durationSeconds: project.durationSeconds,
    exportRequestId: input.exportRequestId,
    fileName: input.fileName,
    mode: input.mode,
    muteAudio: project.isAudioMuted === true,
    overwriteSource,
    projectId: project.id,
    resolution: input.resolution,
  };
}

function createEditorCopyToClipboardInput(
  project: EditorProject | null,
): EditorCopyToClipboardInput | null {
  if (!project) {
    return null;
  }

  const clips = createEditorExportClips(project);
  if (clips.length === 0) {
    return null;
  }

  return {
    clips,
    durationSeconds: project.durationSeconds,
    fileName: createEditorDefaultFileName(project),
    muteAudio: project.isAudioMuted === true,
    resolution: "1080p",
  };
}

function createEditorExportClips(
  project: EditorProject,
): EditorExportClipInput[] {
  const assetByKey = new Map(
    project.assets.map((asset) => [asset.assetKey, asset] as const),
  );
  const videoTrack = project.tracks.find((track) => track.kind === "video");
  if (!videoTrack) {
    return [];
  }

  const clips: EditorExportClipInput[] = [];
  for (const clip of [...videoTrack.clips].sort(
    (first, second) => first.startSeconds - second.startSeconds,
  )) {
    const asset = assetByKey.get(clip.assetKey);
    if (!asset) {
      return [];
    }

    clips.push({
      durationSeconds: clip.durationSeconds,
      inSeconds: clip.inSeconds,
      outSeconds: clip.outSeconds,
      playbackRate: clip.playbackRate,
      source: {
        id: asset.id,
        kind: asset.kind,
      },
      startSeconds: clip.startSeconds,
    });
  }

  return clips;
}

function resolveEditorOverwriteSource(
  project: EditorProject,
): EditorExportInput["overwriteSource"] {
  const activeClip = findTimelineClip(project, project.activeClipId);
  const activeAsset = project.assets.find(
    (asset) => asset.assetKey === activeClip?.assetKey,
  );
  if (!activeAsset) {
    return null;
  }

  return {
    id: activeAsset.id,
    kind: activeAsset.kind,
  };
}

function resolveAvailableTimelineStart(input: {
  clips: EditorTimelineClip[];
  desiredStartSeconds: number;
  durationSeconds: number;
}): number {
  if (input.clips.length === 0) {
    return 0;
  }

  let startSeconds = roundToMilliseconds(
    Math.max(input.desiredStartSeconds, 0),
  );
  const sortedClips = [...input.clips].sort(
    (first, second) => first.startSeconds - second.startSeconds,
  );

  for (const clip of sortedClips) {
    if (startSeconds + input.durationSeconds <= clip.startSeconds) {
      break;
    }

    const clipEndSeconds = roundToMilliseconds(
      clip.startSeconds + clip.durationSeconds,
    );
    if (startSeconds < clipEndSeconds) {
      startSeconds = clipEndSeconds;
    }
  }

  return roundToMilliseconds(startSeconds);
}

function normalizeEditorProjectTimeline(
  project: EditorProject,
  options: { preserveDuration?: boolean } = {},
): EditorProject {
  return normalizeTimelineProject(project, options);
}

function createEditorProjectWithHistoryMetadata(
  project: EditorProject,
  historyLabels: string[],
  historySubtitles: Array<string | null> = [],
  historySnapshots: EditorProject[] = [],
): EditorProject {
  const { labels, subtitles } = normalizeEditorProjectHistoryEntries(
    historyLabels,
    historySubtitles,
  );
  const snapshots = normalizeEditorProjectHistorySnapshots(
    historySnapshots,
  ).slice(0, labels.length);
  const shouldPersistSubtitles = subtitles.some(
    (subtitle) => subtitle !== null,
  );
  if (
    labels.length === 0 &&
    !shouldPersistSubtitles &&
    snapshots.length === 0 &&
    !project.history
  ) {
    return project;
  }

  return {
    ...project,
    history: {
      editCount: labels.length,
      labels,
      ...(shouldPersistSubtitles ? { subtitles } : {}),
      ...(snapshots.length === 0 ? {} : { snapshots }),
    },
  };
}

function createEditorProjectHistorySnapshot(
  project: EditorProject,
): EditorProjectHistorySnapshot {
  const snapshotCandidate = project as EditorProject & {
    scrollLeft?: unknown;
    scrollTop?: unknown;
    timelineScrollLeft?: unknown;
    zoom?: unknown;
  };
  if (
    snapshotCandidate.history === undefined &&
    snapshotCandidate.scrollLeft === undefined &&
    snapshotCandidate.scrollTop === undefined &&
    snapshotCandidate.timelineScrollLeft === undefined &&
    snapshotCandidate.zoom === undefined
  ) {
    return project;
  }

  const {
    history: _history,
    scrollLeft: _scrollLeft,
    scrollTop: _scrollTop,
    timelineScrollLeft: _timelineScrollLeft,
    zoom: _zoom,
    ...projectSnapshot
  } = snapshotCandidate;

  return projectSnapshot;
}

function getEditorProjectHistoryLabels(project: EditorProject): string[] {
  return normalizeEditorProjectHistoryEntries(
    project.history?.labels ?? [],
    project.history?.subtitles ?? [],
  ).labels;
}

function getEditorProjectHistorySubtitles(
  project: EditorProject,
): Array<string | null> {
  return normalizeEditorProjectHistoryEntries(
    project.history?.labels ?? [],
    project.history?.subtitles ?? [],
  ).subtitles;
}

function getEditorProjectHistorySnapshots(
  project: EditorProject,
): EditorProject[] {
  return normalizeEditorProjectHistorySnapshots(
    project.history?.snapshots ?? [],
  );
}

function normalizeEditorProjectHistoryEntries(
  labels: string[],
  subtitles: Array<string | null>,
): { labels: string[]; subtitles: Array<string | null> } {
  const entries = labels
    .map((label, index) => {
      const trimmedLabel = label.trim();
      const subtitle = subtitles[index] ?? null;
      const trimmedSubtitle =
        subtitle === null ? null : subtitle.trim() || null;

      return {
        label: trimmedLabel,
        subtitle: trimmedSubtitle,
      };
    })
    .filter((entry) => entry.label.length > 0)
    .slice(-editorHistoryLimit);

  return {
    labels: entries.map((entry) => entry.label),
    subtitles: entries.map((entry) => entry.subtitle),
  };
}

function normalizeEditorProjectHistorySnapshots(
  snapshots: EditorProject[],
): EditorProjectHistorySnapshot[] {
  return snapshots
    .slice(-editorHistoryLimit)
    .map(createEditorProjectHistorySnapshot);
}

function areEditorMediaAssetPageQueriesEqual(
  first: EditorMediaAssetPageQuery,
  second: EditorMediaAssetPageQuery,
): boolean {
  return (
    first.category === second.category &&
    (first.createdAfter ?? null) === (second.createdAfter ?? null) &&
    first.game === second.game &&
    areEditorMediaAssetKeyListsEqual(
      first.excludeAssetKeys,
      second.excludeAssetKeys,
    ) &&
    areEditorMediaAssetKeyListsEqual(
      first.includeAssetKeys,
      second.includeAssetKeys,
    ) &&
    (first.league ?? null) === (second.league ?? null) &&
    (first.pageIndex ?? 0) === (second.pageIndex ?? 0) &&
    (first.pageSize ?? editorAssetRailPageSize) ===
      (second.pageSize ?? editorAssetRailPageSize)
  );
}

function canUseEditorMediaAssetPage(
  requestedQuery: EditorMediaAssetPageQuery,
  currentQuery: EditorMediaAssetPageQuery,
): boolean {
  return areEditorMediaAssetPageQueriesEqual(requestedQuery, currentQuery);
}

function areEditorMediaAssetKeyListsEqual(
  first: string[] | undefined,
  second: string[] | undefined,
): boolean {
  const normalizedFirst = first ?? [];
  const normalizedSecond = second ?? [];
  if (normalizedFirst.length !== normalizedSecond.length) {
    return false;
  }

  return normalizedFirst.every(
    (assetKey, index) => assetKey === normalizedSecond[index],
  );
}

function createEditorRecentlyClippedSince(nowMs = Date.now()): string {
  return new Date(nowMs - editorRecentlyClippedWindowMs).toISOString();
}

function waitMs(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function findTimelineClipAt(
  project: EditorProject | null,
  timelineSeconds: number,
): EditorTimelineClip | null {
  if (!project) {
    return null;
  }

  const clips = project.tracks.flatMap((track) => track.clips);

  return (
    clips.find(
      (clip) =>
        clip.startSeconds <= timelineSeconds &&
        clip.startSeconds + clip.durationSeconds > timelineSeconds,
    ) ??
    clips.find(
      (clip) =>
        clip.startSeconds <= timelineSeconds &&
        clip.startSeconds + clip.durationSeconds >= timelineSeconds,
    ) ??
    null
  );
}

export {
  areEditorMediaAssetPageQueriesEqual,
  canUseEditorMediaAssetPage,
  createEditorCopyToClipboardInput,
  createEditorExportInput,
  createEditorProjectHistorySnapshot,
  createEditorProjectWithHistoryMetadata,
  createEditorRecentlyClippedSince,
  findTimelineClip,
  findTimelineClipAt,
  getEditorProjectHistoryLabels,
  getEditorProjectHistorySnapshots,
  getEditorProjectHistorySubtitles,
  mergeProjectAssets,
  normalizeEditorProjectTimeline,
  refreshProjectAssets,
  refreshWorkspaceAssets,
  resolveAvailableTimelineStart,
  waitMs,
};
