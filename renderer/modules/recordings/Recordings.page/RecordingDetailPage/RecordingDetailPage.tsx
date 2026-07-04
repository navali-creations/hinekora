import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import {
  formatBytes,
  formatDurationSeconds,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useMediaPlayback } from "~/renderer/modules/media-playback/useMediaPlayback/useMediaPlayback";

import { RecordingBookmarksPanel } from "./RecordingBookmarksPanel/RecordingBookmarksPanel";
import {
  allRecordingBookmarkCategoriesValue,
  recordingBookmarksPanelPageSize,
} from "./RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { RecordingBookmarkTimeline } from "./RecordingBookmarkTimeline/RecordingBookmarkTimeline";
import { RecordingDetailPageActions } from "./RecordingDetailPageActions/RecordingDetailPageActions";
import { RecordingDetailPlayer } from "./RecordingDetailPlayer/RecordingDetailPlayer";
import { RecordingDetailStatusAlerts } from "./RecordingDetailStatusAlerts/RecordingDetailStatusAlerts";
import { useRecordingBookmarkFilters } from "./useRecordingBookmarkFilters/useRecordingBookmarkFilters";
import { useRecordingDetailData } from "./useRecordingDetailData/useRecordingDetailData";
import { useRecordingDetailFileActions } from "./useRecordingDetailFileActions/useRecordingDetailFileActions";
import { useRecordingVisualPlaybackPublisher } from "./useRecordingVisualPlaybackPublisher/useRecordingVisualPlaybackPublisher";

interface RecordingDetailPageProps {
  initialPlaybackSeconds?: number | null;
  recordingId: string;
}

function RecordingDetailPage({
  initialPlaybackSeconds = null,
  recordingId,
}: RecordingDetailPageProps) {
  const navigate = useNavigate();
  const appliedInitialPlaybackKeyRef = useRef<string | null>(null);
  const [videoFrameHeightPixels, setVideoFrameHeightPixels] = useState<
    number | null
  >(null);
  const [hoveredBookmark, setHoveredBookmark] =
    useState<RecordingBookmark | null>(null);
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
  const { publishVisualPlaybackTime, subscribeVisualPlaybackTime } =
    useRecordingVisualPlaybackPublisher();

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
  const {
    durationSeconds,
    handleEnded,
    handleLoadedMetadata,
    handlePause,
    handlePlay,
    handleTimeUpdate,
    isPlaying,
    jumpToStart,
    playbackSeconds,
    seekBy,
    seekTo,
    setVolume,
    togglePlayback,
    videoRef,
    volume,
  } = useMediaPlayback({
    fallbackDurationSeconds: recording?.durationSeconds ?? null,
    mediaUrl: state.detail?.mediaUrl ?? null,
    onVisualTimeChange: publishVisualPlaybackTime,
  });
  const canUseFileActions = Boolean(
    recording?.exists && state.detail?.mediaUrl,
  );

  const handleSelectBookmark = (bookmark: RecordingBookmark) => {
    bookmarkFilters.markInteracted();
    seekTo(bookmark.offsetSeconds ?? 0);
  };

  const handleSeekBackward = () => {
    seekBy(-5);
  };

  const handleSeekForward = () => {
    seekBy(5);
  };

  useEffect(() => {
    if (!state.detail || initialPlaybackSeconds === null) {
      return;
    }
    if (initialPlaybackSeconds > 0 && durationSeconds <= 0) {
      return;
    }

    const seekKey = `${recordingId}:${initialPlaybackSeconds}`;
    if (appliedInitialPlaybackKeyRef.current === seekKey) {
      return;
    }

    appliedInitialPlaybackKeyRef.current = seekKey;
    seekTo(initialPlaybackSeconds);
  }, [
    durationSeconds,
    initialPlaybackSeconds,
    recordingId,
    seekTo,
    state.detail,
  ]);

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
              bookmarks={latestBookmarks}
              categories={bookmarkFilters.categories}
              categoryFilter={bookmarkFilters.categoryFilter}
              heightPixels={videoFrameHeightPixels}
              isTimelineTruncated={
                state.bookmarksPage?.timelineItemsTruncated ?? false
              }
              pageCount={state.bookmarksPage?.pageCount ?? 1}
              pageIndex={state.bookmarksPage?.pageIndex ?? 0}
              totalCount={state.bookmarksPage?.totalCount ?? 0}
              onCategoryChange={bookmarkFilters.selectCategory}
              onHoverBookmark={setHoveredBookmark}
              onNextPage={bookmarkFilters.nextPage}
              onPreviousPage={bookmarkFilters.previousPage}
              onSelectBookmark={handleSelectBookmark}
            />
            <RecordingDetailPlayer
              emptyDescription="The recording record exists, but the video file is missing or unavailable."
              emptyTitle="Recording video unavailable"
              mediaUrl={state.detail.mediaUrl}
              title={recording.fileName}
              videoRef={videoRef}
              onEnded={handleEnded}
              onFrameHeightChange={setVideoFrameHeightPixels}
              onLoadedMetadata={handleLoadedMetadata}
              onPause={handlePause}
              onPlay={handlePlay}
              onTimeUpdate={handleTimeUpdate}
            />
            <div className="min-h-0 lg:col-span-2">
              <RecordingBookmarkTimeline
                bookmarks={timelineBookmarks}
                durationSeconds={durationSeconds}
                highlightDeathsInRuler={true}
                highlightManualsInRuler={true}
                hoveredBookmark={hoveredBookmark}
                isPlaying={isPlaying}
                markerBookmarks={bookmarkFilters.markerBookmarks}
                mediaUrl={state.detail.mediaUrl}
                playbackSeconds={playbackSeconds}
                showBookmarkMarkers={
                  bookmarkFilters.hasInteracted ||
                  bookmarkFilters.categoryFilter !==
                    allRecordingBookmarkCategoriesValue
                }
                subscribeVisualPlaybackTime={subscribeVisualPlaybackTime}
                volume={volume}
                onJumpToStart={jumpToStart}
                onSeek={seekTo}
                onSeekBackward={handleSeekBackward}
                onSeekForward={handleSeekForward}
                onTogglePlayback={togglePlayback}
                onVolumeChange={setVolume}
              />
            </div>
          </div>
        )}
      </PageContent>
    </PageContainer>
  );
}

export { RecordingDetailPage };
