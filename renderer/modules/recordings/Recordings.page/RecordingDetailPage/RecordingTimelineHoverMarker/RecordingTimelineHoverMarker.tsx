import type { RefObject } from "react";

interface RecordingTimelineHoverMarkerProps {
  labelRef: RefObject<HTMLSpanElement | null>;
  markerRef: RefObject<HTMLDivElement | null>;
}

function RecordingTimelineHoverMarker({
  labelRef,
  markerRef,
}: RecordingTimelineHoverMarkerProps) {
  return (
    <div
      hidden
      className="pointer-events-none absolute top-0 bottom-0 z-30 w-6 -translate-x-1/2 opacity-55"
      ref={markerRef}
    >
      <span
        className="absolute top-0 left-1/2 flex h-[22px] -translate-x-1/2 items-center rounded-sm bg-base-100 px-1.5 font-semibold text-[10px] text-base-content shadow"
        ref={labelRef}
      />
      <span className="absolute top-[26px] bottom-0 left-1/2 w-px -translate-x-1/2 bg-base-content/60" />
    </div>
  );
}

export { RecordingTimelineHoverMarker };
