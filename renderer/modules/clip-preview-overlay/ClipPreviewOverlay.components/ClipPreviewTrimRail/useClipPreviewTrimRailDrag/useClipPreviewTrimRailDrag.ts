import type { PointerEvent } from "react";

import {
  resolveTrimRailSeekSeconds,
  shouldProcessTrimRailMove,
  type UseClipPreviewTrimRailDragInput,
} from "../ClipPreviewTrimRail.utils";
import { useClipPreviewTrimEdgeDrag } from "../useClipPreviewTrimEdgeDrag/useClipPreviewTrimEdgeDrag";
import { useClipPreviewTrimSelectionGrab } from "../useClipPreviewTrimSelectionGrab/useClipPreviewTrimSelectionGrab";
import { useClipPreviewTrimDragController } from "./useClipPreviewTrimDragController";

function useClipPreviewTrimRailDrag({
  disabled,
  durationSeconds,
  trim,
  onSeek,
  onTrimCommit,
  onTrimPreview,
  syncTrimPresentation,
}: UseClipPreviewTrimRailDragInput) {
  const {
    applySelectionDrag,
    applyTrimDrag,
    cacheRailBounds,
    commitTrim,
    dragStateRef,
    lastDragMoveTimeRef,
    railRef,
    resolveTimelineSeconds,
    trimRef,
  } = useClipPreviewTrimDragController({
    durationSeconds,
    onTrimCommit,
    onTrimPreview,
    syncTrimPresentation,
    trim,
  });
  const { beginSelectionGrab, isSelectionDragging, resetSelectionGrab } =
    useClipPreviewTrimSelectionGrab({
      dragStateRef,
      lastDragMoveTimeRef,
    });
  const handleRailPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    cacheRailBounds();
    lastDragMoveTimeRef.current = 0;
    const seconds = resolveTimelineSeconds(event.clientX);
    if (seconds !== null) {
      onSeek(resolveTrimRailSeekSeconds(seconds, trimRef.current), {
        preservePlayback: true,
      });
    }
  };

  const handleRailPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || disabled) {
      return;
    }

    event.preventDefault();
    if (dragState.kind === "edge") {
      const now = event.timeStamp;
      if (!shouldProcessTrimRailMove(now, lastDragMoveTimeRef.current)) {
        return;
      }
      lastDragMoveTimeRef.current = now;
      applyTrimDrag(dragState.edge, event.clientX);
      return;
    }

    if (!dragState.canMove) {
      return;
    }

    const now = event.timeStamp;
    if (!shouldProcessTrimRailMove(now, lastDragMoveTimeRef.current)) {
      return;
    }
    lastDragMoveTimeRef.current = now;

    applySelectionDrag(dragState, event.clientX);
  };

  const handleRailPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    lastDragMoveTimeRef.current = 0;
    const dragState = dragStateRef.current;
    if (dragState && event.type === "pointerup") {
      if (dragState.kind === "edge") {
        applyTrimDrag(dragState.edge, event.clientX);
      } else if (dragState.canMove) {
        applySelectionDrag(dragState, event.clientX);
      }
    }
    if (dragState) {
      commitTrim();
    }
    if (dragState?.kind === "selection" && !dragState.hasMoved) {
      onSeek(
        resolveTrimRailSeekSeconds(dragState.initialSeconds, trimRef.current),
        {
          preservePlayback: true,
        },
      );
    }
    if (
      dragState &&
      event.currentTarget.hasPointerCapture(dragState.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(dragState.pointerId);
    }
    resetSelectionGrab();
    dragStateRef.current = null;
  };

  const { handleEndPointerDown, handleStartPointerDown } =
    useClipPreviewTrimEdgeDrag({
      applyTrimDrag,
      cacheRailBounds,
      disabled,
      dragStateRef,
      lastDragMoveTimeRef,
      railRef,
    });

  const handleSelectionPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    if (disabled) {
      return;
    }

    cacheRailBounds();
    const seconds = resolveTimelineSeconds(event.clientX);
    if (seconds === null) {
      return;
    }

    const currentTrim = trimRef.current;
    railRef.current?.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      canMove: false,
      grabOffsetSeconds: seconds - currentTrim.inSeconds,
      hasMoved: false,
      initialSeconds: seconds,
      kind: "selection",
      pointerId: event.pointerId,
      trimDurationSeconds: currentTrim.outSeconds - currentTrim.inSeconds,
    };
    lastDragMoveTimeRef.current = 0;
    beginSelectionGrab(event.pointerId);
  };

  return {
    handleEndPointerDown,
    handleRailPointerDown,
    handleRailPointerEnd,
    handleRailPointerMove,
    handleSelectionPointerDown,
    handleStartPointerDown,
    isSelectionDragging,
    railRef,
  };
}

export { useClipPreviewTrimRailDrag };
