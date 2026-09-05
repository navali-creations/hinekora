import type {
  EditorMediaReference,
  EditorProject,
  EditorTimelineClip,
} from "~/main/modules/editor";
import { formatBytes } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import {
  type MediaFrameStepDirection,
  resolveMediaFrameStepSeconds,
} from "~/renderer/modules/media-playback/useMediaFrameStepKeyboardShortcuts/useMediaFrameStepKeyboardShortcuts.utils";

import type { QuickClipTrimRange } from "~/types";
import { findTimelineClipAt } from "../../Editor.slice/Editor.slice.utils";
import { formatEditorTimestamp } from "../../Editor.utils/Editor.utils";

interface EditorRouteTrimDraft extends QuickClipTrimRange {
  title?: string | null;
}

interface EditorClipFrameStepContext {
  clip: EditorTimelineClip;
  framesPerSecond: number;
  originSeconds: number;
}

const editorClipBoundaryToleranceSeconds = 0.000_001;
const editorFrameIndexTolerance = 0.000_000_1;

function createExportTitle(status: string): string {
  if (status === "ready") {
    return "Your video is ready";
  }

  if (status === "failed") {
    return "Save failed";
  }

  return "Saving video";
}

function createExportSubtitle(input: {
  fileName: string | null;
  result: {
    durationSeconds: number;
    fileName: string;
    sizeBytes: number;
  } | null;
  status: string;
}): string {
  if (input.result) {
    return `${input.result.fileName} - ${formatEditorTimestamp(
      input.result.durationSeconds,
    )} - ${formatBytes(input.result.sizeBytes)}`;
  }

  return input.fileName ?? (input.status === "failed" ? "Save failed" : "");
}

function shouldHydrateEditorProject(input: {
  project: EditorProject;
  sourceId: string | undefined;
  sourceKind: EditorMediaReference["kind"] | undefined;
}): boolean {
  if (!input.sourceId || !input.sourceKind) {
    return false;
  }

  const sourceAsset = input.project.assets.find(
    (asset) => asset.kind === input.sourceKind && asset.id === input.sourceId,
  );
  if (!sourceAsset) {
    return true;
  }

  return !input.project.tracks.some((track) =>
    track.clips.some((clip) => clip.assetKey === sourceAsset.assetKey),
  );
}

function isEditorDeleteShortcut(event: KeyboardEvent): boolean {
  return event.key === "Delete" || event.code === "Delete";
}

function isEditorTimelineShortcutTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('[data-onboarding="editor-timeline"]') !== null
  );
}

function resolveEditorClipFrameStepContext(
  project: EditorProject,
  clip: EditorTimelineClip,
): EditorClipFrameStepContext | null {
  const asset = project.assets.find(
    (candidate) => candidate.assetKey === clip.assetKey,
  );
  if (!asset?.framesPerSecond) {
    return null;
  }

  return {
    clip,
    framesPerSecond: asset.framesPerSecond * clip.playbackRate,
    originSeconds: clip.startSeconds - clip.inSeconds / clip.playbackRate,
  };
}

function findContiguousEditorClip(
  project: EditorProject,
  clip: EditorTimelineClip,
  direction: MediaFrameStepDirection,
): EditorTimelineClip | null {
  const boundarySeconds =
    direction === 1
      ? clip.startSeconds + clip.durationSeconds
      : clip.startSeconds;

  return (
    project.tracks
      .flatMap((track) => track.clips)
      .find((candidate) => {
        if (candidate.id === clip.id) {
          return false;
        }

        const candidateBoundarySeconds =
          direction === 1
            ? candidate.startSeconds
            : candidate.startSeconds + candidate.durationSeconds;
        return (
          Math.abs(candidateBoundarySeconds - boundarySeconds) <=
          editorClipBoundaryToleranceSeconds
        );
      }) ?? null
  );
}

function resolveLastVisibleEditorFrameSeconds(
  context: EditorClipFrameStepContext,
): number {
  const clipEndSeconds =
    context.clip.startSeconds + context.clip.durationSeconds;
  const framePosition =
    (clipEndSeconds - context.originSeconds) * context.framesPerSecond;
  const lastVisibleFrameIndex =
    Math.ceil(framePosition - editorFrameIndexTolerance) - 1;

  return Math.max(
    context.clip.startSeconds,
    context.originSeconds + lastVisibleFrameIndex / context.framesPerSecond,
  );
}

function resolveEditorFrameStepSeconds(input: {
  direction: MediaFrameStepDirection;
  playbackSeconds: number;
  project: EditorProject | null;
}): number | null {
  const clip = findTimelineClipAt(input.project, input.playbackSeconds);
  if (!clip || !input.project) {
    return null;
  }
  const context = resolveEditorClipFrameStepContext(input.project, clip);
  if (!context) {
    return null;
  }

  const clipEndSeconds = clip.startSeconds + clip.durationSeconds;
  const steppedSeconds = resolveMediaFrameStepSeconds({
    currentSeconds: input.playbackSeconds,
    direction: input.direction,
    framesPerSecond: context.framesPerSecond,
    originSeconds: context.originSeconds,
  });
  const crossedClipBoundary =
    input.direction === 1
      ? steppedSeconds >= clipEndSeconds - editorClipBoundaryToleranceSeconds
      : steppedSeconds < clip.startSeconds - editorClipBoundaryToleranceSeconds;
  if (!crossedClipBoundary) {
    return Math.max(0, Math.min(input.project.durationSeconds, steppedSeconds));
  }

  const contiguousClip = findContiguousEditorClip(
    input.project,
    clip,
    input.direction,
  );
  if (!contiguousClip) {
    return input.direction === 1
      ? Math.min(input.project.durationSeconds, clipEndSeconds)
      : Math.max(0, clip.startSeconds);
  }
  if (input.direction === 1) {
    return contiguousClip.startSeconds;
  }

  const contiguousContext = resolveEditorClipFrameStepContext(
    input.project,
    contiguousClip,
  );
  return contiguousContext
    ? resolveLastVisibleEditorFrameSeconds(contiguousContext)
    : null;
}

export {
  createExportSubtitle,
  createExportTitle,
  type EditorRouteTrimDraft,
  isEditorDeleteShortcut,
  isEditorTimelineShortcutTarget,
  resolveEditorFrameStepSeconds,
  shouldHydrateEditorProject,
};
