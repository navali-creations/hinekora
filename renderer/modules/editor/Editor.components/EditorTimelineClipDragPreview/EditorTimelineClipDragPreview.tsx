import { useEffect, useRef, useState } from "react";

import type { EditorTimelineClip } from "~/main/modules/editor";

import {
  calculateEditorThumbnailCount,
  useEditorClipThumbnails,
} from "../../Editor.hooks/useEditorClipThumbnails/useEditorClipThumbnails";
import { calculateTimelinePercent } from "../../Editor.utils/Editor.utils";

interface EditorTimelineClipDragPreviewProps {
  clip: EditorTimelineClip;
  heightPixels: number;
  labelColumnWidth: number;
  startSeconds: number;
  topPixels: number;
  visibleDurationSeconds: number;
}

function EditorTimelineClipDragPreview({
  clip,
  heightPixels,
  labelColumnWidth,
  startSeconds,
  topPixels,
  visibleDurationSeconds,
}: EditorTimelineClipDragPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [widthPixels, setWidthPixels] = useState(0);
  const leftPercent = calculateTimelinePercent(
    startSeconds,
    visibleDurationSeconds,
  );
  const widthPercent = calculateTimelinePercent(
    clip.durationSeconds,
    visibleDurationSeconds,
  );
  const thumbnails = useEditorClipThumbnails({
    durationSeconds: clip.durationSeconds,
    inSeconds: clip.inSeconds,
    mediaUrl: clip.mediaUrl,
    outSeconds: clip.outSeconds,
    widthPixels,
  });

  useEffect(() => {
    const previewElement = previewRef.current;
    if (!previewElement) {
      return;
    }

    const updateWidth = () => {
      const nextWidthPixels = previewElement.getBoundingClientRect().width;
      setWidthPixels((currentWidthPixels) =>
        calculateEditorThumbnailCount(currentWidthPixels) ===
        calculateEditorThumbnailCount(nextWidthPixels)
          ? currentWidthPixels
          : nextWidthPixels,
      );
    };
    const resizeObserver = new ResizeObserver(updateWidth);
    updateWidth();
    resizeObserver.observe(previewElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute z-50 overflow-hidden rounded-md border border-primary/90 bg-base-300/40 shadow-[0_14px_34px_rgba(0,0,0,0.45)] ring-2 ring-primary/45"
      ref={previewRef}
      style={{
        height: `${heightPixels}px`,
        left: `calc(${labelColumnWidth}px + (100% - ${labelColumnWidth}px) * ${
          leftPercent / 100
        })`,
        top: `${topPixels}px`,
        width: `calc((100% - ${labelColumnWidth}px) * ${
          Math.max(widthPercent, 4) / 100
        })`,
      }}
    >
      {thumbnails.length > 0 && (
        <div className="absolute inset-0 flex overflow-hidden">
          {thumbnails.map((thumbnail, index) => (
            <img
              alt=""
              className="h-full min-w-14 flex-1 object-cover"
              draggable={false}
              key={`${clip.id}-drag-thumbnail-${index}`}
              src={thumbnail}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { EditorTimelineClipDragPreview };
