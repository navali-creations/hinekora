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

  return {
    activeClipId: clip.id,
    assets: [asset],
    createdAt: "2026-06-18T00:00:00.000Z",
    durationSeconds: clip.durationSeconds,
    id: "project-1",
    selectedAssetKey: asset.assetKey,
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

function createEditorExportClipInput(
  overrides: Partial<EditorExportClipInput> = {},
): EditorExportClipInput {
  return {
    durationSeconds: 5,
    inSeconds: 0,
    outSeconds: 5,
    source: { id: "clip-1", kind: "clip" },
    startSeconds: 0,
    ...overrides,
  };
}

function createEditorExportInput(
  overrides: Partial<EditorExportInput> = {},
): EditorExportInput {
  return {
    clips: [createEditorExportClipInput()],
    durationSeconds: 5,
    exportRequestId: "export-request-1",
    fileName: "source.mp4",
    mode: "new-file",
    overwriteSource: null,
    resolution: "1080p",
    ...overrides,
  };
}

export {
  createEditorExportClipInput,
  createEditorExportInput,
  createEditorMediaAsset,
  createEditorProject,
  createEditorTimelineClip,
};
