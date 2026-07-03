import type { PointerEvent, ReactNode } from "react";
import { useRef } from "react";

import type { RecordingBookmark } from "~/main/modules/bookmarks";

import { RecordingBookmarkTimelineMarker } from "../RecordingBookmarkTimelineMarker/RecordingBookmarkTimelineMarker";
import { RecordingPlaybackControls } from "../RecordingPlaybackControls/RecordingPlaybackControls";
import { RecordingTimelineHoverMarker } from "../RecordingTimelineHoverMarker/RecordingTimelineHoverMarker";
import { RecordingTimelinePlayhead } from "../RecordingTimelinePlayhead/RecordingTimelinePlayhead";
import { RecordingTimelineRuler } from "../RecordingTimelineRuler/RecordingTimelineRuler";
import { RecordingTimelineVideoRail } from "../RecordingTimelineVideoRail/RecordingTimelineVideoRail";
import { RecordingVolumeControls } from "../RecordingVolumeControls/RecordingVolumeControls";
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

interface RecordingBookmarkTimelineProps {
  bookmarks: RecordingBookmark[];
  clipTargetsByBookmarkId?: Record<
    string,
    { targetDurationSeconds: number | null; targetId: string }
  >;
  durationSeconds: number | null;
  enableVisualPlaybackSubscription?: boolean;
  highlightDeathsInRuler?: boolean;
  highlightManualsInRuler?: boolean;
  isPlaying: boolean;
  isPlaybackDisabled?: boolean;
  markerBookmarks?: RecordingBookmark[];
  mediaUrl: string | null;
  playbackSeconds: number;
  showBookmarkMarkers?: boolean;
  toolbarStart?: ReactNode;
  visualPlaybackOffsetSeconds?: number;
  volume: number;
  onJumpToStart: () => void;
  onSeek: (seconds: number) => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
  onTogglePlayback: () => void;
  onVolumeChange: (volume: number) => void;
  onClipTargetSelect?: (clipId: string) => void;
}

function RecordingBookmarkTimeline({
  bookmarks,
  clipTargetsByBookmarkId = {},
  durationSeconds,
  enableVisualPlaybackSubscription,
  highlightDeathsInRuler = false,
  highlightManualsInRuler = false,
  isPlaying,
  isPlaybackDisabled,
  markerBookmarks,
  mediaUrl,
  playbackSeconds,
  showBookmarkMarkers = true,
  toolbarStart,
  visualPlaybackOffsetSeconds,
  volume,
  onJumpToStart,
  onSeek,
  onSeekBackward,
  onSeekForward,
  onTogglePlayback,
  onVolumeChange,
  onClipTargetSelect,
}: RecordingBookmarkTimelineProps) {
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
  const markers = calculateRecordingTimelineMarkers(duration);
  const minorMarkers = calculateRecordingTimelineMinorMarkers(duration);
  const isDisabled = duration <= 0 || (isPlaybackDisabled ?? !mediaUrl);
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
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-200">
      <div className="grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-base-content/10 border-b px-3">
        <div className="relative z-10 flex items-center justify-self-start">
          {toolbarStart}
        </div>
        <div className="relative z-10">
          <RecordingPlaybackControls
            durationSeconds={duration}
            isDisabled={isDisabled}
            isPlaying={isPlaying}
            playbackSeconds={playbackSeconds}
            onJumpToStart={onJumpToStart}
            onSeekBackward={onSeekBackward}
            onSeekForward={onSeekForward}
            onTogglePlayback={onTogglePlayback}
          />
        </div>
        <div className="relative z-10 flex items-center justify-self-end">
          <RecordingVolumeControls
            isDisabled={isDisabled}
            volume={volume}
            onVolumeChange={onVolumeChange}
          />
        </div>
      </div>

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
            markers={markers}
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
            mediaUrl={mediaUrl}
            railWidthPixels={timelineRailWidthPixels}
          />

          {showBookmarkMarkers &&
            visibleMarkerBookmarks.map((bookmark) => {
              const clipTarget = clipTargetsByBookmarkId[bookmark.id];

              return (
                <RecordingBookmarkTimelineMarker
                  bookmark={bookmark}
                  durationSeconds={duration}
                  key={bookmark.id}
                  {...(clipTarget ? { clipTargetId: clipTarget.targetId } : {})}
                  {...(onClipTargetSelect ? { onClipTargetSelect } : {})}
                />
              );
            })}
          {bookmarks.length === 0 && (
            <div className="absolute inset-x-6 bottom-3 grid h-16 place-items-center rounded-md border border-base-content/10 border-dashed text-base-content/40 text-xs">
              No bookmarks attached
            </div>
          )}
          <RecordingTimelinePlayhead
            durationSeconds={duration}
            playbackSeconds={playbackSeconds}
            {...(enableVisualPlaybackSubscription !== undefined
              ? { enableVisualPlaybackSubscription }
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
