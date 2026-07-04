import clsx from "clsx";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import { bookmarkCategoryTimelineClassNames } from "~/renderer/modules/bookmarks/Bookmarks.utils";

import {
  calculateRecordingTimelinePercent,
  formatRecordingTimelineRailLeft,
  formatRecordingTimelineRailWidth,
  resolveRecordingClipTargetRulerSegment,
} from "../RecordingBookmarkTimeline/RecordingBookmarkTimeline.utils";

interface RecordingTimelineHoverSegmentProps {
  clipTargetsByBookmarkId?: Record<
    string,
    {
      durationSeconds: number | null;
      targetDurationSeconds: number | null;
      targetId: string;
    }
  >;
  durationSeconds: number;
  hoveredBookmark: RecordingBookmark | null;
}

function RecordingTimelineHoverSegment({
  clipTargetsByBookmarkId = {},
  durationSeconds,
  hoveredBookmark,
}: RecordingTimelineHoverSegmentProps) {
  const clipTarget = hoveredBookmark
    ? clipTargetsByBookmarkId[hoveredBookmark.id]
    : undefined;
  const clipTargetSegment =
    hoveredBookmark && clipTarget
      ? resolveRecordingClipTargetRulerSegment({
          durationSeconds: clipTarget.durationSeconds,
          offsetSeconds: hoveredBookmark.offsetSeconds,
          targetDurationSeconds: clipTarget.targetDurationSeconds,
        })
      : null;
  const startSeconds =
    clipTargetSegment?.startSeconds ??
    (hoveredBookmark?.category !== "manual"
      ? hoveredBookmark?.offsetSeconds
      : null);
  const duration =
    clipTargetSegment !== null
      ? clipTargetSegment.eventDurationSeconds +
        clipTargetSegment.tailDurationSeconds
      : (hoveredBookmark?.durationSeconds ?? null);

  if (
    !hoveredBookmark ||
    typeof startSeconds !== "number" ||
    !Number.isFinite(startSeconds) ||
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return null;
  }

  const left = calculateRecordingTimelinePercent(startSeconds, durationSeconds);
  const width = calculateRecordingTimelinePercent(duration, durationSeconds);

  return (
    <span
      aria-hidden="true"
      className={clsx(
        "pointer-events-none absolute top-0 bottom-0 z-[23] rounded-sm border border-base-content/25 opacity-45",
        bookmarkCategoryTimelineClassNames[hoveredBookmark.category],
      )}
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(255,255,255,0.1) 0 1px, transparent 1px 8px)",
        left: formatRecordingTimelineRailLeft(left),
        width: formatRecordingTimelineRailWidth(Math.max(width, 0.2)),
      }}
    />
  );
}

export { RecordingTimelineHoverSegment };
