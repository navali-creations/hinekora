import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiEdit3 } from "react-icons/fi";

import type {
  RecordingBookmark,
  RecordingBookmarksPage,
} from "~/main/modules/bookmarks";
import type { RunRecordingDetail } from "~/main/modules/recording-storage";
import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import { MediaDetailPageActions } from "~/renderer/modules/media-library/MediaLibrary.components/MediaDetailPageActions/MediaDetailPageActions";

import { RecordingBookmarksPanel } from "./RecordingBookmarksPanel/RecordingBookmarksPanel";
import {
  allRecordingBookmarkCategoriesValue,
  type RecordingBookmarkCategoryFilter,
  resolveRecordingBookmarkCategories,
} from "./RecordingBookmarksPanel/RecordingBookmarksPanel.utils";
import { RecordingBookmarkTimeline } from "./RecordingBookmarkTimeline/RecordingBookmarkTimeline";
import { RecordingDetailPlayer } from "./RecordingDetailPlayer/RecordingDetailPlayer";
import { RecordingDetailStats } from "./RecordingDetailStats/RecordingDetailStats";
import { RecordingDetailStatusAlerts } from "./RecordingDetailStatusAlerts/RecordingDetailStatusAlerts";
import { useRecordingDetailFileActions } from "./useRecordingDetailFileActions/useRecordingDetailFileActions";
import { useRecordingDetailPlayback } from "./useRecordingDetailPlayback/useRecordingDetailPlayback";

interface RecordingDetailPageProps {
  initialPlaybackSeconds?: number | null;
  recordingId: string;
}

interface RecordingDetailState {
  bookmarksPage: RecordingBookmarksPage | null;
  detail: RunRecordingDetail | null;
  error: string | null;
  isLoading: boolean;
}

const initialRecordingDetailState: RecordingDetailState = {
  bookmarksPage: null,
  detail: null,
  error: null,
  isLoading: true,
};

function RecordingDetailPage({
  initialPlaybackSeconds = null,
  recordingId,
}: RecordingDetailPageProps) {
  const [state, setState] = useState<RecordingDetailState>(
    initialRecordingDetailState,
  );
  const appliedInitialPlaybackKeyRef = useRef<string | null>(null);
  const [bookmarkCategoryFilter, setBookmarkCategoryFilter] =
    useState<RecordingBookmarkCategoryFilter>(
      allRecordingBookmarkCategoriesValue,
    );
  const [bookmarkPageIndex, setBookmarkPageIndex] = useState(0);
  const [hasInteractedWithBookmarks, setHasInteractedWithBookmarks] =
    useState(false);
  const [videoFrameHeightPixels, setVideoFrameHeightPixels] = useState<
    number | null
  >(null);
  const recording = state.detail?.recording ?? null;
  const {
    copyState,
    fileActionMessage,
    handleCopyToClipboard,
    handleOpenLocation,
    resetFileActions,
  } = useRecordingDetailFileActions(recording);

  useEffect(() => {
    let isActive = true;
    setState(initialRecordingDetailState);
    resetFileActions();
    setBookmarkPageIndex(0);
    setBookmarkCategoryFilter(allRecordingBookmarkCategoriesValue);
    setHasInteractedWithBookmarks(false);

    Promise.all([
      window.electron.recordingStorage.getRecording(recordingId),
      window.electron.bookmarks.listRecording(recordingId, {
        pageIndex: 0,
        pageSize: 5,
      }),
    ])
      .then(([detail, bookmarksPage]) => {
        if (isActive) {
          setState({ bookmarksPage, detail, error: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState({
            detail: null,
            bookmarksPage: null,
            error: error instanceof Error ? error.message : "Recording failed",
            isLoading: false,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [recordingId, resetFileActions]);

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
  } = useRecordingDetailPlayback({
    fallbackDurationSeconds: recording?.durationSeconds ?? null,
    mediaUrl: state.detail?.mediaUrl ?? null,
  });
  const timelineBookmarks = state.bookmarksPage?.timelineItems ?? [];
  const markerBookmarks = useMemo(
    () =>
      bookmarkCategoryFilter === allRecordingBookmarkCategoriesValue
        ? timelineBookmarks
        : timelineBookmarks.filter(
            (bookmark) => bookmark.category === bookmarkCategoryFilter,
          ),
    [bookmarkCategoryFilter, timelineBookmarks],
  );
  const bookmarkCategories = useMemo(
    () => resolveRecordingBookmarkCategories(timelineBookmarks),
    [timelineBookmarks],
  );
  const canUseFileActions = Boolean(
    recording?.exists && state.detail?.mediaUrl,
  );
  const editAction = recording ? (
    <Link
      className="btn btn-primary btn-sm no-drag"
      search={{ id: recording.id, kind: "recording" }}
      to="/editor"
    >
      <FiEdit3 size={15} />
      Edit
    </Link>
  ) : null;

  const handleBookmarkCategoryChange = (
    category: RecordingBookmarkCategoryFilter,
  ) => {
    setBookmarkCategoryFilter(category);
    setBookmarkPageIndex(0);
    setHasInteractedWithBookmarks(true);
  };

  const handlePreviousBookmarkPage = () => {
    setBookmarkPageIndex((current) => Math.max(0, current - 1));
  };

  const handleNextBookmarkPage = () => {
    setBookmarkPageIndex((current) => current + 1);
  };

  const handleSelectBookmark = (bookmark: RecordingBookmark) => {
    setHasInteractedWithBookmarks(true);
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
    <PageContainer>
      <PageHeader
        title={recording?.fileName ?? "Recording"}
        subtitle={
          recording
            ? `Full recording - ${recording.sourceGame} - ${recording.sourceLeague}`
            : "Recording details"
        }
        actions={
          <MediaDetailPageActions
            canUseFileActions={canUseFileActions}
            copyState={copyState}
            extraAction={editAction}
            fallbackTo="/recordings"
            onCopy={handleCopyToClipboard}
            onOpenLocation={handleOpenLocation}
          />
        }
      />
      <PageContent className="space-y-4">
        <RecordingDetailStatusAlerts
          error={state.error}
          fileActionMessage={fileActionMessage}
          hasDetail={Boolean(state.detail)}
          isLoading={state.isLoading}
        />

        {state.detail && recording && (
          <>
            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <RecordingBookmarksPanel
                bookmarks={timelineBookmarks}
                categories={bookmarkCategories}
                categoryFilter={bookmarkCategoryFilter}
                heightPixels={videoFrameHeightPixels}
                pageIndex={bookmarkPageIndex}
                onCategoryChange={handleBookmarkCategoryChange}
                onNextPage={handleNextBookmarkPage}
                onPreviousPage={handlePreviousBookmarkPage}
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
              <div className="lg:col-span-2">
                <RecordingBookmarkTimeline
                  bookmarks={timelineBookmarks}
                  durationSeconds={durationSeconds}
                  highlightDeathsInRuler={true}
                  highlightManualsInRuler={true}
                  isPlaying={isPlaying}
                  markerBookmarks={markerBookmarks}
                  mediaUrl={state.detail.mediaUrl}
                  playbackSeconds={playbackSeconds}
                  showBookmarkMarkers={
                    hasInteractedWithBookmarks ||
                    bookmarkCategoryFilter !==
                      allRecordingBookmarkCategoriesValue
                  }
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

            <RecordingDetailStats recording={recording} />
          </>
        )}
      </PageContent>
    </PageContainer>
  );
}

export { RecordingDetailPage };
