import { useEditorClipThumbnails } from "~/renderer/modules/editor/Editor.hooks/useEditorClipThumbnails/useEditorClipThumbnails";

import {
  formatRecordingTimelineRailLeft,
  formatRecordingTimelineRailWidth,
} from "../RecordingBookmarkTimeline/RecordingBookmarkTimeline.utils";

interface RecordingTimelineVideoRailProps {
  durationSeconds: number;
  mediaUrl: string | null;
  railWidthPixels: number;
}

function RecordingTimelineVideoRail({
  durationSeconds,
  mediaUrl,
  railWidthPixels,
}: RecordingTimelineVideoRailProps) {
  const thumbnails = useEditorClipThumbnails({
    durationSeconds,
    inSeconds: 0,
    mediaUrl,
    outSeconds: durationSeconds,
    widthPixels: railWidthPixels,
  });

  return (
    <div
      className="relative border-base-content/10 border-b bg-base-300"
      data-recording-timeline-zone="true"
    >
      <div
        className="absolute top-2 bottom-2 z-10 overflow-hidden rounded-md border border-base-content/45 bg-black"
        style={{
          left: formatRecordingTimelineRailLeft(0),
          width: formatRecordingTimelineRailWidth(100),
        }}
      >
        {thumbnails.length > 0 && (
          <div className="pointer-events-none absolute inset-0 flex overflow-hidden">
            {thumbnails.map((thumbnail, index) => (
              <img
                alt=""
                className="h-full min-w-14 flex-1 object-cover"
                draggable={false}
                key={`${mediaUrl}-recording-thumbnail-${index}`}
                src={thumbnail}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { RecordingTimelineVideoRail };
