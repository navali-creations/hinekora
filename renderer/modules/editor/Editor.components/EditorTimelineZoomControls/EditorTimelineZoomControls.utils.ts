import type { EditorProject, EditorTimelineClip } from "~/main/modules/editor";

import {
  editorMaxZoom,
  editorMinZoom,
  editorZoomStep,
} from "../../Editor.slice/Editor.slice.constants";
import {
  calculateEditorTimelineDuration,
  calculateExpandableTimelineDuration,
  calculateTimelineContentScale,
  clampEditorTimelineZoom,
  resolveNextEditorTimelineZoom,
} from "../../Editor.utils/Editor.utils";

const zoomValueEpsilon = 0.001;

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
  isTimelineFitToEdit: boolean;
  project: EditorProject | null;
  selectedClipId: string | null;
  zoom: number;
}): EditorTimelineZoomControlState {
  const zoom = clampEditorTimelineZoom({
    maxZoom: editorMaxZoom,
    minZoom: editorMinZoom,
    zoom: input.zoom,
  });
  const nextZoomOut = resolveNextEditorTimelineZoom({
    direction: -1,
    maxZoom: editorMaxZoom,
    minZoom: editorMinZoom,
    step: editorZoomStep,
    zoom,
  });
  const nextZoomIn = resolveNextEditorTimelineZoom({
    direction: 1,
    maxZoom: editorMaxZoom,
    minZoom: editorMinZoom,
    step: editorZoomStep,
    zoom,
  });
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

  const visibleDuration = calculateExpandableTimelineDuration({
    projectDurationSeconds: calculateEditorTimelineDuration(input.project),
  });
  const currentContentScale = calculateTimelineContentScale({
    visibleDurationSeconds: visibleDuration,
    zoom,
  });
  const zoomOutContentScale = calculateTimelineContentScale({
    visibleDurationSeconds: visibleDuration,
    zoom: nextZoomOut,
  });
  const zoomInContentScale = calculateTimelineContentScale({
    visibleDurationSeconds: visibleDuration,
    zoom: nextZoomIn,
  });
  const isZoomOutAtBoundary =
    zoom === nextZoomOut ||
    areTimelineZoomValuesEqual(currentContentScale, zoomOutContentScale);
  const canZoomOutFromFit = input.isTimelineFitToEdit && zoom === nextZoomOut;
  const isZoomInAtBoundary =
    zoom === nextZoomIn ||
    areTimelineZoomValuesEqual(currentContentScale, zoomInContentScale);

  return {
    hasSelectedClip: true,
    isZoomInAtBoundary,
    isZoomInDisabled: isZoomInAtBoundary,
    isZoomOutAtBoundary: canZoomOutFromFit ? false : isZoomOutAtBoundary,
    isZoomOutDisabled: canZoomOutFromFit ? false : isZoomOutAtBoundary,
    nextZoomIn,
    nextZoomOut,
  };
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

function areTimelineZoomValuesEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= zoomValueEpsilon;
}

export { createZoomTooltip, resolveEditorTimelineZoomControlState };
