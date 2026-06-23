import { type PointerEvent, useState, type WheelEvent } from "react";

import { useEditorShallow } from "~/renderer/store";

import { useEditorTimelineDrag } from "../../Editor.hooks/useEditorTimelineDrag/useEditorTimelineDrag";
import {
  calculateEditorTimelineDuration,
  calculateExpandableTimelineDuration,
  calculateTimelineContentScale,
  calculateTimelineGaps,
  calculateTimelineMarkers,
  calculateTimelineMinorMarkers,
  calculateTimelinePercent,
  roundToMilliseconds,
} from "../../Editor.utils/Editor.utils";
import { EditorPlaybackControls } from "../EditorPlaybackControls/EditorPlaybackControls";
import { EditorTimelineClipDragPreview } from "../EditorTimelineClipDragPreview/EditorTimelineClipDragPreview";
import { EditorTimelineGap } from "../EditorTimelineGap/EditorTimelineGap";
import { EditorTimelineHoverMarker } from "../EditorTimelineHoverMarker/EditorTimelineHoverMarker";
import { EditorTimelinePlayhead } from "../EditorTimelinePlayhead/EditorTimelinePlayhead";
import { EditorTimelineRuler } from "../EditorTimelineRuler/EditorTimelineRuler";
import { EditorTimelineTools } from "../EditorTimelineTools/EditorTimelineTools";
import { EditorTimelineVideoTrack } from "../EditorTimelineVideoTrack/EditorTimelineVideoTrack";
import { EditorTimelineZoomControls } from "../EditorTimelineZoomControls/EditorTimelineZoomControls";
import {
  resolveEditorTimelineHoverSeconds,
  resolveEditorTimelineWheelZoom,
} from "./EditorTimeline.utils";

const timelineLabelColumnWidth = 132;

function EditorTimeline() {
  const [hoverSeconds, setHoverSeconds] = useState<number | null>(null);
  const { project, selectedClipId, setZoom, zoom } = useEditorShallow(
    (editor) => ({
      project: editor.project,
      selectedClipId: editor.selectedClipId,
      setZoom: editor.setZoom,
      zoom: editor.zoom,
    }),
  );
  const videoTracks =
    project?.tracks.filter((track) => track.kind === "video") ?? [];
  const selectedClip =
    videoTracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === selectedClipId) ?? null;
  const timelineDurationSeconds = calculateEditorTimelineDuration(project);
  const visibleDurationSeconds = calculateExpandableTimelineDuration({
    projectDurationSeconds: timelineDurationSeconds,
  });
  const timelineContentScale = calculateTimelineContentScale({
    visibleDurationSeconds,
    zoom,
  });
  const timelineWidthPercent = roundToMilliseconds(timelineContentScale * 100);
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
    activeTimelineMarkerSeconds,
    clipDragPreview,
    handleTimelinePointerDown,
    handleTimelinePointerEnd,
    handleTimelinePointerMove,
    timelineGridRef,
  } = useEditorTimelineDrag({
    labelColumnWidth: timelineLabelColumnWidth,
    visibleDurationSeconds,
  });
  const markers = calculateTimelineMarkers({
    contentScale: timelineContentScale,
    visibleDurationSeconds,
  });
  const minorMarkers = calculateTimelineMinorMarkers({
    contentScale: timelineContentScale,
    visibleDurationSeconds,
  });
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
    return resolveEditorTimelineHoverSeconds({
      clientX: event.clientX,
      labelColumnWidth: timelineLabelColumnWidth,
      target: event.target,
      timelineGrid: timelineGridRef.current,
      visibleDurationSeconds,
    });
  };

  const handleTimelineWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    const nextZoom = resolveEditorTimelineWheelZoom({
      deltaY: event.deltaY,
      zoom,
    });

    if (nextZoom !== null) {
      setZoom(nextZoom);
    }
  };

  const handleTimelineMove = (event: PointerEvent<HTMLDivElement>) => {
    handleTimelinePointerMove(event);
    setHoverSeconds(resolveHoverSeconds(event));
  };

  const handleTimelineLeave = () => {
    setHoverSeconds(null);
  };

  const markerSeconds = activeTimelineMarkerSeconds ?? hoverSeconds;

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

      <div
        className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3"
        data-timeline-scroll="true"
        onWheel={handleTimelineWheel}
      >
        <div
          className="relative grid h-full min-w-full touch-none select-none grid-cols-[132px_minmax(0,1fr)] grid-rows-[22px_42px_72px] overflow-hidden rounded-md border border-base-content/10 bg-base-300"
          data-timeline-grid="true"
          ref={timelineGridRef}
          style={{ width: `${timelineWidthPercent}%` }}
          onPointerCancel={handleTimelinePointerEnd}
          onPointerLeave={handleTimelineLeave}
          onPointerDown={handleTimelinePointerDown}
          onPointerMove={handleTimelineMove}
          onPointerUp={handleTimelinePointerEnd}
        >
          <div className="sticky left-0 z-30 border-base-content/10 border-r border-b bg-base-200" />
          <EditorTimelineRuler
            markers={markers}
            minorMarkers={minorMarkers}
            selectedClipRulerLeft={selectedClipRulerLeft}
            selectedClipRulerWidth={selectedClipRulerWidth}
            visibleDurationSeconds={visibleDurationSeconds}
          />
          <div className="sticky left-0 z-30 border-base-content/10 border-r border-b bg-base-300" />
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
            hoverSeconds={markerSeconds}
            labelColumnWidth={timelineLabelColumnWidth}
            visibleDurationSeconds={visibleDurationSeconds}
          />
        </div>
      </div>
    </section>
  );
}

export { EditorTimeline };
