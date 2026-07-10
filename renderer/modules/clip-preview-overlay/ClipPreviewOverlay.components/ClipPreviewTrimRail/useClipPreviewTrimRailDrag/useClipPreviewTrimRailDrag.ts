import type { PointerEvent } from "react";
import { useEffect, useRef } from "react";

import {
  createTrimEdgeDragRange,
  createTrimSelectionDragRange,
  readTrimRailBounds,
  resolveTrimRailSeconds,
  resolveTrimRailSeekSeconds,
  shouldProcessTrimRailMove,
  type TrimDragEdge,
  type TrimDragState,
  type UseClipPreviewTrimRailDragInput,
} from "../ClipPreviewTrimRail.utils";
import { useClipPreviewTrimEdgeDrag } from "../useClipPreviewTrimEdgeDrag/useClipPreviewTrimEdgeDrag";
import { useClipPreviewTrimSelectionGrab } from "../useClipPreviewTrimSelectionGrab/useClipPreviewTrimSelectionGrab";

function useClipPreviewTrimRailDrag({
  disabled,
  durationSeconds,
  trim,
  onSeek,
  onTrimChange,
}: UseClipPreviewTrimRailDragInput) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<TrimDragState | null>(null);
  const durationSecondsRef = useRef(durationSeconds);
  const railBoundsRef = useRef<{ left: number; width: number } | null>(null);
  const trimRef = useRef(trim);
  const lastDragMoveTimeRef = useRef(0);
  const { beginSelectionGrab, isSelectionDragging, resetSelectionGrab } =
    useClipPreviewTrimSelectionGrab({
      dragStateRef,
      lastDragMoveTimeRef,
    });
  durationSecondsRef.current = durationSeconds;
  trimRef.current = trim;

  const cacheRailBounds = () => {
    railBoundsRef.current = readTrimRailBounds(railRef.current);
  };

  const resolveTimelineSeconds = (clientX: number): number | null => {
    if (!railBoundsRef.current) {
      cacheRailBounds();
    }
    return resolveTrimRailSeconds({
      bounds: railBoundsRef.current,
      clientX,
      durationSeconds: durationSecondsRef.current,
    });
  };

  const applyTrimDrag = (edge: TrimDragEdge, clientX: number) => {
    const seconds = resolveTimelineSeconds(clientX);
    if (seconds === null) {
      return;
    }

    const currentTrim = trimRef.current;
    const nextTrim = createTrimEdgeDragRange({
      durationSeconds: durationSecondsRef.current,
      edge,
      seconds,
      trim: currentTrim,
    });
    if (
      nextTrim.inSeconds === currentTrim.inSeconds &&
      nextTrim.outSeconds === currentTrim.outSeconds
    ) {
      return;
    }
    onTrimChange(nextTrim, {
      previewSeconds: edge === "end" ? nextTrim.outSeconds : nextTrim.inSeconds,
    });
  };

  const applySelectionDrag = (
    state: Extract<TrimDragState, { kind: "selection" }>,
    clientX: number,
  ) => {
    const seconds = resolveTimelineSeconds(clientX);
    if (seconds === null) {
      return;
    }

    if (!state.canMove) {
      return;
    }

    state.hasMoved = true;
    const nextTrim = createTrimSelectionDragRange({
      durationSeconds: durationSecondsRef.current,
      grabOffsetSeconds: state.grabOffsetSeconds,
      seconds,
      trimDurationSeconds: state.trimDurationSeconds,
    });
    const currentTrim = trimRef.current;
    if (
      nextTrim.inSeconds === currentTrim.inSeconds &&
      nextTrim.outSeconds === currentTrim.outSeconds
    ) {
      return;
    }
    onTrimChange(nextTrim, {
      previewSeconds: nextTrim.inSeconds,
    });
  };

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

  useEffect(
    () => () => {
      lastDragMoveTimeRef.current = 0;
      dragStateRef.current = null;
    },
    [],
  );

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
