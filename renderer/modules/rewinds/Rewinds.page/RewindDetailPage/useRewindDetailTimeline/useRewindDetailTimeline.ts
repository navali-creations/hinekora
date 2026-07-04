import { useEffect, useMemo, useState } from "react";

import type {
  ActivitySessionClip,
  ActivitySessionTimeline,
  RecordingBookmark,
} from "~/main/modules/bookmarks";
import {
  allRecordingBookmarkCategoriesValue,
  type RecordingBookmarkCategoryFilter,
  resolveRecordingBookmarkCategories,
} from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { clampRecordingTimelineSeconds } from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingBookmarkTimeline/RecordingBookmarkTimeline.utils";

import {
  calculateRewindDurationSeconds,
  defaultRewindTimelineMarkerFilterValue,
  filterRewindTimelineMarkerBookmarks,
  findRewindClipAtSeconds,
  findRewindClipForBookmark,
  mapRewindTimelineBookmarks,
  type RewindTimelineMarkerCategoryFilter,
  resolveRewindBookmarkSeekSeconds,
  resolveRewindClipLocalSeconds,
  resolveRewindClipSegment,
  resolveRewindClipVisualOffsetSeconds,
} from "../RewindDetailPage.utils";
import { useRewindClipPreview } from "../useRewindClipPreview/useRewindClipPreview";

interface UseRewindDetailTimelineInput {
  rewindId: string;
}

interface RewindDetailState {
  error: string | null;
  isLoading: boolean;
  timeline: ActivitySessionTimeline | null;
}

const initialRewindDetailState: RewindDetailState = {
  error: null,
  isLoading: true,
  timeline: null,
};

function useRewindDetailTimeline({ rewindId }: UseRewindDetailTimelineInput) {
  const [state, setState] = useState(initialRewindDetailState);
  const [bookmarkCategoryFilter, setBookmarkCategoryFilter] =
    useState<RecordingBookmarkCategoryFilter>(
      allRecordingBookmarkCategoriesValue,
    );
  const [timelineMarkerCategoryFilter, setTimelineMarkerCategoryFilter] =
    useState<RewindTimelineMarkerCategoryFilter>(
      defaultRewindTimelineMarkerFilterValue,
    );
  const [bookmarkPageIndex, setBookmarkPageIndex] = useState(0);
  const { clipPreviewState, mediaUrl, playback, selectClip, selectedClipId } =
    useRewindClipPreview();
  const [playbackSeconds, setPlaybackSeconds] = useState(0);

  useEffect(() => {
    let isActive = true;
    setState(initialRewindDetailState);
    setBookmarkCategoryFilter(allRecordingBookmarkCategoriesValue);
    setTimelineMarkerCategoryFilter(defaultRewindTimelineMarkerFilterValue);
    setBookmarkPageIndex(0);
    setPlaybackSeconds(0);
    selectClip(null);

    window.electron.bookmarks
      .getActivitySessionTimeline(rewindId)
      .then((timeline) => {
        if (isActive) {
          setState({ error: null, isLoading: false, timeline });
          const firstClip = timeline?.clips[0] ?? null;
          const firstClipSegment = resolveRewindClipSegment(firstClip);

          if (firstClip && firstClipSegment) {
            setPlaybackSeconds(firstClipSegment.startSeconds);
            selectClip(firstClip.targetId, {
              play: false,
              seekSeconds: resolveRewindClipLocalSeconds(
                firstClip,
                firstClipSegment.startSeconds,
              ),
            });
          }
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState({
            error: error instanceof Error ? error.message : "Rewind failed",
            isLoading: false,
            timeline: null,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [rewindId, selectClip]);

  const clipTargetsByBookmarkId = useMemo(
    () =>
      Object.fromEntries(
        (state.timeline?.clips ?? [])
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
    [state.timeline?.clips],
  );
  const durationSeconds = useMemo(
    () => calculateRewindDurationSeconds(state.timeline),
    [state.timeline],
  );
  const bookmarks = useMemo<RecordingBookmark[]>(
    () =>
      mapRewindTimelineBookmarks({
        bookmarks: state.timeline?.bookmarks ?? [],
        clipTargetsByBookmarkId,
        durationSeconds,
      }),
    [clipTargetsByBookmarkId, durationSeconds, state.timeline?.bookmarks],
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
      (state.timeline?.clips ?? []).find(
        (clip) => clip.targetId === selectedClipId,
      ) ?? null,
    [selectedClipId, state.timeline?.clips],
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
    setBookmarkPageIndex((current) => current + 1);
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
    bookmarkPageIndex,
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
    mediaUrl,
    markerBookmarks,
    playback,
    playbackSeconds,
    selectedClipId,
    state,
    visualPlaybackOffsetSeconds,
  };
}

export { useRewindDetailTimeline };
