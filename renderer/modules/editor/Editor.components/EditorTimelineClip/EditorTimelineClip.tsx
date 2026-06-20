import clsx from "clsx";
import type { MouseEvent } from "react";
import { memo, useEffect, useRef, useState } from "react";

import type { EditorTimelineClip as EditorTimelineClipModel } from "~/main/modules/editor";
import { useEditorShallow } from "~/renderer/store";

import {
  calculateEditorThumbnailCount,
  useEditorClipThumbnails,
} from "../../Editor.hooks/useEditorClipThumbnails/useEditorClipThumbnails";
import { calculateTimelinePercent } from "../../Editor.utils/Editor.utils";

interface EditorTimelineClipProps {
  clip: EditorTimelineClipModel;
  isDragPreviewSource?: boolean;
  visibleDurationSeconds: number;
}

function EditorTimelineClip({
  clip,
  isDragPreviewSource = false,
  visibleDurationSeconds,
}: EditorTimelineClipProps) {
  const clipRef = useRef<HTMLDivElement>(null);
  const [widthPixels, setWidthPixels] = useState(0);
  const { selectedClipId, selectTimelineClip } = useEditorShallow((editor) => ({
    selectedClipId: editor.selectedClipId,
    selectTimelineClip: editor.selectTimelineClip,
  }));
  const isSelected = selectedClipId === clip.id;
  const left = calculateTimelinePercent(
    clip.startSeconds,
    visibleDurationSeconds,
  );
  const width = calculateTimelinePercent(
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
    const clipElement = clipRef.current;
    if (!clipElement) {
      return;
    }

    const updateWidth = () => {
      const nextWidthPixels = clipElement.getBoundingClientRect().width;
      setWidthPixels((currentWidthPixels) =>
        calculateEditorThumbnailCount(currentWidthPixels) ===
        calculateEditorThumbnailCount(nextWidthPixels)
          ? currentWidthPixels
          : nextWidthPixels,
      );
    };
    const resizeObserver = new ResizeObserver(updateWidth);
    updateWidth();
    resizeObserver.observe(clipElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleClipClick = (event: MouseEvent<HTMLButtonElement>) => {
    selectTimelineClip(event.currentTarget.dataset.clipId ?? null);
  };

  return (
    <div
      className={clsx(
        "group absolute top-2 bottom-2 z-20 overflow-hidden rounded-md border transition-colors",
        isDragPreviewSource && "opacity-20",
        isSelected
          ? "border-primary/90"
          : "border-transparent hover:border-base-content/45",
      )}
      data-timeline-clip={clip.id}
      ref={clipRef}
      style={{
        left: `${left}%`,
        width: `${Math.max(width, 4)}%`,
      }}
    >
      {thumbnails.length > 0 && (
        <div className="pointer-events-none absolute inset-0 flex overflow-hidden">
          {thumbnails.map((thumbnail, index) => (
            <img
              alt=""
              className="h-full min-w-14 flex-1 object-cover"
              draggable={false}
              key={`${clip.id}-thumbnail-${index}`}
              src={thumbnail}
            />
          ))}
        </div>
      )}
      <button
        aria-label={`Select ${clip.name}`}
        className="absolute inset-0 cursor-grab px-4 text-left text-xs active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        data-clip-body="true"
        data-clip-duration-seconds={clip.durationSeconds}
        data-clip-id={clip.id}
        data-clip-start-seconds={clip.startSeconds}
        type="button"
        onClick={handleClipClick}
      />
      <button
        aria-label={`Trim start of ${clip.name}`}
        className={clsx(
          "absolute inset-y-0 left-0 z-10 w-3 cursor-ew-resize border-base-content/35 border-r bg-base-content/20 transition-opacity hover:bg-base-content/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        data-clip-id={clip.id}
        data-trim-edge="start"
        type="button"
      />
      <button
        aria-label={`Trim end of ${clip.name}`}
        className={clsx(
          "absolute inset-y-0 right-0 z-10 w-3 cursor-ew-resize border-base-content/35 border-l bg-base-content/20 transition-opacity hover:bg-base-content/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        data-clip-id={clip.id}
        data-trim-edge="end"
        type="button"
      />
    </div>
  );
}

const MemoizedEditorTimelineClip = memo(EditorTimelineClip);

export { MemoizedEditorTimelineClip as EditorTimelineClip };
