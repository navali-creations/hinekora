import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ActivitySessionClip,
  RecordingBookmark,
} from "~/main/modules/bookmarks";
import {
  allRecordingBookmarkCategoriesValue,
  type RecordingBookmarkCategoryFilter,
  recordingBookmarksPanelPageSize,
} from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { clampRecordingTimelineSeconds } from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingBookmarkTimeline/RecordingBookmarkTimeline.utils";

import {
  defaultRewindTimelineMarkerFilterValue,
  findRewindClipAtSeconds,
  findRewindClipForBookmark,
  type RewindTimelineMarkerCategoryFilter,
  resolveRewindBookmarkSeekSeconds,
  resolveRewindClipLocalSeconds,
  resolveRewindClipSegment,
} from "../RewindDetailPage.utils";
import { useRewindClipPreview } from "../useRewindClipPreview/useRewindClipPreview";
import { useRewindTimelineData } from "../useRewindTimelineData/useRewindTimelineData";
import { useRewindTimelineDerivedState } from "../useRewindTimelineDerivedState/useRewindTimelineDerivedState";

interface UseRewindDetailTimelineInput {
  initialPlaybackSeconds?: number | null;
  rewindId: string;
}

function useRewindDetailTimeline({
  initialPlaybackSeconds = null,
  rewindId,
}: UseRewindDetailTimelineInput) {
  const state = useRewindTimelineData(rewindId);
  const [bookmarkCategoryFilter, setBookmarkCategoryFilter] =
    useState<RecordingBookmarkCategoryFilter>(
      allRecordingBookmarkCategoriesValue,
    );
  const [timelineMarkerCategoryFilter, setTimelineMarkerCategoryFilter] =
    useState<RewindTimelineMarkerCategoryFilter>(
      defaultRewindTimelineMarkerFilterValue,
    );
  const [bookmarkPageIndex, setBookmarkPageIndex] = useState(0);
  const initialClipAppliedRef = useRef<string | null>(null);
  const {
    clipPreviewState,
    mediaUrl,
    playback,
    selectClip,
    selectedClipId,
    subscribeVisualPlaybackTime,
  } = useRewindClipPreview();
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  useEffect(() => {
    if (!rewindId) {
      return;
    }

    setBookmarkCategoryFilter(allRecordingBookmarkCategoriesValue);
    setTimelineMarkerCategoryFilter(defaultRewindTimelineMarkerFilterValue);
    setBookmarkPageIndex(0);
    setPlaybackSeconds(0);
    initialClipAppliedRef.current = null;
    selectClip(null);
  }, [rewindId, selectClip]);

  const {
    bookmarkCategories,
    bookmarks,
    clipTargetsByBookmarkId,
    durationSeconds,
    markerBookmarks,
    selectedClipSegment,
    selectedClipTarget,
    visualPlaybackOffsetSeconds,
  } = useRewindTimelineDerivedState({
    selectedClipId,
    timeline: state.timeline,
    timelineMarkerCategoryFilter,
  });
  const isTimelineTruncated =
    (state.timeline?.bookmarkTimelineItemsTruncated ?? false) ||
    (state.timeline?.clipTimelineItemsTruncated ?? false);
  const filteredPanelBookmarks = useMemo(() => {
    const filteredBookmarks =
      bookmarkCategoryFilter === allRecordingBookmarkCategoriesValue
        ? bookmarks
        : bookmarks.filter(
            (bookmark) => bookmark.category === bookmarkCategoryFilter,
          );

    return [...filteredBookmarks].sort(
      (left, right) => (right.offsetSeconds ?? 0) - (left.offsetSeconds ?? 0),
    );
  }, [bookmarkCategoryFilter, bookmarks]);
  const bookmarkPageCount = Math.max(
    1,
    Math.ceil(filteredPanelBookmarks.length / recordingBookmarksPanelPageSize),
  );
  const clampedBookmarkPageIndex = Math.min(
    bookmarkPageIndex,
    bookmarkPageCount - 1,
  );
  const bookmarkPanelItems = useMemo(() => {
    const startIndex =
      clampedBookmarkPageIndex * recordingBookmarksPanelPageSize;

    return filteredPanelBookmarks.slice(
      startIndex,
      startIndex + recordingBookmarksPanelPageSize,
    );
  }, [clampedBookmarkPageIndex, filteredPanelBookmarks]);

  useEffect(() => {
    if (bookmarkPageIndex !== clampedBookmarkPageIndex) {
      setBookmarkPageIndex(clampedBookmarkPageIndex);
    }
  }, [bookmarkPageIndex, clampedBookmarkPageIndex]);

  useEffect(() => {
    if (!state.timeline) {
      return;
    }

    const initialKey = `${rewindId}:${initialPlaybackSeconds ?? "first-clip"}`;
    if (initialClipAppliedRef.current === initialKey) {
      return;
    }

    initialClipAppliedRef.current = initialKey;
    const firstClip = state.timeline.clips[0] ?? null;
    const initialSeconds =
      initialPlaybackSeconds !== null
        ? clampRecordingTimelineSeconds(initialPlaybackSeconds, durationSeconds)
        : (resolveRewindClipSegment(firstClip)?.startSeconds ?? 0);
    const clipTarget =
      initialPlaybackSeconds !== null
        ? findRewindClipAtSeconds(state.timeline.clips, initialSeconds)
        : firstClip;

    setPlaybackSeconds(initialSeconds);
    if (!clipTarget) {
      selectClip(null);
      return;
    }

    selectClip(clipTarget.targetId, {
      play: false,
      seekSeconds: resolveRewindClipLocalSeconds(clipTarget, initialSeconds),
    });
  }, [
    durationSeconds,
    initialPlaybackSeconds,
    rewindId,
    selectClip,
    state.timeline,
  ]);

  useEffect(() => {
    if (!selectedClipSegment || !mediaUrl) {
      return;
    }

    setPlaybackSeconds(
      clampRecordingTimelineSeconds(
        visualPlaybackOffsetSeconds + playback.playbackSeconds,
        durationSeconds,
      ),
    );
  }, [
    durationSeconds,
    mediaUrl,
    playback.playbackSeconds,
    selectedClipSegment,
    visualPlaybackOffsetSeconds,
  ]);

  const selectRewindClip = (
    clipTarget: ActivitySessionClip,
    timelineSeconds: number,
    options: { play: boolean },
  ) => {
    const clipLocalSeconds = resolveRewindClipLocalSeconds(
      clipTarget,
      timelineSeconds,
    );

    setPlaybackSeconds(timelineSeconds);
    selectClip(clipTarget.targetId, {
      play: options.play,
      seekSeconds: clipLocalSeconds,
    });
  };

  const seekRewindTimeline = (seconds: number, options: { play: boolean }) => {
    const nextSeconds = clampRecordingTimelineSeconds(seconds, durationSeconds);
    const clipTarget = state.timeline
      ? findRewindClipAtSeconds(state.timeline.clips, nextSeconds)
      : null;

    setPlaybackSeconds(nextSeconds);
    if (!clipTarget) {
      selectClip(null);
      return;
    }

    selectRewindClip(clipTarget, nextSeconds, options);
  };

  const handleBookmarkCategoryChange = (
    category: RecordingBookmarkCategoryFilter,
  ) => {
    setBookmarkCategoryFilter(category);
    setTimelineMarkerCategoryFilter(category);
    setBookmarkPageIndex(0);
  };

  const handlePreviousBookmarkPage = () => {
    setBookmarkPageIndex((current) => Math.max(0, current - 1));
  };
  const handleNextBookmarkPage = () => {
    setBookmarkPageIndex((current) =>
      Math.min(bookmarkPageCount - 1, current + 1),
    );
  };

  const handleSelectBookmark = (bookmark: RecordingBookmark) => {
    const timelineClips = state.timeline?.clips ?? [];
    const nextSeconds = resolveRewindBookmarkSeekSeconds({
      bookmark,
      clips: timelineClips,
    });
    const clipTarget =
      findRewindClipForBookmark(timelineClips, bookmark) ??
      findRewindClipAtSeconds(timelineClips, nextSeconds);

    setPlaybackSeconds(nextSeconds);
    if (clipTarget) {
      selectRewindClip(clipTarget, nextSeconds, { play: false });
      return;
    }

    selectClip(null);
  };

  const handleSeek = (seconds: number) => {
    seekRewindTimeline(seconds, { play: true });
  };

  const handleJumpToStart = () => {
    if (selectedClipTarget) {
      selectRewindClip(
        selectedClipTarget,
        selectedClipSegment?.startSeconds ?? 0,
        { play: false },
      );
      return;
    }

    seekRewindTimeline(0, { play: false });
  };

  const handleSeekBackward = () => {
    seekRewindTimeline(playbackSeconds - 5, { play: playback.isPlaying });
  };

  const handleSeekForward = () => {
    seekRewindTimeline(playbackSeconds + 5, { play: playback.isPlaying });
  };

  const handleClipTargetSelect = (clipId: string) => {
    const clipTarget =
      (state.timeline?.clips ?? []).find((clip) => clip.targetId === clipId) ??
      null;

    if (clipTarget) {
      selectRewindClip(
        clipTarget,
        resolveRewindClipSegment(clipTarget)?.startSeconds ?? 0,
        { play: false },
      );
      return;
    }

    selectClip(clipId);
  };

  const handleVolumeChange = (volume: number) => {
    playback.setVolume(volume);
  };

  return {
    bookmarkCategories,
    bookmarkCategoryFilter,
    bookmarkPageCount,
    bookmarkPageIndex,
    bookmarkPanelItems,
    bookmarkTotalCount: filteredPanelBookmarks.length,
    bookmarks,
    clipPreviewState,
    clipTargetsByBookmarkId,
    durationSeconds,
    handleBookmarkCategoryChange,
    handleClipTargetSelect,
    handleJumpToStart,
    handleNextBookmarkPage,
    handlePreviousBookmarkPage,
    handleSeek,
    handleSeekBackward,
    handleSeekForward,
    handleSelectBookmark,
    handleVolumeChange,
    isTimelineTruncated,
    mediaUrl,
    markerBookmarks,
    playback,
    playbackSeconds,
    selectedClipId,
    state,
    subscribeVisualPlaybackTime,
    visualPlaybackOffsetSeconds,
  };
}

export { useRewindDetailTimeline };
