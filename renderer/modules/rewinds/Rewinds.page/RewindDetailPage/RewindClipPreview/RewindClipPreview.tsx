import type { RefObject } from "react";

import type { ReplayClipDetail } from "~/main/modules/replay-clips";

interface RewindClipPreviewProps {
  detail: ReplayClipDetail | null;
  error: string | null;
  hasLinkedClips: boolean;
  isLoading: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onEnded: () => void;
  onLoadedMetadata: () => void;
  onPause: () => void;
  onPlay: () => void;
  onTimeUpdate: () => void;
}

function RewindClipPreview({
  detail,
  error,
  hasLinkedClips,
  isLoading,
  videoRef,
  onEnded,
  onLoadedMetadata,
  onPause,
  onPlay,
  onTimeUpdate,
}: RewindClipPreviewProps) {
  const clip = detail?.clip ?? null;
  const title = clip?.kind === "manual" ? "Manual replay" : "Death clip";

  if (isLoading) {
    return (
      <div className="grid flex-1 place-items-center bg-black p-4 text-base-content/60">
        <div className="flex items-center gap-3 text-sm">
          <span className="loading loading-spinner loading-sm" />
          Loading clip...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid flex-1 place-items-center bg-black p-4 text-center">
        <div>
          <div className="font-bold text-error">Clip preview failed</div>
          <div className="text-base-content/55 text-xs">{error}</div>
        </div>
      </div>
    );
  }

  if (!detail || !clip) {
    return (
      <div className="grid flex-1 place-items-center bg-black p-4 text-base-content/60">
        <div className="max-w-md text-center">
          <div className="font-bold text-base-content">Rewind activity</div>
          <div className="text-xs">
            {hasLinkedClips
              ? "Select a death or manual replay marker to preview its saved clip here."
              : "Rewinds do not have a full video preview. Death and manual replay clips will appear here when this activity session has linked clips."}
          </div>
        </div>
      </div>
    );
  }

  if (!detail.mediaUrl) {
    return (
      <div className="grid flex-1 place-items-center bg-black p-4 text-center">
        <div>
          <div className="font-bold text-base-content">
            Clip video unavailable
          </div>
          <div className="text-base-content/55 text-xs">
            The linked replay exists, but its video file is missing or
            unavailable.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 bg-black p-4">
      <video
        className="min-h-0 flex-1 object-contain"
        preload="metadata"
        ref={videoRef}
        src={detail.mediaUrl}
        title={title}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        onPause={onPause}
        onPlay={onPlay}
        onTimeUpdate={onTimeUpdate}
      />
    </div>
  );
}

export { RewindClipPreview };
