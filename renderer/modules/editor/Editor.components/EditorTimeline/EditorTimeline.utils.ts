import type { EditorProject, EditorTimelineTrack } from "~/main/modules/editor";

import {
  editorMaxZoom,
  editorMinZoom,
  editorZoomStep,
} from "../../Editor.slice/Editor.slice.constants";
import {
  calculateEditorTimelineDuration,
  calculateExpandableTimelineDuration,
  calculateFittedTimelineDuration,
  calculateTimelineContentScale,
  calculateTimelineGaps,
  calculateTimelineMarkers,
  calculateTimelineMinorMarkers,
  calculateTimelinePercent,
  resolveNextEditorTimelineZoom,
  resolveTimelineSecondsFromClientX,
  roundToMilliseconds,
} from "../../Editor.utils/Editor.utils";

interface ResolveEditorTimelineHoverSecondsInput {
  clientX: number;
  railPaddingPixels: number;
  target: EventTarget | null;
  timelineGrid: HTMLElement | null;
  visibleDurationSeconds: number;
}

interface ResolveEditorTimelineFollowScrollInput {
  paddingPixels: number;
  playbackSeconds: number;
  railPaddingPixels: number;
  scrollClientWidth: number;
  scrollLeft: number;
  scrollWidth: number;
  timelineGridWidth: number;
  visibleDurationSeconds: number;
}

interface ResolveEditorTimelineModelInput {
  isTimelineFitToEdit: boolean;
  project: EditorProject | null;
  selectedClipId: string | null;
  zoom: number;
}

interface ResolveEditorTimelineTrimHandleModeInput {
  railPaddingPixels: number;
  timelineGridWidthPixels: number;
  videoTracks: Pick<EditorTimelineTrack, "clips">[];
  visibleDurationSeconds: number;
}

interface ResolveEditorTimelineDragPreviewStateInput {
  clipDragPreview: {
    clipId: string;
    snapSeconds?: number | null;
  } | null;
  videoTracks: Pick<EditorTimelineTrack, "clips">[];
  visibleDurationSeconds: number;
}

const editorTimelinePlaybackFollowPaddingPixels = 96;
const editorTimelineRailPaddingPixels = 24;
const fullTrimHandleWidthPixels = 12;
const thumbnailFrameWidthPixels = 56;
const minimumFullTrimHandleClipWidthPixels =
  fullTrimHandleWidthPixels * 2 + thumbnailFrameWidthPixels;

function resolveEditorTimelineHoverSeconds({
  clientX,
  railPaddingPixels,
  target,
  timelineGrid,
  visibleDurationSeconds,
}: ResolveEditorTimelineHoverSecondsInput): number | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const trimHandle = target.closest<HTMLElement>("[data-trim-edge]");
  if (trimHandle) {
    return resolveTrimEdgeHoverSeconds(trimHandle);
  }

  if (
    target.closest(
      "[data-clip-body], [data-playhead-handle], [data-gap-delete-button]",
    ) ||
    !target.closest("[data-timeline-marker-zone], [data-timeline-gap-zone]")
  ) {
    return null;
  }

  if (!timelineGrid) {
    return null;
  }

  const bounds = timelineGrid.getBoundingClientRect();
  const timelineLeft = bounds.left + railPaddingPixels;
  const timelineRight = bounds.right - railPaddingPixels;
  if (clientX < timelineLeft || clientX > timelineRight) {
    return null;
  }

  return resolveTimelineSecondsFromClientX({
    clientX,
    timelineLeft,
    timelineWidth: bounds.width - railPaddingPixels * 2,
    visibleDurationSeconds,
  });
}

function resolveEditorTimelineModel({
  isTimelineFitToEdit,
  project,
  selectedClipId,
  zoom,
}: ResolveEditorTimelineModelInput) {
  const videoTracks =
    project?.tracks.filter((track) => track.kind === "video") ?? [];
  const selectedClip =
    videoTracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === selectedClipId) ?? null;
  const timelineDurationSeconds = calculateEditorTimelineDuration(project);
  const visibleDurationSeconds = isTimelineFitToEdit
    ? calculateFittedTimelineDuration({
        projectDurationSeconds: timelineDurationSeconds,
      })
    : calculateExpandableTimelineDuration({
        projectDurationSeconds: timelineDurationSeconds,
      });
  const timelineContentScale = calculateTimelineContentScale({
    visibleDurationSeconds,
    zoom,
  });
  const selectedClipStartSeconds = selectedClip
    ? Math.max(0, Math.min(selectedClip.startSeconds, visibleDurationSeconds))
    : 0;
  const selectedClipEndSeconds = selectedClip
    ? Math.max(
        selectedClipStartSeconds,
        Math.min(
          selectedClip.startSeconds + selectedClip.durationSeconds,
          visibleDurationSeconds,
        ),
      )
    : 0;
  const selectedClipRulerLeft = calculateTimelinePercent(
    selectedClipStartSeconds,
    visibleDurationSeconds,
  );
  const selectedClipRulerWidth = calculateTimelinePercent(
    selectedClipEndSeconds - selectedClipStartSeconds,
    visibleDurationSeconds,
  );
  const gaps = project
    ? calculateTimelineGaps(videoTracks, timelineDurationSeconds).filter(
        (gap) => gap.startSeconds < visibleDurationSeconds,
      )
    : [];

  return {
    gaps,
    markers: calculateTimelineMarkers({
      contentScale: timelineContentScale,
      visibleDurationSeconds,
    }),
    minorMarkers: calculateTimelineMinorMarkers({
      contentScale: timelineContentScale,
      visibleDurationSeconds,
    }),
    selectedClipRulerLeft,
    selectedClipRulerWidth,
    timelineWidthPercent: roundToMilliseconds(timelineContentScale * 100),
    videoTracks,
    visibleDurationSeconds,
  };
}

function resolveTrimEdgeHoverSeconds(trimHandle: HTMLElement): number | null {
  const clipStartSeconds = Number(trimHandle.dataset.clipStartSeconds);
  const clipDurationSeconds = Number(trimHandle.dataset.clipDurationSeconds);
  const trimEdge = trimHandle.dataset.trimEdge;
  if (
    !Number.isFinite(clipStartSeconds) ||
    !Number.isFinite(clipDurationSeconds) ||
    (trimEdge !== "start" && trimEdge !== "end")
  ) {
    return null;
  }

  return trimEdge === "start"
    ? clipStartSeconds
    : clipStartSeconds + clipDurationSeconds;
}

function resolveEditorTimelineUseCompactTrimHandles({
  railPaddingPixels,
  timelineGridWidthPixels,
  videoTracks,
  visibleDurationSeconds,
}: ResolveEditorTimelineTrimHandleModeInput): boolean {
  const timelineRailWidthPixels =
    timelineGridWidthPixels - railPaddingPixels * 2;
  if (visibleDurationSeconds <= 0) {
    return false;
  }
  if (timelineRailWidthPixels <= 0) {
    return videoTracks.some((track) =>
      track.clips.some((clip) => clip.durationSeconds > 0),
    );
  }

  return videoTracks.some((track) =>
    track.clips.some((clip) => {
      if (clip.durationSeconds <= 0) {
        return false;
      }

      const clipWidthPixels =
        (clip.durationSeconds / visibleDurationSeconds) *
        timelineRailWidthPixels;

      return clipWidthPixels < minimumFullTrimHandleClipWidthPixels;
    }),
  );
}

function resolveEditorTimelineDragPreviewState({
  clipDragPreview,
  videoTracks,
  visibleDurationSeconds,
}: ResolveEditorTimelineDragPreviewStateInput) {
  const dragPreviewClip = clipDragPreview
    ? (videoTracks
        .flatMap((track) => track.clips)
        .find((clip) => clip.id === clipDragPreview.clipId) ?? null)
    : null;
  const dragPreviewSnapLeft =
    clipDragPreview?.snapSeconds === null ||
    clipDragPreview?.snapSeconds === undefined
      ? null
      : calculateTimelinePercent(
          clipDragPreview.snapSeconds,
          visibleDurationSeconds,
        );

  return {
    dragPreviewClip,
    dragPreviewSnapLeft,
  };
}

function resolveEditorTimelineWheelZoom(input: {
  deltaY: number;
  isTimelineFitToEdit: boolean;
  zoom: number;
}): number | null {
  if (input.deltaY === 0) {
    return null;
  }
  if (input.deltaY > 0 && input.isTimelineFitToEdit) {
    return editorMinZoom;
  }

  const nextZoom = resolveNextEditorTimelineZoom({
    direction: input.deltaY < 0 ? 1 : -1,
    maxZoom: editorMaxZoom,
    minZoom: editorMinZoom,
    step: editorZoomStep,
    zoom: input.zoom,
  });

  return nextZoom === input.zoom ? null : nextZoom;
}

function resolveEditorTimelineFollowScroll({
  paddingPixels,
  playbackSeconds,
  railPaddingPixels,
  scrollClientWidth,
  scrollLeft,
  scrollWidth,
  timelineGridWidth,
  visibleDurationSeconds,
}: ResolveEditorTimelineFollowScrollInput): number | null {
  const maxScrollLeft = Math.max(scrollWidth - scrollClientWidth, 0);
  if (
    maxScrollLeft <= 0 ||
    scrollClientWidth <= 0 ||
    timelineGridWidth <= railPaddingPixels * 2 ||
    visibleDurationSeconds <= 0 ||
    !Number.isFinite(playbackSeconds)
  ) {
    return null;
  }

  const timelineWidth = timelineGridWidth - railPaddingPixels * 2;
  const playbackRatio = Math.min(
    Math.max(playbackSeconds / visibleDurationSeconds, 0),
    1,
  );
  const playheadLeft = railPaddingPixels + timelineWidth * playbackRatio;
  const visibleLeft = scrollLeft + railPaddingPixels + paddingPixels;
  const visibleRight = scrollLeft + scrollClientWidth - paddingPixels;

  if (playheadLeft < visibleLeft) {
    return clampScrollLeft(
      playheadLeft - railPaddingPixels - paddingPixels,
      maxScrollLeft,
    );
  }
  if (playheadLeft > visibleRight) {
    return clampScrollLeft(
      playheadLeft - scrollClientWidth + paddingPixels,
      maxScrollLeft,
    );
  }

  return null;
}

function clampScrollLeft(scrollLeft: number, maxScrollLeft: number): number {
  return Math.min(Math.max(Math.round(scrollLeft), 0), maxScrollLeft);
}

function formatEditorTimelineRailLeft(
  percent: number,
  railPaddingPixels: number,
): string {
  if (railPaddingPixels <= 0) {
    return `${percent}%`;
  }

  return `calc(${railPaddingPixels}px + (100% - ${
    railPaddingPixels * 2
  }px) * ${percent / 100})`;
}

function formatEditorTimelineRailWidth(
  percent: number,
  railPaddingPixels: number,
): string {
  if (railPaddingPixels <= 0) {
    return `${percent}%`;
  }

  return `calc((100% - ${railPaddingPixels * 2}px) * ${percent / 100})`;
}

export {
  editorTimelinePlaybackFollowPaddingPixels,
  editorTimelineRailPaddingPixels,
  formatEditorTimelineRailLeft,
  formatEditorTimelineRailWidth,
  resolveEditorTimelineDragPreviewState,
  resolveEditorTimelineFollowScroll,
  resolveEditorTimelineHoverSeconds,
  resolveEditorTimelineModel,
  resolveEditorTimelineUseCompactTrimHandles,
  resolveEditorTimelineWheelZoom,
  resolveTrimEdgeHoverSeconds,
};
