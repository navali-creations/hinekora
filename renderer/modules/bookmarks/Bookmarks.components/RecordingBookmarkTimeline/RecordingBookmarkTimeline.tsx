import { type PointerEvent, useRef } from "react";

import { useMediaFrameStepKeyboardShortcuts } from "~/renderer/modules/media-playback/useMediaFrameStepKeyboardShortcuts/useMediaFrameStepKeyboardShortcuts";

import { RecordingBookmarkTimelineToolbar } from "../RecordingBookmarkTimelineToolbar/RecordingBookmarkTimelineToolbar";
import { RecordingTimelineBookmarkMarkers } from "../RecordingTimelineBookmarkMarkers/RecordingTimelineBookmarkMarkers";
import { RecordingTimelineHoverMarker } from "../RecordingTimelineHoverMarker/RecordingTimelineHoverMarker";
import { RecordingTimelinePlayhead } from "../RecordingTimelinePlayhead/RecordingTimelinePlayhead";
import { RecordingTimelineRuler } from "../RecordingTimelineRuler/RecordingTimelineRuler";
import { RecordingTimelineVideoRail } from "../RecordingTimelineVideoRail/RecordingTimelineVideoRail";
import type { RecordingBookmarkTimelineProps } from "./RecordingBookmarkTimeline.types";
import {
  calculateRecordingTimelineMarkers,
  calculateRecordingTimelineMinorMarkers,
  calculateRecordingTimelinePercent,
  formatRecordingTimelineRailLeft,
  formatRecordingTimelineTimestamp,
  recordingTimelineRailPaddingPixels,
  resolveRecordingTimelineSecondsFromClientX,
} from "./RecordingBookmarkTimeline.utils";
import { useRecordingTimelineGridWidth } from "./useRecordingTimelineGridWidth";

function RecordingBookmarkTimeline({
  toolbarStart,
  markers,
  playback,
}: RecordingBookmarkTimelineProps) {
  const {
    bookmarks,
    clipTargetsByBookmarkId = {},
    highlightDeathsInRuler = false,
    highlightManualsInRuler = false,
    hoveredBookmark = null,
    markerBookmarks,
    showBookmarkMarkers = true,
    onClipTargetSelect,
  } = markers;
  const {
    durationSeconds,
    enableVisualPlaybackSubscription,
    frameStep,
    isPlaying,
    isPlaybackDisabled,
    mediaUrl,
    playbackSeconds,
    subscribeVisualPlaybackTime,
    visualPlaybackOffsetSeconds,
    volume,
    onJumpToStart,
    onSeek,
    onSeekBackward,
    onSeekForward,
    onTogglePlayback,
    onVolumeChange,
  } = playback;
  const hoverLabelRef = useRef<HTMLSpanElement>(null);
  const hoverMarkerRef = useRef<HTMLDivElement>(null);
  const timelineGridRef = useRef<HTMLDivElement>(null);
  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : 0;
  const timelineGridWidthPixels =
    useRecordingTimelineGridWidth(timelineGridRef);
  const timelineRailWidthPixels = Math.max(
    0,
    timelineGridWidthPixels - recordingTimelineRailPaddingPixels * 2,
  );
  const timelineMarkers = calculateRecordingTimelineMarkers(duration);
  const minorMarkers = calculateRecordingTimelineMinorMarkers(duration);
  const isDisabled = duration <= 0 || (isPlaybackDisabled ?? !mediaUrl);
  const canStepFrames = !isDisabled && frameStep !== undefined;
  useMediaFrameStepKeyboardShortcuts({
    enabled: canStepFrames,
    focusRegionSelector: '[data-recording-frame-step-shortcuts="true"]',
    ...(frameStep
      ? {
          framesPerSecond: frameStep.framesPerSecond,
          getPlaybackSeconds: frameStep.getPlaybackSeconds,
          onStep: frameStep.onStep,
        }
      : {}),
  });
  const activeVisualPlaybackSubscriber =
    enableVisualPlaybackSubscription === false
      ? undefined
      : subscribeVisualPlaybackTime;
  const visibleMarkerBookmarks = markerBookmarks ?? bookmarks;
  const applyHoverSeconds = (seconds: number | null) => {
    const marker = hoverMarkerRef.current;
    if (!marker) {
      return;
    }

    if (seconds === null) {
      marker.hidden = true;
      return;
    }

    marker.hidden = false;
    marker.style.left = formatRecordingTimelineRailLeft(
      calculateRecordingTimelinePercent(seconds, duration),
    );
    if (hoverLabelRef.current) {
      hoverLabelRef.current.textContent =
        formatRecordingTimelineTimestamp(seconds);
    }
  };

  const handleTimelinePointerMove = (event: PointerEvent) => {
    applyHoverSeconds(
      resolveRecordingTimelineSecondsFromClientX({
        clientX: event.clientX,
        durationSeconds: duration,
        timelineGrid: timelineGridRef.current,
      }),
    );
  };

  const handleTimelinePointerLeave = () => {
    applyHoverSeconds(null);
  };

  const handleTimelinePointerDown = (event: PointerEvent) => {
    const seconds = resolveRecordingTimelineSecondsFromClientX({
      clientX: event.clientX,
      durationSeconds: duration,
      timelineGrid: timelineGridRef.current,
    });

    if (seconds !== null) {
      onSeek(seconds);
    }
  };

  return (
    <section
      aria-label="Recording timeline"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-200"
      data-recording-frame-step-shortcuts={canStepFrames ? "true" : undefined}
      tabIndex={canStepFrames ? 0 : undefined}
    >
      <RecordingBookmarkTimelineToolbar
        durationSeconds={duration}
        isDisabled={isDisabled}
        isPlaying={isPlaying}
        playbackSeconds={playbackSeconds}
        {...(activeVisualPlaybackSubscriber
          ? { subscribeVisualPlaybackTime: activeVisualPlaybackSubscriber }
          : {})}
        toolbarStart={toolbarStart}
        {...(visualPlaybackOffsetSeconds !== undefined
          ? { visualPlaybackOffsetSeconds }
          : {})}
        volume={volume}
        onJumpToStart={onJumpToStart}
        onSeekBackward={onSeekBackward}
        onSeekForward={onSeekForward}
        onTogglePlayback={onTogglePlayback}
        onVolumeChange={onVolumeChange}
      />

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3">
        <div
          className="relative grid min-h-[8.5rem] min-w-full touch-none select-none grid-rows-[22px_42px_72px] overflow-hidden rounded-md border border-base-content/10 bg-base-300"
          data-recording-timeline-grid="true"
          ref={timelineGridRef}
          onPointerDown={handleTimelinePointerDown}
          onPointerLeave={handleTimelinePointerLeave}
          onPointerMove={handleTimelinePointerMove}
        >
          <RecordingTimelineRuler
            bookmarks={bookmarks}
            clipTargetsByBookmarkId={clipTargetsByBookmarkId}
            durationSeconds={duration}
            markers={timelineMarkers}
            minorMarkers={minorMarkers}
            showDeathMarkers={highlightDeathsInRuler}
            showManualMarkers={highlightManualsInRuler}
          />
          <div
            className="relative bg-base-300"
            data-recording-timeline-zone="true"
          />
          <RecordingTimelineVideoRail
            durationSeconds={duration}
            isPlaying={isPlaying}
            mediaUrl={mediaUrl}
            railWidthPixels={timelineRailWidthPixels}
          />
          <RecordingTimelineBookmarkMarkers
            clipTargetsByBookmarkId={clipTargetsByBookmarkId}
            durationSeconds={duration}
            hoveredBookmark={hoveredBookmark}
            markerBookmarks={visibleMarkerBookmarks}
            showBookmarkMarkers={showBookmarkMarkers}
            {...(onClipTargetSelect ? { onClipTargetSelect } : {})}
          />
          {bookmarks.length === 0 && (
            <div className="absolute inset-x-6 bottom-3 grid h-16 place-items-center rounded-md border border-base-content/10 border-dashed text-base-content/40 text-xs">
              No bookmarks attached
            </div>
          )}
          <RecordingTimelinePlayhead
            durationSeconds={duration}
            playbackSeconds={playbackSeconds}
            railWidthPixels={timelineRailWidthPixels}
            {...(activeVisualPlaybackSubscriber
              ? { subscribeVisualPlaybackTime: activeVisualPlaybackSubscriber }
              : {})}
            {...(visualPlaybackOffsetSeconds !== undefined
              ? { visualPlaybackOffsetSeconds }
              : {})}
          />
          <RecordingTimelineHoverMarker
            labelRef={hoverLabelRef}
            markerRef={hoverMarkerRef}
          />
        </div>
      </div>
    </section>
  );
}

export { RecordingBookmarkTimeline };
