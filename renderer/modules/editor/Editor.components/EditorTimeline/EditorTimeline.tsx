import clsx from "clsx";
import { useRef } from "react";

import { useEditorShallow } from "~/renderer/store";

import { useEditorTimelineDrag } from "../../Editor.hooks/useEditorTimelineDrag/useEditorTimelineDrag";
import { useEditorTimelinePlaybackScroll } from "../../Editor.hooks/useEditorTimelinePlaybackScroll/useEditorTimelinePlaybackScroll";
import { EditorTimelineBookmarkLayer } from "../EditorTimelineBookmarkLayer/EditorTimelineBookmarkLayer";
import { EditorTimelineClipDragPreview } from "../EditorTimelineClipDragPreview/EditorTimelineClipDragPreview";
import { EditorTimelineControlsRow } from "../EditorTimelineControlsRow/EditorTimelineControlsRow";
import { EditorTimelineGap } from "../EditorTimelineGap/EditorTimelineGap";
import { EditorTimelineHoverMarker } from "../EditorTimelineHoverMarker/EditorTimelineHoverMarker";
import { EditorTimelinePlayhead } from "../EditorTimelinePlayhead/EditorTimelinePlayhead";
import { EditorTimelineRuler } from "../EditorTimelineRuler/EditorTimelineRuler";
import { EditorTimelineVideoTrack } from "../EditorTimelineVideoTrack/EditorTimelineVideoTrack";
import {
  type EditorTimelineBookmarks,
  editorTimelinePlaybackFollowPaddingPixels,
  editorTimelineRailPaddingPixels,
  formatEditorTimelineRailLeft,
  resolveEditorTimelineDragPreviewState,
  resolveEditorTimelineModel,
  resolveEditorTimelineUseCompactTrimHandles,
  resolveEditorTimelineVisibleDuration,
} from "./EditorTimeline.utils";
import { useEditorTimelineGridWidth } from "./useEditorTimelineGridWidth";
import { useEditorTimelineInteraction } from "./useEditorTimelineInteraction/useEditorTimelineInteraction";

function EditorTimeline({
  bookmarks,
}: {
  bookmarks?: EditorTimelineBookmarks;
}) {
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const {
    isPreviewPlaying,
    isProcessing,
    isTimelineFitToEdit,
    playbackSeconds,
    project,
    selectedClipId,
    setZoom,
    zoom,
  } = useEditorShallow((editor) => ({
    isPreviewPlaying: editor.isPreviewPlaying,
    isProcessing: editor.clipboardState.status === "copying",
    isTimelineFitToEdit: editor.isTimelineFitToEdit,
    playbackSeconds: editor.playbackSeconds,
    project: editor.project,
    selectedClipId: editor.selectedClipId,
    setZoom: editor.setZoom,
    zoom: editor.zoom,
  }));
  const baseVisibleDurationSeconds = resolveEditorTimelineVisibleDuration({
    isTimelineFitToEdit,
    project,
  });
  const {
    activeTrimVisibleDurationSeconds,
    activeTimelineMarkerKind,
    activeTimelineMarkerSeconds,
    clipDragPreview,
    handleTimelinePointerDown,
    handleTimelinePointerEnd,
    handleTimelinePointerMove,
    timelineGridRef,
  } = useEditorTimelineDrag({
    railPaddingPixels: editorTimelineRailPaddingPixels,
    visibleDurationSeconds: baseVisibleDurationSeconds,
  });
  const {
    gaps,
    markers,
    minorMarkers,
    selectedClipRulerLeft,
    selectedClipRulerWidth,
    timelineWidthPercent,
    videoTracks,
    visibleDurationSeconds,
  } = resolveEditorTimelineModel({
    isTimelineFitToEdit,
    minimumVisibleDurationSeconds: activeTrimVisibleDurationSeconds,
    project,
    selectedClipId,
    zoom,
  });
  const timelineGridWidthPixels = useEditorTimelineGridWidth(timelineGridRef);
  const timelineRailWidthPixels = Math.max(
    0,
    timelineGridWidthPixels - editorTimelineRailPaddingPixels * 2,
  );
  const useCompactTrimHandles = resolveEditorTimelineUseCompactTrimHandles({
    railPaddingPixels: editorTimelineRailPaddingPixels,
    timelineGridWidthPixels,
    videoTracks,
    visibleDurationSeconds,
  });
  const { dragPreviewClip, dragPreviewSnapLeft } =
    resolveEditorTimelineDragPreviewState({
      clipDragPreview,
      videoTracks,
      visibleDurationSeconds,
    });

  useEditorTimelinePlaybackScroll({
    isPreviewPlaying,
    paddingPixels: editorTimelinePlaybackFollowPaddingPixels,
    playbackSeconds,
    railPaddingPixels: editorTimelineRailPaddingPixels,
    scrollContainerRef: timelineScrollRef,
    timelineGridRef,
    visibleDurationSeconds,
  });
  const {
    handleTimelineLeave,
    handleTimelineMove,
    handleTimelinePointerDownGuarded,
    handleTimelineWheel,
    hoverSeconds,
  } = useEditorTimelineInteraction({
    handleTimelinePointerDown,
    handleTimelinePointerMove,
    isProcessing,
    isTimelineFitToEdit,
    setZoom,
    timelineGridRef,
    visibleDurationSeconds,
    zoom,
  });
  const passiveBookmarkMarkerSeconds =
    bookmarks?.pinnedBookmark === undefined
      ? (bookmarks?.hoveredBookmark?.offsetSeconds ?? null)
      : (bookmarks.pinnedBookmark?.offsetSeconds ?? null);

  const markerSeconds =
    activeTimelineMarkerKind === "playhead"
      ? null
      : (activeTimelineMarkerSeconds ??
        hoverSeconds ??
        passiveBookmarkMarkerSeconds ??
        null);

  return (
    <section
      className="col-span-full flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-200"
      data-onboarding="editor-timeline"
    >
      <EditorTimelineControlsRow />

      <div
        className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3"
        data-timeline-scroll="true"
        ref={timelineScrollRef}
        onWheel={handleTimelineWheel}
      >
        <div
          aria-disabled={isProcessing}
          className={clsx(
            "relative grid h-full min-w-full touch-none select-none grid-cols-[minmax(0,1fr)] grid-rows-[22px_42px] auto-rows-[72px] overflow-hidden rounded-md border border-base-content/10 bg-base-300 transition-opacity",
            isProcessing && "pointer-events-none opacity-60",
          )}
          data-timeline-grid="true"
          ref={timelineGridRef}
          style={{ width: `${timelineWidthPercent}%` }}
          onPointerCancel={handleTimelinePointerEnd}
          onPointerLeave={handleTimelineLeave}
          onPointerDown={handleTimelinePointerDownGuarded}
          onPointerMove={handleTimelineMove}
          onPointerUp={handleTimelinePointerEnd}
        >
          <EditorTimelineRuler
            markers={markers}
            minorMarkers={minorMarkers}
            railPaddingPixels={editorTimelineRailPaddingPixels}
            selectedClipRulerLeft={selectedClipRulerLeft}
            selectedClipRulerWidth={selectedClipRulerWidth}
            visibleDurationSeconds={visibleDurationSeconds}
          />
          <div
            className="relative border-base-content/10 border-b bg-base-300"
            data-timeline-marker-zone="true"
          />

          {gaps.map((gap) => (
            <EditorTimelineGap
              gap={gap}
              key={gap.id}
              railPaddingPixels={editorTimelineRailPaddingPixels}
              visibleDurationSeconds={visibleDurationSeconds}
            />
          ))}

          {videoTracks.map((track) => (
            <EditorTimelineVideoTrack
              dragPreviewClipId={clipDragPreview?.clipId ?? null}
              key={track.id}
              railPaddingPixels={editorTimelineRailPaddingPixels}
              timelineRailWidthPixels={timelineRailWidthPixels}
              track={track}
              useCompactTrimHandles={useCompactTrimHandles}
              visibleDurationSeconds={visibleDurationSeconds}
            />
          ))}
          {dragPreviewSnapLeft !== null && (
            <span
              className="pointer-events-none absolute top-0 bottom-0 z-40 w-px bg-primary shadow-[0_0_0_1px_rgba(168,85,247,0.55),0_0_18px_rgba(168,85,247,0.65)]"
              style={{
                left: formatEditorTimelineRailLeft(
                  dragPreviewSnapLeft,
                  editorTimelineRailPaddingPixels,
                ),
              }}
            />
          )}
          {clipDragPreview && dragPreviewClip && (
            <EditorTimelineClipDragPreview
              clip={dragPreviewClip}
              heightPixels={clipDragPreview.heightPixels}
              railPaddingPixels={editorTimelineRailPaddingPixels}
              startSeconds={clipDragPreview.startSeconds}
              topPixels={clipDragPreview.topPixels}
              visibleDurationSeconds={visibleDurationSeconds}
            />
          )}
          <EditorTimelineBookmarkLayer
            bookmarks={bookmarks}
            visibleDurationSeconds={visibleDurationSeconds}
          />
          <EditorTimelinePlayhead
            railPaddingPixels={editorTimelineRailPaddingPixels}
            visibleDurationSeconds={visibleDurationSeconds}
          />
          <EditorTimelineHoverMarker
            hoverSeconds={markerSeconds}
            railPaddingPixels={editorTimelineRailPaddingPixels}
            visibleDurationSeconds={visibleDurationSeconds}
          />
        </div>
      </div>
    </section>
  );
}

export type { EditorTimelineBookmarks };
export { EditorTimeline };
