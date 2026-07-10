import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  selectionGrabDelayMs,
  type TrimDragState,
} from "../ClipPreviewTrimRail.utils";

function useClipPreviewTrimSelectionGrab(input: {
  dragStateRef: RefObject<TrimDragState | null>;
  lastDragMoveTimeRef: RefObject<number>;
}) {
  const timeoutRef = useRef<number | null>(null);
  const [isSelectionDragging, setSelectionDragging] = useState(false);

  const resetSelectionGrab = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setSelectionDragging(false);
  }, []);

  const beginSelectionGrab = useCallback(
    (pointerId: number) => {
      resetSelectionGrab();
      timeoutRef.current = window.setTimeout(() => {
        const dragState = input.dragStateRef.current;
        if (
          dragState?.kind !== "selection" ||
          dragState.pointerId !== pointerId
        ) {
          return;
        }

        dragState.canMove = true;
        input.lastDragMoveTimeRef.current = 0;
        setSelectionDragging(true);
      }, selectionGrabDelayMs);
    },
    [input.dragStateRef, input.lastDragMoveTimeRef, resetSelectionGrab],
  );

  useEffect(() => resetSelectionGrab, [resetSelectionGrab]);

  return {
    beginSelectionGrab,
    isSelectionDragging,
    resetSelectionGrab,
  };
}

export { useClipPreviewTrimSelectionGrab };
