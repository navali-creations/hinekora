import type { EditorProject, EditorTimelineClip } from "~/main/modules/editor";

import {
  editorMaxZoom,
  editorMinZoom,
  editorZoomStep,
} from "../../Editor.slice/Editor.slice.constants";
import { calculateExpandableTimelineDuration } from "../../Editor.utils/Editor.utils";

const zoomDurationEpsilonSeconds = 0.001;

interface EditorTimelineZoomControlState {
  hasSelectedClip: boolean;
  isZoomInDisabled: boolean;
  isZoomOutDisabled: boolean;
  isZoomInAtBoundary: boolean;
  isZoomOutAtBoundary: boolean;
  nextZoomIn: number;
  nextZoomOut: number;
}

function createZoomTooltip(input: {
  boundaryLabel: string;
  hasSelectedClip: boolean;
  isAtBoundary: boolean;
  label: string;
}): string {
  if (!input.hasSelectedClip) {
    return "Select a timeline clip before zooming";
  }
  if (input.isAtBoundary) {
    return input.boundaryLabel;
  }

  return input.label;
}

function resolveEditorTimelineZoomControlState(input: {
  project: EditorProject | null;
  selectedClipId: string | null;
  zoom: number;
}): EditorTimelineZoomControlState {
  const zoom = clampEditorZoom(input.zoom);
  const nextZoomOut = clampEditorZoom(zoom - editorZoomStep);
  const nextZoomIn = clampEditorZoom(zoom + editorZoomStep);
  const selectedClip = resolveSelectedTimelineClip(
    input.project,
    input.selectedClipId,
  );

  if (!input.project || !selectedClip) {
    return {
      hasSelectedClip: false,
      isZoomInAtBoundary: false,
      isZoomInDisabled: true,
      isZoomOutAtBoundary: false,
      isZoomOutDisabled: true,
      nextZoomIn,
      nextZoomOut,
    };
  }

  const currentVisibleDuration = resolveVisibleTimelineDuration({
    project: input.project,
    zoom,
  });
  const zoomOutVisibleDuration = resolveVisibleTimelineDuration({
    project: input.project,
    zoom: nextZoomOut,
  });
  const zoomInVisibleDuration = resolveVisibleTimelineDuration({
    project: input.project,
    zoom: nextZoomIn,
  });
  const isZoomOutAtBoundary =
    zoom === nextZoomOut ||
    areVisibleDurationsEqual(currentVisibleDuration, zoomOutVisibleDuration);
  const isZoomInAtBoundary =
    zoom === nextZoomIn ||
    areVisibleDurationsEqual(currentVisibleDuration, zoomInVisibleDuration);

  return {
    hasSelectedClip: true,
    isZoomInAtBoundary,
    isZoomInDisabled: isZoomInAtBoundary,
    isZoomOutAtBoundary,
    isZoomOutDisabled: isZoomOutAtBoundary,
    nextZoomIn,
    nextZoomOut,
  };
}

function clampEditorZoom(zoom: number): number {
  return Math.min(Math.max(zoom, editorMinZoom), editorMaxZoom);
}

function resolveSelectedTimelineClip(
  project: EditorProject | null,
  selectedClipId: string | null,
): EditorTimelineClip | null {
  if (!project || !selectedClipId) {
    return null;
  }

  return (
    project.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === selectedClipId) ?? null
  );
}

function resolveVisibleTimelineDuration(input: {
  project: EditorProject;
  zoom: number;
}): number {
  return calculateExpandableTimelineDuration({
    projectDurationSeconds: input.project.durationSeconds,
    zoom: input.zoom,
  });
}

function areVisibleDurationsEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= zoomDurationEpsilonSeconds;
}

export { createZoomTooltip, resolveEditorTimelineZoomControlState };
