import { type PointerEvent, useState } from "react";

import { useEditorShallow } from "~/renderer/store";

import { useEditorTimelineDrag } from "../../Editor.hooks/useEditorTimelineDrag/useEditorTimelineDrag";
import {
  calculateExpandableTimelineDuration,
  calculateTimelineGaps,
  calculateTimelinePercent,
  formatEditorTime,
  resolveTimelineSecondsFromClientX,
} from "../../Editor.utils/Editor.utils";
import { EditorPlaybackControls } from "../EditorPlaybackControls/EditorPlaybackControls";
import { EditorTimelineClipDragPreview } from "../EditorTimelineClipDragPreview/EditorTimelineClipDragPreview";
import { EditorTimelineGap } from "../EditorTimelineGap/EditorTimelineGap";
import { EditorTimelineHoverMarker } from "../EditorTimelineHoverMarker/EditorTimelineHoverMarker";
import { EditorTimelinePlayhead } from "../EditorTimelinePlayhead/EditorTimelinePlayhead";
import { EditorTimelineTools } from "../EditorTimelineTools/EditorTimelineTools";
import { EditorTimelineVideoTrack } from "../EditorTimelineVideoTrack/EditorTimelineVideoTrack";
import { EditorTimelineZoomControls } from "../EditorTimelineZoomControls/EditorTimelineZoomControls";

const timelineLabelColumnWidth = 132;

function EditorTimeline() {
  const [hoverSeconds, setHoverSeconds] = useState<number | null>(null);
  const { project, selectedClipId, zoom } = useEditorShallow((editor) => ({
    project: editor.project,
    selectedClipId: editor.selectedClipId,
    zoom: editor.zoom,
  }));
  const videoTracks =
    project?.tracks.filter((track) => track.kind === "video") ?? [];
  const selectedClip =
    videoTracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === selectedClipId) ?? null;
  const visibleDurationSeconds = calculateExpandableTimelineDuration({
    projectDurationSeconds: project?.durationSeconds ?? 0,
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
    ? calculateTimelineGaps(videoTracks, project.durationSeconds).filter(
        (gap) => gap.startSeconds < visibleDurationSeconds,
      )
    : [];
  const {
    clipDragPreview,
    handleTimelinePointerDown,
    handleTimelinePointerEnd,
    handleTimelinePointerMove,
    timelineGridRef,
  } = useEditorTimelineDrag({
    labelColumnWidth: timelineLabelColumnWidth,
    visibleDurationSeconds,
  });
  const markers = Array.from({ length: 7 }, (_, index) =>
    Math.round((visibleDurationSeconds / 6) * index),
  );
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

  const resolveHoverSeconds = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      !(target instanceof Element) ||
      target.closest(
        "[data-clip-body], [data-trim-edge], [data-playhead-handle], [data-gap-delete-button]",
      ) ||
      !target.closest("[data-timeline-marker-zone], [data-timeline-gap-zone]")
    ) {
      return null;
    }

    const timelineGrid = timelineGridRef.current;
    if (!timelineGrid) {
      return null;
    }

    const bounds = timelineGrid.getBoundingClientRect();
    const timelineLeft = bounds.left + timelineLabelColumnWidth;
    if (event.clientX < timelineLeft || event.clientX > bounds.right) {
      return null;
    }

    return resolveTimelineSecondsFromClientX({
      clientX: event.clientX,
      timelineLeft,
      timelineWidth: bounds.width - timelineLabelColumnWidth,
      visibleDurationSeconds,
    });
  };

  const handleTimelineMove = (event: PointerEvent<HTMLDivElement>) => {
    handleTimelinePointerMove(event);
    setHoverSeconds(resolveHoverSeconds(event));
  };

  const handleTimelineLeave = () => {
    setHoverSeconds(null);
  };

  return (
    <section
      className="col-span-full flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-200"
      data-onboarding="editor-timeline"
    >
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center border-base-content/10 border-b px-3">
        <EditorTimelineTools />
        <EditorPlaybackControls />
        <EditorTimelineZoomControls />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <div
          className="relative grid h-full touch-none select-none grid-cols-[132px_minmax(0,1fr)] grid-rows-[22px_42px_72px] overflow-hidden rounded-md border border-base-content/10 bg-base-300"
          ref={timelineGridRef}
          onPointerCancel={handleTimelinePointerEnd}
          onPointerLeave={handleTimelineLeave}
          onPointerDown={handleTimelinePointerDown}
          onPointerMove={handleTimelineMove}
          onPointerUp={handleTimelinePointerEnd}
        >
          <div className="border-base-content/10 border-r border-b bg-base-200" />
          <div
            className="relative border-base-content/10 border-b bg-base-200"
            data-timeline-marker-zone="true"
          >
            {selectedClipRulerWidth > 0 && (
              <span
                className="pointer-events-none absolute inset-y-0 z-10 border-primary/30 border-x bg-primary/20"
                style={{
                  left: `${selectedClipRulerLeft}%`,
                  width: `${selectedClipRulerWidth}%`,
                }}
              />
            )}
            {markers.map((marker) => (
              <span
                className="absolute top-0 z-20 flex h-full items-center text-[10px] text-base-content/45"
                key={marker}
                style={{
                  left: `${(marker / visibleDurationSeconds) * 100}%`,
                }}
              >
                {formatEditorTime(marker)}
              </span>
            ))}
          </div>
          <div className="border-base-content/10 border-r border-b bg-base-300" />
          <div
            className="relative border-base-content/10 border-b bg-base-300"
            data-timeline-marker-zone="true"
          />

          {gaps.map((gap) => (
            <EditorTimelineGap
              gap={gap}
              key={gap.id}
              labelColumnWidth={timelineLabelColumnWidth}
              visibleDurationSeconds={visibleDurationSeconds}
            />
          ))}

          {videoTracks.map((track) => (
            <EditorTimelineVideoTrack
              dragPreviewClipId={clipDragPreview?.clipId ?? null}
              key={track.id}
              track={track}
              visibleDurationSeconds={visibleDurationSeconds}
            />
          ))}
          {dragPreviewSnapLeft !== null && (
            <span
              className="pointer-events-none absolute top-0 bottom-0 z-40 w-px bg-primary shadow-[0_0_0_1px_rgba(168,85,247,0.55),0_0_18px_rgba(168,85,247,0.65)]"
              style={{
                left: `calc(${timelineLabelColumnWidth}px + (100% - ${timelineLabelColumnWidth}px) * ${
                  dragPreviewSnapLeft / 100
                })`,
              }}
            />
          )}
          {clipDragPreview && dragPreviewClip && (
            <EditorTimelineClipDragPreview
              clip={dragPreviewClip}
              heightPixels={clipDragPreview.heightPixels}
              labelColumnWidth={timelineLabelColumnWidth}
              startSeconds={clipDragPreview.startSeconds}
              topPixels={clipDragPreview.topPixels}
              visibleDurationSeconds={visibleDurationSeconds}
            />
          )}
          <EditorTimelinePlayhead
            labelColumnWidth={timelineLabelColumnWidth}
            visibleDurationSeconds={visibleDurationSeconds}
          />
          <EditorTimelineHoverMarker
            hoverSeconds={hoverSeconds}
            labelColumnWidth={timelineLabelColumnWidth}
            visibleDurationSeconds={visibleDurationSeconds}
          />
        </div>
      </div>
    </section>
  );
}

export { EditorTimeline };
