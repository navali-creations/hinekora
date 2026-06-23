import { formatEditorTime } from "../../Editor.utils/Editor.utils";

interface EditorTimelineRulerProps {
  markers: number[];
  minorMarkers: number[];
  selectedClipRulerLeft: number;
  selectedClipRulerWidth: number;
  visibleDurationSeconds: number;
}

function EditorTimelineRuler({
  markers,
  minorMarkers,
  selectedClipRulerLeft,
  selectedClipRulerWidth,
  visibleDurationSeconds,
}: EditorTimelineRulerProps) {
  return (
    <div
      className="relative border-base-content/10 border-b bg-base-200"
      data-timeline-marker-zone="true"
    >
      {selectedClipRulerWidth > 0 && (
        <span
          className="pointer-events-none absolute inset-y-0 z-10 border-primary/30 border-x bg-primary/20"
          style={{
            left: `${selectedClipRulerLeft}%`,
            width: `${selectedClipRulerWidth}%`,
          }}
        />
      )}
      {minorMarkers.map((marker) => (
        <span
          aria-hidden="true"
          className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 z-10 h-1 w-1 rounded-full bg-base-content/25"
          data-timeline-minor-marker="true"
          key={`minor-${marker}`}
          style={{
            left: `${(marker / visibleDurationSeconds) * 100}%`,
          }}
        />
      ))}
      {markers.map((marker) => (
        <span
          className="absolute top-0 z-20 flex h-full items-center text-[10px] text-base-content/45"
          key={marker}
          style={{
            left: `${(marker / visibleDurationSeconds) * 100}%`,
          }}
        >
          {formatEditorTime(marker)}
        </span>
      ))}
    </div>
  );
}

export { EditorTimelineRuler };
