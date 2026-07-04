import { useMemo } from "react";

import type {
  ActivitySessionTimeline,
  RecordingBookmark,
} from "~/main/modules/bookmarks";
import { resolveRecordingBookmarkCategories } from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";

import {
  calculateRewindDurationSeconds,
  filterRewindTimelineMarkerBookmarks,
  mapRewindTimelineBookmarks,
  type RewindTimelineMarkerCategoryFilter,
  resolveRewindClipSegment,
  resolveRewindClipVisualOffsetSeconds,
} from "../RewindDetailPage.utils";

interface UseRewindTimelineDerivedStateInput {
  selectedClipId: string | null;
  timeline: ActivitySessionTimeline | null;
  timelineMarkerCategoryFilter: RewindTimelineMarkerCategoryFilter;
}

function useRewindTimelineDerivedState({
  selectedClipId,
  timeline,
  timelineMarkerCategoryFilter,
}: UseRewindTimelineDerivedStateInput) {
  const clipTargetsByBookmarkId = useMemo(
    () =>
      Object.fromEntries(
        (timeline?.clips ?? [])
          .filter((clip) => clip.bookmarkId)
          .map((clip) => [
            clip.bookmarkId as string,
            {
              durationSeconds: clip.durationSeconds,
              targetDurationSeconds: clip.targetDurationSeconds,
              targetId: clip.targetId,
            },
          ]),
      ),
    [timeline?.clips],
  );
  const durationSeconds = useMemo(
    () => calculateRewindDurationSeconds(timeline),
    [timeline],
  );
  const bookmarks = useMemo<RecordingBookmark[]>(
    () =>
      mapRewindTimelineBookmarks({
        bookmarks: timeline?.bookmarks ?? [],
        clipTargetsByBookmarkId,
        durationSeconds,
      }),
    [clipTargetsByBookmarkId, durationSeconds, timeline?.bookmarks],
  );
  const markerBookmarks = useMemo<RecordingBookmark[]>(
    () =>
      filterRewindTimelineMarkerBookmarks({
        bookmarks,
        categoryFilter: timelineMarkerCategoryFilter,
      }),
    [bookmarks, timelineMarkerCategoryFilter],
  );
  const selectedClipTarget = useMemo(
    () =>
      (timeline?.clips ?? []).find(
        (clip) => clip.targetId === selectedClipId,
      ) ?? null,
    [selectedClipId, timeline?.clips],
  );
  const selectedClipSegment = useMemo(
    () => resolveRewindClipSegment(selectedClipTarget),
    [selectedClipTarget],
  );
  const visualPlaybackOffsetSeconds = useMemo(
    () => resolveRewindClipVisualOffsetSeconds(selectedClipTarget),
    [selectedClipTarget],
  );
  const bookmarkCategories = useMemo(
    () => resolveRecordingBookmarkCategories(bookmarks),
    [bookmarks],
  );

  return {
    bookmarkCategories,
    bookmarks,
    clipTargetsByBookmarkId,
    durationSeconds,
    markerBookmarks,
    selectedClipSegment,
    selectedClipTarget,
    visualPlaybackOffsetSeconds,
  };
}

export { useRewindTimelineDerivedState };
