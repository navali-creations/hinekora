import { defaultEditorTimelinePlaybackRate } from "~/types";
import type {
  EditorExportClipInput,
  EditorExportInput,
  EditorMediaAsset,
  EditorProject,
  EditorTimelineClip,
} from "../Editor.dto";

function createEditorMediaAsset(
  overrides: Partial<EditorMediaAsset> = {},
): EditorMediaAsset {
  return {
    assetKey: "clip:clip-1",
    category: "death-clip",
    createdAt: "2026-06-18T00:00:00.000Z",
    durationSeconds: 10,
    exists: true,
    id: "clip-1",
    kind: "clip",
    mediaUrl: "hinekora-media://replay-clip/clip-1",
    name: "source.mp4",
    sizeBytes: 1024,
    sourceGame: "poe2",
    sourceLeague: "Standard",
    status: "ready",
    subtitle: "Death clip - Standard",
    ...overrides,
  };
}

function createEditorTimelineClip(
  asset: EditorMediaAsset = createEditorMediaAsset(),
  overrides: Partial<EditorTimelineClip> = {},
): EditorTimelineClip {
  const durationSeconds = asset.durationSeconds ?? 10;

  return {
    assetKey: asset.assetKey,
    color: "primary",
    durationSeconds,
    id: "timeline-1",
    inSeconds: 0,
    mediaUrl: asset.mediaUrl,
    name: asset.name,
    outSeconds: durationSeconds,
    playbackRate: defaultEditorTimelinePlaybackRate,
    sourceInSeconds: 0,
    sourceOutSeconds: durationSeconds,
    startSeconds: 0,
    trackId: "video-track",
    ...overrides,
  };
}

function createEditorProject(
  overrides: Partial<EditorProject> = {},
): EditorProject {
  const asset = createEditorMediaAsset();
  const clip = createEditorTimelineClip(asset);
  const assets = overrides.assets ?? [asset];
  const firstAsset = assets[0] ?? asset;

  return {
    activeClipId: clip.id,
    assets,
    createdAt: "2026-06-18T00:00:00.000Z",
    durationSeconds: clip.durationSeconds,
    id: "project-1",
    selectedAssetKey: asset.assetKey,
    sourceGame: firstAsset.sourceGame,
    sourceLeague: firstAsset.sourceLeague,
    title: "source.mp4 edit",
    tracks: [
      {
        clips: [clip],
        id: "video-track",
        kind: "video",
        label: "Video",
      },
    ],
    updatedAt: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

function createEditorVideoTrackForAssets(
  assets: EditorMediaAsset[],
): EditorProject["tracks"][number] {
  return {
    clips: assets.map((asset, index) =>
      createEditorTimelineClip(asset, {
        id: `timeline-${asset.assetKey}`,
        startSeconds: index * 10,
      }),
    ),
    id: "video-track",
    kind: "video",
    label: "Video",
  };
}

function createEditorExportClipInput(
  overrides: Partial<EditorExportClipInput> = {},
): EditorExportClipInput {
  return {
    durationSeconds: 5,
    inSeconds: 0,
    outSeconds: 5,
    playbackRate: defaultEditorTimelinePlaybackRate,
    source: { id: "clip-1", kind: "clip" },
    startSeconds: 0,
    ...overrides,
  };
}

function createEditorExportProject(
  options: {
    activeSource?: { id: string; kind: "clip" | "recording" } | null;
    clips?: EditorExportClipInput[];
    durationSeconds?: number;
    muteAudio?: boolean;
    projectId?: string;
  } = {},
): EditorProject {
  const clips = options.clips ?? [createEditorExportClipInput()];
  const durationSeconds = options.durationSeconds ?? 5;
  const assets = clips.map((clip) =>
    createEditorMediaAsset({
      assetKey: `${clip.source.kind}:${clip.source.id}`,
      durationSeconds: Math.max(clip.outSeconds, clip.durationSeconds),
      id: clip.source.id,
      kind: clip.source.kind,
      mediaUrl: `hinekora-media://${clip.source.kind}/${clip.source.id}`,
      name: `${clip.source.id}.mp4`,
    }),
  );
  const timelineClips = clips.map((clip, index) =>
    createEditorTimelineClip(assets[index], {
      durationSeconds: clip.durationSeconds,
      id: `timeline-${index + 1}`,
      inSeconds: clip.inSeconds,
      outSeconds: clip.outSeconds,
      playbackRate: clip.playbackRate,
      startSeconds: clip.startSeconds,
    }),
  );
  const activeClipIndex = options.activeSource
    ? clips.findIndex(
        (clip) =>
          clip.source.id === options.activeSource?.id &&
          clip.source.kind === options.activeSource?.kind,
      )
    : -1;

  return createEditorProject({
    activeClipId:
      options.activeSource === null
        ? null
        : (timelineClips[Math.max(activeClipIndex, 0)]?.id ?? null),
    assets,
    durationSeconds,
    id: options.projectId ?? "project-1",
    ...(options.muteAudio === undefined
      ? {}
      : { isAudioMuted: options.muteAudio }),
    selectedAssetKey: assets[Math.max(activeClipIndex, 0)]?.assetKey ?? null,
    tracks: [
      {
        clips: timelineClips,
        id: "video-track",
        kind: "video",
        label: "Video",
      },
    ],
  });
}

function createEditorExportInput(
  overrides: Partial<EditorExportInput> = {},
): EditorExportInput {
  return {
    exportRequestId: "export-request-1",
    fileName: "source.mp4",
    mode: "new-file",
    project: createEditorExportProject(),
    resolution: "1080p",
    ...overrides,
  };
}

export {
  createEditorExportClipInput,
  createEditorExportInput,
  createEditorExportProject,
  createEditorMediaAsset,
  createEditorProject,
  createEditorTimelineClip,
  createEditorVideoTrackForAssets,
};
