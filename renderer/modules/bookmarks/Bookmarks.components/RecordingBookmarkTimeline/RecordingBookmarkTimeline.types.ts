import type { ReactNode } from "react";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import type { VisualPlaybackSubscriber } from "~/renderer/modules/media-playback/useVisualPlaybackPublisher/useVisualPlaybackPublisher";

interface RecordingTimelineFrameStep {
  framesPerSecond: number;
  getPlaybackSeconds: () => number;
  onStep: (seconds: number) => void;
}

interface RecordingBookmarkTimelineMarkers {
  bookmarks: RecordingBookmark[];
  clipTargetsByBookmarkId?: Record<
    string,
    {
      durationSeconds: number | null;
      targetDurationSeconds: number | null;
      targetId: string;
    }
  >;
  highlightDeathsInRuler?: boolean;
  highlightManualsInRuler?: boolean;
  hoveredBookmark?: RecordingBookmark | null;
  markerBookmarks?: RecordingBookmark[];
  showBookmarkMarkers?: boolean;
  onClipTargetSelect?: (clipId: string) => void;
}

interface RecordingBookmarkTimelinePlayback {
  durationSeconds: number | null;
  enableVisualPlaybackSubscription?: boolean;
  frameStep?: RecordingTimelineFrameStep;
  isPlaying: boolean;
  isPlaybackDisabled?: boolean;
  mediaUrl: string | null;
  playbackSeconds: number;
  subscribeVisualPlaybackTime?: VisualPlaybackSubscriber;
  visualPlaybackOffsetSeconds?: number;
  volume: number;
  onJumpToStart: () => void;
  onSeek: (seconds: number) => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
  onTogglePlayback: () => void;
  onVolumeChange: (volume: number) => void;
}

interface RecordingBookmarkTimelineProps {
  markers: RecordingBookmarkTimelineMarkers;
  playback: RecordingBookmarkTimelinePlayback;
  toolbarStart?: ReactNode;
}

export type { RecordingBookmarkTimelineProps };
