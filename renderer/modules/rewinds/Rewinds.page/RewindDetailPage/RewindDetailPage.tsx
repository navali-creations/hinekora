import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { FiArrowLeft, FiEdit2 } from "react-icons/fi";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import {
  formatDateTime,
  formatDurationSeconds,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { RecordingBookmarksPanel } from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingBookmarksPanel/RecordingBookmarksPanel";
import { RecordingBookmarkTimeline } from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingBookmarkTimeline/RecordingBookmarkTimeline";

import { RewindClipPreview } from "./RewindClipPreview/RewindClipPreview";
import { useRewindDetailTimeline } from "./useRewindDetailTimeline/useRewindDetailTimeline";

interface RewindDetailPageProps {
  initialPlaybackSeconds?: number | null;
  rewindId: string;
}

function RewindDetailPage({
  initialPlaybackSeconds = null,
  rewindId,
}: RewindDetailPageProps) {
  const detail = useRewindDetailTimeline({
    initialPlaybackSeconds,
    rewindId,
  });
  const [hoveredBookmark, setHoveredBookmark] =
    useState<RecordingBookmark | null>(null);
  const session = detail.state.timeline?.session ?? null;

  return (
    <PageContainer>
      <PageHeader
        title={
          session ? `Rewind ${formatDateTime(session.startedAt)}` : "Rewind"
        }
        subtitle={
          session
            ? `${session.sourceGame} - ${
                session.sourceLeague
              } - ${formatDurationSeconds(detail.durationSeconds)}`
            : "Rewind activity session"
        }
        actions={
          <Link className="btn btn-ghost btn-sm no-drag" to="/rewinds">
            <FiArrowLeft size={15} />
            Rewinds
          </Link>
        }
      />
      <PageContent className="space-y-4">
        {(detail.state.isLoading ||
          detail.state.error ||
          !detail.state.timeline) && (
          <div className="rounded-lg border border-base-content/10 bg-base-200 p-4 text-sm">
            {detail.state.isLoading
              ? "Loading rewind..."
              : (detail.state.error ?? "Rewind session was not found.")}
          </div>
        )}

        {detail.state.timeline && (
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <RecordingBookmarksPanel
              bookmarks={detail.bookmarkPanelItems}
              categories={detail.bookmarkCategories}
              categoryFilter={detail.bookmarkCategoryFilter}
              heightPixels={360}
              isTimelineTruncated={detail.isTimelineTruncated}
              pageCount={detail.bookmarkPageCount}
              pageIndex={detail.bookmarkPageIndex}
              totalCount={detail.bookmarkTotalCount}
              onCategoryChange={detail.handleBookmarkCategoryChange}
              onHoverBookmark={setHoveredBookmark}
              onNextPage={detail.handleNextBookmarkPage}
              onPreviousPage={detail.handlePreviousBookmarkPage}
              onSelectBookmark={detail.handleSelectBookmark}
            />
            <section className="flex h-[360px] min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-300">
              <RewindClipPreview
                detail={detail.clipPreviewState.detail}
                error={detail.clipPreviewState.error}
                hasLinkedClips={detail.state.timeline.clips.length > 0}
                isLoading={detail.clipPreviewState.isLoading}
                videoRef={detail.playback.videoRef}
                onEnded={detail.playback.handleEnded}
                onLoadedMetadata={detail.playback.handleLoadedMetadata}
                onPause={detail.playback.handlePause}
                onPlay={detail.playback.handlePlay}
                onTimeUpdate={detail.playback.handleTimeUpdate}
              />
            </section>
            <div className="lg:col-span-2">
              <RecordingBookmarkTimeline
                bookmarks={detail.bookmarks}
                clipTargetsByBookmarkId={detail.clipTargetsByBookmarkId}
                durationSeconds={detail.durationSeconds}
                enableVisualPlaybackSubscription={!!detail.mediaUrl}
                hoveredBookmark={hoveredBookmark}
                isPlaybackDisabled={!detail.mediaUrl}
                isPlaying={detail.playback.isPlaying}
                markerBookmarks={detail.markerBookmarks}
                mediaUrl={null}
                playbackSeconds={detail.playbackSeconds}
                subscribeVisualPlaybackTime={detail.subscribeVisualPlaybackTime}
                toolbarStart={
                  <div
                    aria-label="Rewind tools"
                    className="relative z-30 flex w-fit items-center rounded-md bg-base-300 p-1 shadow-sm"
                    role="toolbar"
                  >
                    {detail.selectedClipId ? (
                      <Link
                        className="btn btn-ghost btn-xs no-drag h-6 min-h-6 gap-1.5 px-2"
                        search={{ id: detail.selectedClipId, kind: "clip" }}
                        to="/editor"
                      >
                        <FiEdit2 size={14} />
                        Edit
                      </Link>
                    ) : (
                      <button
                        className="btn btn-ghost btn-xs no-drag h-6 min-h-6 gap-1.5 px-2"
                        disabled
                        type="button"
                      >
                        <FiEdit2 size={14} />
                        Edit
                      </button>
                    )}
                  </div>
                }
                visualPlaybackOffsetSeconds={detail.visualPlaybackOffsetSeconds}
                volume={detail.playback.volume}
                onJumpToStart={detail.handleJumpToStart}
                onSeek={detail.handleSeek}
                onSeekBackward={detail.handleSeekBackward}
                onSeekForward={detail.handleSeekForward}
                onTogglePlayback={detail.playback.togglePlayback}
                onVolumeChange={detail.handleVolumeChange}
                onClipTargetSelect={detail.handleClipTargetSelect}
              />
            </div>
          </div>
        )}
      </PageContent>
    </PageContainer>
  );
}

export { RewindDetailPage };
