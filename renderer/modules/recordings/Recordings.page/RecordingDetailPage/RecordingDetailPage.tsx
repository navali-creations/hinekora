import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import { RecordingBookmarksPanel } from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel";
import {
  allRecordingBookmarkCategoriesValue,
  recordingBookmarksPanelPageSize,
} from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { RecordingBookmarkTimeline } from "~/renderer/modules/bookmarks/Bookmarks.components/RecordingBookmarkTimeline/RecordingBookmarkTimeline";
import {
  formatBytes,
  formatDurationSeconds,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useBookmarksShallow } from "~/renderer/store";

import { resolveRecordingDetailHighlightedBookmark } from "./RecordingDetailPage.utils";
import { RecordingDetailPageActions } from "./RecordingDetailPageActions/RecordingDetailPageActions";
import { RecordingDetailPlayer } from "./RecordingDetailPlayer/RecordingDetailPlayer";
import { RecordingDetailStatusAlerts } from "./RecordingDetailStatusAlerts/RecordingDetailStatusAlerts";
import { useRecordingBookmarkFilters } from "./useRecordingBookmarkFilters/useRecordingBookmarkFilters";
import { useRecordingDetailData } from "./useRecordingDetailData/useRecordingDetailData";
import { useRecordingDetailFileActions } from "./useRecordingDetailFileActions/useRecordingDetailFileActions";
import { useRecordingDetailPlayback } from "./useRecordingDetailPlayback/useRecordingDetailPlayback";

interface RecordingDetailPageProps {
  initialPlaybackSeconds?: number | null;
  recordingId: string;
}

function RecordingDetailPage({
  initialPlaybackSeconds = null,
  recordingId,
}: RecordingDetailPageProps) {
  const navigate = useNavigate();
  const [videoFrameHeightPixels, setVideoFrameHeightPixels] = useState<
    number | null
  >(null);
  const {
    hoveredBookmarkId,
    selectedBookmarkId,
    setHoveredBookmarkId,
    setSelectedBookmarkId,
  } = useBookmarksShallow((bookmarks) => ({
    hoveredBookmarkId: bookmarks.recordingDetail.hoveredBookmarkId,
    selectedBookmarkId: bookmarks.recordingDetail.selectedBookmarkId,
    setHoveredBookmarkId: bookmarks.setRecordingDetailHoveredBookmarkId,
    setSelectedBookmarkId: bookmarks.setRecordingDetailSelectedBookmarkId,
  }));
  const state = useRecordingDetailData(recordingId);
  const recording = state.detail?.recording ?? null;
  const handleRecordingDeleted = useCallback(() => {
    void navigate({ to: "/recordings" });
  }, [navigate]);
  const {
    fileActionMessage,
    handleDeleteRecording,
    handleOpenLocation,
    resetFileActions,
  } = useRecordingDetailFileActions(recording, {
    onDeleted: handleRecordingDeleted,
  });
  const timelineBookmarks = state.bookmarksPage?.timelineItems ?? [];
  const latestBookmarks = state.bookmarksPage?.items ?? [];
  const bookmarkFilters = useRecordingBookmarkFilters(
    timelineBookmarks,
    state.bookmarksPage?.availableCategories ?? [],
  );
  const highlightedBookmark = useMemo(
    () =>
      resolveRecordingDetailHighlightedBookmark({
        hoveredBookmarkId,
        latestBookmarks,
        selectedBookmarkId,
        timelineBookmarks,
      }),
    [hoveredBookmarkId, latestBookmarks, selectedBookmarkId, timelineBookmarks],
  );
  const playback = useRecordingDetailPlayback({
    detailReady: Boolean(state.detail),
    fallbackDurationSeconds: recording?.durationSeconds ?? null,
    initialPlaybackSeconds,
    mediaUrl: state.detail?.mediaUrl ?? null,
    recordingId,
  });

  useEffect(() => {
    if (!recordingId) {
      return;
    }

    resetFileActions();
    bookmarkFilters.reset();
  }, [bookmarkFilters.reset, recordingId, resetFileActions]);

  useEffect(() => {
    if (!state.detail) {
      return;
    }

    void state.refreshBookmarksPage({
      ...(bookmarkFilters.categoryFilter !== allRecordingBookmarkCategoriesValue
        ? { category: bookmarkFilters.categoryFilter }
        : {}),
      includeTimeline: false,
      pageIndex: bookmarkFilters.pageIndex,
      pageSize: recordingBookmarksPanelPageSize,
    });
  }, [
    bookmarkFilters.categoryFilter,
    bookmarkFilters.pageIndex,
    state.detail,
    state.refreshBookmarksPage,
  ]);
  const canUseFileActions = Boolean(
    recording?.exists && state.detail?.mediaUrl,
  );

  const handleSelectBookmark = (bookmark: RecordingBookmark) => {
    setSelectedBookmarkId(bookmark.id);
    playback.seekTo(bookmark.offsetSeconds ?? 0);
  };

  const handleHoverBookmark = useCallback(
    (bookmark: RecordingBookmark | null) => {
      setHoveredBookmarkId(bookmark?.id ?? null);
    },
    [setHoveredBookmarkId],
  );

  const handleSeekBackward = () => {
    playback.seekBy(-5);
  };

  const handleSeekForward = () => {
    playback.seekBy(5);
  };

  return (
    <PageContainer className="relative gap-4">
      <PageHeader
        title={recording?.fileName ?? "Recording"}
        subtitle={
          recording
            ? `Full recording - ${recording.sourceGame} - ${
                recording.sourceLeague
              } - ${formatDurationSeconds(
                recording.durationSeconds,
              )} - ${formatBytes(recording.sizeBytes)}`
            : "Recording details"
        }
        actions={
          <RecordingDetailPageActions
            canOpenLocation={canUseFileActions}
            recording={recording}
            onDeleteRecording={handleDeleteRecording}
            onOpenLocation={handleOpenLocation}
          />
        }
      />
      <PageContent className="flex min-h-0 flex-col gap-4 !overflow-hidden">
        <RecordingDetailStatusAlerts
          error={state.error}
          fileActionMessage={fileActionMessage}
          hasDetail={Boolean(state.detail)}
          isLoading={state.isLoading}
        />

        {state.detail && recording && (
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_220px] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <RecordingBookmarksPanel
              activeCategoryFilter={
                bookmarkFilters.hasInteracted
                  ? bookmarkFilters.categoryFilter
                  : null
              }
              bookmarks={latestBookmarks}
              categories={bookmarkFilters.categories}
              categoryFilter={bookmarkFilters.categoryFilter}
              emptyMessage="No bookmarks are attached to this recording yet."
              heightPixels={videoFrameHeightPixels}
              isTimelineTruncated={
                state.bookmarksPage?.timelineItemsTruncated ?? false
              }
              pageCount={state.bookmarksPage?.pageCount ?? 1}
              pageIndex={state.bookmarksPage?.pageIndex ?? 0}
              selectedBookmarkId={selectedBookmarkId}
              totalCount={state.bookmarksPage?.totalCount ?? 0}
              onCategoryChange={bookmarkFilters.selectCategory}
              onHoverBookmark={handleHoverBookmark}
              onNextPage={bookmarkFilters.nextPage}
              onPreviousPage={bookmarkFilters.previousPage}
              onSelectBookmark={handleSelectBookmark}
            />
            <RecordingDetailPlayer
              emptyDescription="The recording record exists, but the video file is missing or unavailable."
              emptyTitle="Recording video unavailable"
              mediaUrl={state.detail.mediaUrl}
              title={recording.fileName}
              videoRef={playback.videoRef}
              onEnded={playback.handleEnded}
              onFrameHeightChange={setVideoFrameHeightPixels}
              onLoadedMetadata={playback.handleLoadedMetadata}
              onPause={playback.handlePause}
              onPlay={playback.handlePlay}
              onTimeUpdate={playback.handleTimeUpdate}
            />
            <div className="min-h-0 lg:col-span-2">
              <RecordingBookmarkTimeline
                markers={{
                  bookmarks: timelineBookmarks,
                  highlightDeathsInRuler: true,
                  highlightManualsInRuler: true,
                  hoveredBookmark: highlightedBookmark,
                  markerBookmarks: bookmarkFilters.markerBookmarks,
                  showBookmarkMarkers: bookmarkFilters.hasInteracted,
                }}
                playback={{
                  durationSeconds: playback.durationSeconds,
                  isPlaying: playback.isPlaying,
                  mediaUrl: state.detail.mediaUrl,
                  playbackSeconds: playback.playbackSeconds,
                  subscribeVisualPlaybackTime:
                    playback.subscribeVisualPlaybackTime,
                  volume: playback.volume,
                  onJumpToStart: playback.jumpToStart,
                  onSeek: playback.seekTo,
                  onSeekBackward: handleSeekBackward,
                  onSeekForward: handleSeekForward,
                  onTogglePlayback: playback.togglePlayback,
                  onVolumeChange: playback.setVolume,
                }}
              />
            </div>
          </div>
        )}
      </PageContent>
    </PageContainer>
  );
}

export { RecordingDetailPage };
