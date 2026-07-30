import { useEffect } from "react";

import { useRewindsShallow } from "~/renderer/store";

import { useRewindBookmarkPanelState } from "../useRewindBookmarkPanelState/useRewindBookmarkPanelState";
import { useRewindClipPreview } from "../useRewindClipPreview/useRewindClipPreview";
import { useRewindTimelineData } from "../useRewindTimelineData/useRewindTimelineData";
import { useRewindTimelineDerivedState } from "../useRewindTimelineDerivedState/useRewindTimelineDerivedState";
import { useRewindTimelinePlayback } from "../useRewindTimelinePlayback/useRewindTimelinePlayback";

interface UseRewindDetailTimelineInput {
  initialPlaybackSeconds?: number | null;
  rewindId: string;
}

function useRewindDetailTimeline({
  initialPlaybackSeconds = null,
  rewindId,
}: UseRewindDetailTimelineInput) {
  const state = useRewindTimelineData(rewindId);
  const { resetDetail, timelineMarkerCategoryFilter } = useRewindsShallow(
    (rewinds) => ({
      resetDetail: rewinds.resetDetail,
      timelineMarkerCategoryFilter: rewinds.detail.timelineMarkerCategoryFilter,
    }),
  );
  const {
    clipPreviewState,
    mediaUrl,
    playback,
    selectClip,
    selectedClipId,
    subscribeVisualPlaybackTime,
  } = useRewindClipPreview();
  useEffect(() => {
    if (!rewindId) {
      return;
    }

    resetDetail();
  }, [resetDetail, rewindId]);

  const {
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
  const {
    bookmarkCategories,
    categoryCounts,
    bookmarkPageCount,
    bookmarkPanelItems,
    bookmarkTotalCount,
  } = useRewindBookmarkPanelState(rewindId);
  const isTimelineTruncated =
    (state.timeline?.bookmarkTimelineItemsTruncated ?? false) ||
    (state.timeline?.clipTimelineItemsTruncated ?? false);

  const {
    handleClipTargetSelect,
    handleJumpToStart,
    handleSeek,
    handleSeekBackward,
    handleSeekForward,
    handleSelectBookmark,
    handleVolumeChange,
    playbackSeconds,
  } = useRewindTimelinePlayback({
    durationSeconds,
    initialPlaybackSeconds,
    mediaUrl,
    playback,
    rewindId,
    selectClip,
    selectedClipSegment,
    selectedClipTarget,
    timeline: state.timeline,
    visualPlaybackOffsetSeconds,
  });

  return {
    bookmarkCategories,
    categoryCounts,
    bookmarkPageCount,
    bookmarkPanelItems,
    bookmarkTotalCount,
    bookmarks,
    clipPreviewState,
    clipTargetsByBookmarkId,
    durationSeconds,
    handleClipTargetSelect,
    handleJumpToStart,
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
