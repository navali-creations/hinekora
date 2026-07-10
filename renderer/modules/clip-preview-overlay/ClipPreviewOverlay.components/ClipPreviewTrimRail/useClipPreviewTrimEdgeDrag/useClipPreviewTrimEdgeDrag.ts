import type { PointerEvent, RefObject } from "react";

import type { TrimDragEdge, TrimDragState } from "../ClipPreviewTrimRail.utils";

function useClipPreviewTrimEdgeDrag(input: {
  applyTrimDrag: (edge: TrimDragEdge, clientX: number) => void;
  cacheRailBounds: () => void;
  disabled: boolean;
  dragStateRef: RefObject<TrimDragState | null>;
  lastDragMoveTimeRef: RefObject<number>;
  railRef: RefObject<HTMLDivElement | null>;
}) {
  const beginEdgeDrag = (
    edge: TrimDragEdge,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    if (input.disabled) {
      return;
    }

    input.cacheRailBounds();
    input.lastDragMoveTimeRef.current = 0;
    input.railRef.current?.setPointerCapture(event.pointerId);
    input.dragStateRef.current = {
      edge,
      kind: "edge",
      pointerId: event.pointerId,
    };
    input.applyTrimDrag(edge, event.clientX);
  };

  const handleStartPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    beginEdgeDrag("start", event);
  };
  const handleEndPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    beginEdgeDrag("end", event);
  };

  return { handleEndPointerDown, handleStartPointerDown };
}

export { useClipPreviewTrimEdgeDrag };
