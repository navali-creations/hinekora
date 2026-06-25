import type {
  EditorCopyToClipboardInput,
  EditorExportClipInput,
  EditorExportInput,
  EditorExportResolution,
  EditorMediaAsset,
  EditorProject,
  EditorTimelineClip,
  EditorWorkspace,
} from "~/main/modules/editor";

import { normalizeTimelineProject } from "~/types";
import {
  createEditorDefaultFileName,
  roundToMilliseconds,
} from "../Editor.utils/Editor.utils";

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
    overwriteSource,
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
  createEditorCopyToClipboardInput,
  createEditorExportInput,
  findTimelineClip,
  findTimelineClipAt,
  mergeProjectAssets,
  normalizeEditorProjectTimeline,
  refreshProjectAssets,
  refreshWorkspaceAssets,
  resolveAvailableTimelineStart,
  waitMs,
};
