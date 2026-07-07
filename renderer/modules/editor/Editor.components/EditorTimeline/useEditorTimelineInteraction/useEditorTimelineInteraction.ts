import {
  type PointerEvent,
  type RefObject,
  useState,
  type WheelEvent,
} from "react";

import {
  editorTimelineRailPaddingPixels,
  resolveEditorTimelineHoverSeconds,
  resolveEditorTimelineWheelZoom,
} from "../EditorTimeline.utils";

interface UseEditorTimelineInteractionInput {
  handleTimelinePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  handleTimelinePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  isProcessing: boolean;
  isTimelineFitToEdit: boolean;
  setZoom: (zoom: number) => void;
  timelineGridRef: RefObject<HTMLDivElement | null>;
  visibleDurationSeconds: number;
  zoom: number;
}

function useEditorTimelineInteraction({
  handleTimelinePointerDown,
  handleTimelinePointerMove,
  isProcessing,
  isTimelineFitToEdit,
  setZoom,
  timelineGridRef,
  visibleDurationSeconds,
  zoom,
}: UseEditorTimelineInteractionInput) {
  const [hoverSeconds, setHoverSeconds] = useState<number | null>(null);

  const resolveHoverSeconds = (event: PointerEvent<HTMLDivElement>) => {
    return resolveEditorTimelineHoverSeconds({
      clientX: event.clientX,
      railPaddingPixels: editorTimelineRailPaddingPixels,
      target: event.target,
      timelineGrid: timelineGridRef.current,
      visibleDurationSeconds,
    });
  };

  const handleTimelineWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (isProcessing || !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    const nextZoom = resolveEditorTimelineWheelZoom({
      deltaY: event.deltaY,
      isTimelineFitToEdit,
      zoom,
    });

    if (nextZoom !== null) {
      setZoom(nextZoom);
    }
  };

  const handleTimelineMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isProcessing) {
      handleTimelinePointerMove(event);
      setHoverSeconds(resolveHoverSeconds(event));
    }
  };

  const handleTimelinePointerDownGuarded = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!isProcessing) {
      handleTimelinePointerDown(event);
    }
  };

  const handleTimelineLeave = () => {
    setHoverSeconds(null);
  };

  return {
    handleTimelineLeave,
    handleTimelineMove,
    handleTimelinePointerDownGuarded,
    handleTimelineWheel,
    hoverSeconds,
  };
}

export { useEditorTimelineInteraction };
