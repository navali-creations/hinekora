import { useDragOperation, useDroppable } from "@dnd-kit/react";
import clsx from "clsx";

import type { EditorTimelineTrack } from "~/main/modules/editor";

import {
  editorMediaAssetDragType,
  editorVideoTrackDropType,
  isEditorMediaAssetDragData,
} from "../../Editor.utils/Editor.utils";
import { EditorTimelineClip } from "../EditorTimelineClip/EditorTimelineClip";

interface EditorTimelineVideoTrackProps {
  dragPreviewClipId?: string | null;
  railPaddingPixels: number;
  timelineRailWidthPixels: number;
  track: EditorTimelineTrack;
  useCompactTrimHandles: boolean;
  visibleDurationSeconds: number;
}

function EditorTimelineVideoTrack({
  dragPreviewClipId = null,
  railPaddingPixels,
  timelineRailWidthPixels,
  track,
  useCompactTrimHandles,
  visibleDurationSeconds,
}: EditorTimelineVideoTrackProps) {
  const { source } = useDragOperation();
  const { isDropTarget, ref } = useDroppable({
    accept: editorMediaAssetDragType,
    data: {
      kind: editorVideoTrackDropType,
      trackId: track.id,
    },
    id: `video-track:${track.id}`,
  });
  const isDraggingMediaAsset = isEditorMediaAssetDragData(source?.data);
  const shouldHighlightDropTarget = isDraggingMediaAsset || isDropTarget;

  return (
    <div
      className={clsx(
        "relative border-base-content/10 border-b transition-colors",
        shouldHighlightDropTarget &&
          "editor-drop-target-flash bg-primary/10 ring-1 ring-primary/40",
      )}
      data-timeline-video-track="true"
      ref={ref}
    >
      {track.clips.length === 0 && (
        <div
          className={clsx(
            "pointer-events-none absolute inset-2 grid place-items-center rounded-md border border-dashed text-xs",
            shouldHighlightDropTarget
              ? "border-primary/45 text-primary"
              : "border-base-content/10 text-base-content/40",
          )}
        >
          Drop a clip here
        </div>
      )}
      {track.clips.map((clip) => (
        <EditorTimelineClip
          clip={clip}
          isDragPreviewSource={dragPreviewClipId === clip.id}
          key={clip.id}
          railPaddingPixels={railPaddingPixels}
          timelineRailWidthPixels={timelineRailWidthPixels}
          useCompactTrimHandles={useCompactTrimHandles}
          visibleDurationSeconds={visibleDurationSeconds}
        />
      ))}
    </div>
  );
}

export { EditorTimelineVideoTrack };
