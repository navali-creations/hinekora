import { type RefObject, useEffect, useState } from "react";

function useEditorTimelineGridWidth(
  timelineGridRef: RefObject<HTMLElement | null>,
): number {
  const [timelineGridWidthPixels, setTimelineGridWidthPixels] = useState(0);

  useEffect(() => {
    const timelineGrid = timelineGridRef.current;
    if (!timelineGrid) {
      return;
    }

    const updateTimelineGridWidth = () => {
      const nextTimelineGridWidthPixels =
        timelineGrid.getBoundingClientRect().width;
      setTimelineGridWidthPixels((currentTimelineGridWidthPixels) =>
        currentTimelineGridWidthPixels === nextTimelineGridWidthPixels
          ? currentTimelineGridWidthPixels
          : nextTimelineGridWidthPixels,
      );
    };

    updateTimelineGridWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(updateTimelineGridWidth);
    resizeObserver.observe(timelineGrid);

    return () => {
      resizeObserver.disconnect();
    };
  }, [timelineGridRef]);

  return timelineGridWidthPixels;
}

export { useEditorTimelineGridWidth };
