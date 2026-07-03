import type { RefObject } from "react";
import { useEffect, useState } from "react";

function useRecordingTimelineGridWidth(ref: RefObject<HTMLElement | null>) {
  const [gridWidthPixels, setGridWidthPixels] = useState(0);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) {
      return;
    }

    const updateGridWidth = () => {
      setGridWidthPixels(grid.getBoundingClientRect().width);
    };

    updateGridWidth();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(updateGridWidth);
    resizeObserver.observe(grid);

    return () => {
      resizeObserver.disconnect();
    };
  }, [ref]);

  return gridWidthPixels;
}

export { useRecordingTimelineGridWidth };
