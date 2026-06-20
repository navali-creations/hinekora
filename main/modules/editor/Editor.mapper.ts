import type { RunRecordingDetail } from "~/main/modules/recording-storage";
import type { ReplayClipDetail } from "~/main/modules/replay-clips";

import type {
  EditorMediaAsset,
  EditorProject,
  EditorTimelineClip,
  EditorTimelineTrack,
} from "./Editor.dto";

const fallbackClipDurationSeconds = 10;
const videoTrackId = "video-track";

function createEditorAssetFromReplayClip(
  detail: ReplayClipDetail,
): EditorMediaAsset {
  const path = detail.clip.processedClipPath ?? detail.clip.originalObsPath;
  const clipLabel =
    detail.clip.kind === "manual" ? "Manual replay" : "Death clip";
  const category =
    detail.clip.kind === "manual" ? "manual-replay" : "death-clip";
  const status = detail.mediaUrl
    ? "ready"
    : detail.clip.status === "failed"
      ? "failed"
      : detail.clip.status === "ready"
        ? "missing"
        : "processing";

  return {
    assetKey: createEditorAssetKey("clip", detail.clip.id),
    category,
    createdAt: detail.clip.createdAt,
    durationSeconds: detail.clip.targetDurationSeconds,
    exists: detail.mediaUrl !== null,
    id: detail.clip.id,
    kind: "clip",
    mediaUrl: detail.mediaUrl,
    name: path ? getCrossPlatformBasename(path) : clipLabel,
    sizeBytes: detail.clip.sizeBytes,
    sourceGame: detail.clip.sourceGame,
    sourceLeague: detail.clip.sourceLeague,
    status,
    subtitle: `${clipLabel} - ${detail.clip.sourceLeague}`,
  };
}

function createEditorAssetFromRecording(
  detail: RunRecordingDetail,
): EditorMediaAsset {
  return {
    assetKey: createEditorAssetKey("recording", detail.recording.id),
    category: "recording",
    createdAt: detail.recording.createdAt,
    durationSeconds: detail.recording.durationSeconds,
    exists: detail.recording.exists && detail.mediaUrl !== null,
    id: detail.recording.id,
    kind: "recording",
    mediaUrl: detail.mediaUrl,
    name: detail.recording.fileName,
    sizeBytes: detail.recording.sizeBytes,
    sourceGame: detail.recording.sourceGame,
    sourceLeague: detail.recording.sourceLeague,
    status: detail.recording.exists && detail.mediaUrl ? "ready" : "missing",
    subtitle: `Run recording - ${detail.recording.sourceLeague}`,
  };
}

function createEditorAssetKey(
  kind: EditorMediaAsset["kind"],
  id: string,
): string {
  return `${kind}:${id}`;
}

function getCrossPlatformBasename(path: string): string {
  return (
    path
      .split(/[\\/]+/)
      .filter(Boolean)
      .at(-1) ?? path
  );
}

function sortEditorAssets(assets: EditorMediaAsset[]): EditorMediaAsset[] {
  return [...assets].sort(
    (first, second) =>
      Date.parse(second.createdAt) - Date.parse(first.createdAt) ||
      first.name.localeCompare(second.name),
  );
}

function createEditorProjectFromAssets(input: {
  assets: EditorMediaAsset[];
  id: string;
  now: string;
  title?: string;
}): EditorProject {
  const clips = createTimelineClips(input.assets);
  const durationSeconds = clips.reduce(
    (duration, clip) =>
      Math.max(duration, clip.startSeconds + clip.durationSeconds),
    0,
  );
  const tracks: EditorTimelineTrack[] = [
    {
      clips,
      id: videoTrackId,
      kind: "video",
      label: "Video",
    },
  ];

  return {
    activeClipId: clips[0]?.id ?? null,
    assets: input.assets,
    createdAt: input.now,
    durationSeconds,
    id: input.id,
    selectedAssetKey: input.assets[0]?.assetKey ?? null,
    title: input.title ?? createProjectTitle(input.assets),
    tracks,
    updatedAt: input.now,
  };
}

function createTimelineClips(assets: EditorMediaAsset[]): EditorTimelineClip[] {
  let nextStartSeconds = 0;

  return assets.map((asset, index) => {
    const durationSeconds = normalizeAssetDuration(asset.durationSeconds);
    const clip: EditorTimelineClip = {
      assetKey: asset.assetKey,
      color: asset.kind === "clip" ? "primary" : "secondary",
      durationSeconds,
      id: `timeline-${index + 1}-${asset.assetKey}`,
      inSeconds: 0,
      mediaUrl: asset.mediaUrl,
      name: asset.name,
      outSeconds: durationSeconds,
      sourceInSeconds: 0,
      sourceOutSeconds: durationSeconds,
      startSeconds: nextStartSeconds,
      trackId: videoTrackId,
    };
    nextStartSeconds += durationSeconds;

    return clip;
  });
}

function createProjectTitle(assets: EditorMediaAsset[]): string {
  if (assets.length === 1) {
    /* v8 ignore next -- Length check guarantees the first asset exists. */
    return `${assets[0]?.name ?? "Untitled"} edit`;
  }

  if (assets.length > 1) {
    return `${assets.length} asset edit`;
  }

  return "Untitled edit";
}

function normalizeAssetDuration(durationSeconds: number | null): number {
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return fallbackClipDurationSeconds;
  }

  return Math.max(0.001, Math.round(durationSeconds * 1_000) / 1_000);
}

export {
  createEditorAssetFromRecording,
  createEditorAssetFromReplayClip,
  createEditorAssetKey,
  createEditorProjectFromAssets,
  normalizeAssetDuration,
  sortEditorAssets,
};
