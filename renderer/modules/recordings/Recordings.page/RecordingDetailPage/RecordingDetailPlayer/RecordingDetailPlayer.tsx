import type { RefObject } from "react";
import { useEffect, useRef } from "react";

interface RecordingDetailPlayerProps {
  emptyDescription: string;
  emptyTitle: string;
  mediaUrl: string | null;
  title: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  onFrameHeightChange: (heightPixels: number) => void;
  onEnded: () => void;
  onLoadedMetadata: () => void;
  onPause: () => void;
  onPlay: () => void;
  onTimeUpdate: () => void;
}

function RecordingDetailPlayer({
  emptyDescription,
  emptyTitle,
  mediaUrl,
  title,
  videoRef,
  onFrameHeightChange,
  onEnded,
  onLoadedMetadata,
  onPause,
  onPlay,
  onTimeUpdate,
}: RecordingDetailPlayerProps) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const updateFrameHeight = () => {
      onFrameHeightChange(frame.getBoundingClientRect().height);
    };

    updateFrameHeight();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(updateFrameHeight);
    resizeObserver.observe(frame);

    return () => {
      resizeObserver.disconnect();
    };
  }, [onFrameHeightChange]);

  if (!mediaUrl) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-300">
        <div
          className="grid h-full min-h-0 place-items-center bg-black p-4 text-center"
          ref={frameRef}
        >
          <div className="rounded-lg border border-base-content/10 border-dashed p-8">
            <h2 className="font-bold text-base">{emptyTitle}</h2>
            <p className="mt-2 text-base-content/60 text-sm">
              {emptyDescription}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-300">
      <div className="h-full min-h-0 bg-black p-4" ref={frameRef}>
        <video
          className="block h-full w-full object-contain"
          preload="metadata"
          ref={videoRef}
          src={mediaUrl}
          title={title}
          onEnded={onEnded}
          onLoadedMetadata={onLoadedMetadata}
          onPause={onPause}
          onPlay={onPlay}
          onTimeUpdate={onTimeUpdate}
        />
      </div>
    </section>
  );
}

export { RecordingDetailPlayer };
