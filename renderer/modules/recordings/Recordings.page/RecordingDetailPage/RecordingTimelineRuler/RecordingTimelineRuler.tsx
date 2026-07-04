import clsx from "clsx";
import { Fragment } from "react";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import {
  bookmarkCategoryLabels,
  bookmarkCategoryTimelineClassNames,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";

import {
  calculateRecordingTimelinePercent,
  formatRecordingTimelineMarker,
  formatRecordingTimelineRailLeft,
  formatRecordingTimelineRailWidth,
  formatRecordingTimelineTimestamp,
  resolveRecordingClipTargetRulerSegment,
} from "../RecordingBookmarkTimeline/RecordingBookmarkTimeline.utils";

interface RecordingTimelineRulerProps {
  bookmarks: RecordingBookmark[];
  clipTargetsByBookmarkId?: Record<
    string,
    {
      durationSeconds: number | null;
      targetDurationSeconds: number | null;
      targetId: string;
    }
  >;
  durationSeconds: number;
  markers: number[];
  minorMarkers: number[];
  showDeathMarkers?: boolean;
  showManualMarkers?: boolean;
}

function RecordingTimelineRuler({
  bookmarks,
  clipTargetsByBookmarkId = {},
  durationSeconds,
  markers,
  minorMarkers,
  showDeathMarkers = false,
  showManualMarkers = false,
}: RecordingTimelineRulerProps) {
  const rulerMarkerCategories = new Set([
    ...(showDeathMarkers ? ["death"] : []),
    ...(showManualMarkers ? ["manual"] : []),
  ]);
  const rulerMarkerBookmarks = rulerMarkerCategories.size
    ? bookmarks.filter(
        (bookmark) =>
          rulerMarkerCategories.has(bookmark.category) &&
          typeof bookmark.offsetSeconds === "number" &&
          Number.isFinite(bookmark.offsetSeconds),
      )
    : [];

  return (
    <div
      className="relative border-base-content/10 border-b bg-base-200"
      data-recording-timeline-zone="true"
    >
      {bookmarks.map((bookmark) => {
        const clipTarget = clipTargetsByBookmarkId[bookmark.id];
        if (clipTarget) {
          const segment = resolveRecordingClipTargetRulerSegment({
            durationSeconds: clipTarget.durationSeconds,
            offsetSeconds: bookmark.offsetSeconds,
            targetDurationSeconds: clipTarget.targetDurationSeconds,
          });

          if (!segment) {
            return null;
          }

          const eventLeft = calculateRecordingTimelinePercent(
            segment.startSeconds,
            durationSeconds,
          );
          const eventWidth = calculateRecordingTimelinePercent(
            segment.eventDurationSeconds,
            durationSeconds,
          );
          const tailLeft = calculateRecordingTimelinePercent(
            segment.triggerSeconds,
            durationSeconds,
          );
          const tailWidth = calculateRecordingTimelinePercent(
            segment.tailDurationSeconds,
            durationSeconds,
          );

          return (
            <Fragment key={`ruler-${bookmark.id}`}>
              {segment.eventDurationSeconds > 0 && (
                <span
                  className={clsx(
                    "pointer-events-none absolute inset-y-0 z-20 border-base-content/10 border-x opacity-40",
                    bookmarkCategoryTimelineClassNames[bookmark.category],
                  )}
                  title={`${bookmarkCategoryLabels[bookmark.category]} - ${
                    bookmark.label
                  }`}
                  style={{
                    left: formatRecordingTimelineRailLeft(eventLeft),
                    width: formatRecordingTimelineRailWidth(
                      Math.max(eventWidth, 0.2),
                    ),
                  }}
                />
              )}
              {segment.tailDurationSeconds > 0 && (
                <span
                  className={clsx(
                    "pointer-events-none absolute inset-y-0 z-20 border-base-content/10 border-r opacity-50",
                    bookmarkCategoryTimelineClassNames[bookmark.category],
                  )}
                  title={`${
                    bookmarkCategoryLabels[bookmark.category]
                  } processing tail - ${bookmark.label}`}
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, rgba(255,255,255,0.24) 0 3px, transparent 3px 8px)",
                    left: formatRecordingTimelineRailLeft(tailLeft),
                    width: formatRecordingTimelineRailWidth(
                      Math.max(tailWidth, 0.2),
                    ),
                  }}
                />
              )}
            </Fragment>
          );
        }

        const segmentDurationSeconds = bookmark.durationSeconds;
        if (segmentDurationSeconds === null || segmentDurationSeconds <= 0) {
          return null;
        }

        const segmentStartSeconds = bookmark.offsetSeconds;

        const left = calculateRecordingTimelinePercent(
          segmentStartSeconds,
          durationSeconds,
        );
        const width = calculateRecordingTimelinePercent(
          segmentDurationSeconds,
          durationSeconds,
        );

        return (
          <span
            aria-hidden="true"
            className={clsx(
              "pointer-events-none absolute inset-y-0 border-base-content/10 border-x",
              "z-10 opacity-25",
              bookmarkCategoryTimelineClassNames[bookmark.category],
            )}
            key={`ruler-${bookmark.id}`}
            title={`${bookmarkCategoryLabels[bookmark.category]} - ${
              bookmark.label
            }`}
            style={{
              left: formatRecordingTimelineRailLeft(left),
              width: formatRecordingTimelineRailWidth(Math.max(width, 0.2)),
            }}
          />
        );
      })}
      {rulerMarkerBookmarks.map((bookmark) => (
        <span
          aria-hidden="true"
          className={clsx(
            "-translate-x-1/2 pointer-events-none absolute inset-y-0 z-[25] w-0.5 rounded-full shadow-sm",
            bookmarkCategoryTimelineClassNames[bookmark.category],
          )}
          key={`bookmark-ruler-marker-${bookmark.id}`}
          title={`${
            bookmarkCategoryLabels[bookmark.category]
          } at ${formatRecordingTimelineTimestamp(bookmark.offsetSeconds)}`}
          style={{
            left: formatRecordingTimelineRailLeft(
              calculateRecordingTimelinePercent(
                bookmark.offsetSeconds,
                durationSeconds,
              ),
            ),
          }}
        />
      ))}
      {minorMarkers.map((marker) => (
        <span
          aria-hidden="true"
          className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 z-20 h-1 w-1 rounded-full bg-base-content/25"
          key={`minor-${marker}`}
          style={{
            left: formatRecordingTimelineRailLeft(
              calculateRecordingTimelinePercent(marker, durationSeconds),
            ),
          }}
        />
      ))}
      {markers.map((marker) => (
        <span
          className="absolute top-0 z-30 flex h-full items-center text-[10px] text-base-content/45"
          key={marker}
          style={{
            left: formatRecordingTimelineRailLeft(
              calculateRecordingTimelinePercent(marker, durationSeconds),
            ),
          }}
        >
          {formatRecordingTimelineMarker(marker)}
        </span>
      ))}
    </div>
  );
}

export { RecordingTimelineRuler };
