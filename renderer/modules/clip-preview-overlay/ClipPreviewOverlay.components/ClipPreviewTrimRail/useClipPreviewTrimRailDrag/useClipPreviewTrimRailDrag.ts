import type { PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ClipPreviewTrimRange,
  clampClipPreviewTrimRange,
  moveClipPreviewTrimRange,
  resolveClipPreviewTimelineSeconds,
} from "../../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

interface UseClipPreviewTrimRailDragInput {
  disabled: boolean;
  durationSeconds: number;
  trim: ClipPreviewTrimRange;
  onSeek: (seconds: number, options?: { preservePlayback?: boolean }) => void;
  onTrimChange: (
    trim: ClipPreviewTrimRange,
    options?: { previewSeconds: number },
  ) => void;
}

type TrimDragEdge = "end" | "start";
type TrimDragState =
  | { edge: TrimDragEdge; kind: "edge"; pointerId: number }
  | {
      canMove: boolean;
      grabOffsetSeconds: number;
      hasMoved: boolean;
      initialSeconds: number;
      kind: "selection";
      pointerId: number;
      trimDurationSeconds: number;
    };

const selectionGrabDelayMs = 250;
const moveThrottleMs = 16;

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
  const selectionGrabTimeoutRef = useRef<number | null>(null);
  const railBoundsRef = useRef<{ left: number; width: number } | null>(null);
  const trimRef = useRef(trim);
  const lastDragMoveTimeRef = useRef(0);
  const [isSelectionDragging, setSelectionDragging] = useState(false);
  durationSecondsRef.current = durationSeconds;
  trimRef.current = trim;

  const clearSelectionGrabTimeout = useCallback(() => {
    if (selectionGrabTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(selectionGrabTimeoutRef.current);
    selectionGrabTimeoutRef.current = null;
  }, []);

  const cacheRailBounds = () => {
    const rail = railRef.current;
    if (!rail) {
      railBoundsRef.current = null;
      return;
    }

    const bounds = rail.getBoundingClientRect();
    if (bounds.width <= 0) {
      railBoundsRef.current = null;
      return;
    }

    railBoundsRef.current = { left: bounds.left, width: bounds.width };
  };

  const resolveTimelineSeconds = (clientX: number): number | null => {
    const bounds = railBoundsRef.current;
    if (!bounds || durationSecondsRef.current <= 0) {
      cacheRailBounds();
      return resolveClipPreviewTimelineSeconds({
        clientX,
        durationSeconds: durationSecondsRef.current,
        rail: railRef.current,
      });
    }

    return resolveClipPreviewTimelineSeconds({
      clientX,
      durationSeconds: durationSecondsRef.current,
      rail: {
        getBoundingClientRect: () =>
          ({
            left: bounds.left,
            width: bounds.width,
            top: 0,
            right: bounds.left + bounds.width,
            bottom: 0,
            height: 0,
            x: bounds.left,
            y: 0,
            toJSON: () => null,
          }) as DOMRect,
      } as HTMLDivElement,
    });
  };

  const applyTrimDrag = (edge: TrimDragEdge, clientX: number) => {
    const seconds = resolveTimelineSeconds(clientX);
    if (seconds === null) {
      return;
    }

    const currentTrim = trimRef.current;
    const nextTrim = clampClipPreviewTrimRange({
      durationSeconds: durationSecondsRef.current,
      inSeconds: edge === "start" ? seconds : currentTrim.inSeconds,
      outSeconds: edge === "end" ? seconds : currentTrim.outSeconds,
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
    const nextTrim = moveClipPreviewTrimRange({
      durationSeconds: durationSecondsRef.current,
      inSeconds: seconds - state.grabOffsetSeconds,
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

  const resolveSeekSeconds = (seconds: number): number => {
    const currentTrim = trimRef.current;
    if (seconds < currentTrim.inSeconds) {
      return currentTrim.inSeconds;
    }

    if (seconds > currentTrim.outSeconds) {
      return currentTrim.outSeconds;
    }

    return seconds;
  };

  const handleRailPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    cacheRailBounds();
    lastDragMoveTimeRef.current = 0;
    const seconds = resolveTimelineSeconds(event.clientX);
    if (seconds !== null) {
      onSeek(resolveSeekSeconds(seconds), { preservePlayback: true });
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
      if (now > 0) {
        const lastUpdateTime = lastDragMoveTimeRef.current;
        if (now - lastUpdateTime < moveThrottleMs) {
          return;
        }

        lastDragMoveTimeRef.current = now;
      }
      applyTrimDrag(dragState.edge, event.clientX);
      return;
    }

    if (!dragState.canMove) {
      return;
    }

    const now = event.timeStamp;
    if (now > 0) {
      const lastUpdateTime = lastDragMoveTimeRef.current;
      if (now - lastUpdateTime < moveThrottleMs) {
        return;
      }

      lastDragMoveTimeRef.current = now;
    }

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
      onSeek(resolveSeekSeconds(dragState.initialSeconds), {
        preservePlayback: true,
      });
    }
    if (
      dragState &&
      event.currentTarget.hasPointerCapture(dragState.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(dragState.pointerId);
    }
    clearSelectionGrabTimeout();
    dragStateRef.current = null;
    setSelectionDragging(false);
  };

  const handleStartPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (disabled) {
      return;
    }

    cacheRailBounds();
    lastDragMoveTimeRef.current = 0;
    railRef.current?.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      edge: "start",
      kind: "edge",
      pointerId: event.pointerId,
    };
    applyTrimDrag("start", event.clientX);
  };

  const handleEndPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (disabled) {
      return;
    }

    cacheRailBounds();
    lastDragMoveTimeRef.current = 0;
    railRef.current?.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      edge: "end",
      kind: "edge",
      pointerId: event.pointerId,
    };
    applyTrimDrag("end", event.clientX);
  };

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
    clearSelectionGrabTimeout();
    selectionGrabTimeoutRef.current = window.setTimeout(() => {
      const dragState = dragStateRef.current;
      if (
        dragState?.kind !== "selection" ||
        dragState.pointerId !== event.pointerId
      ) {
        return;
      }

      dragState.canMove = true;
      lastDragMoveTimeRef.current = 0;
      setSelectionDragging(true);
    }, selectionGrabDelayMs);
  };

  useEffect(
    () => () => {
      lastDragMoveTimeRef.current = 0;
      clearSelectionGrabTimeout();
      setSelectionDragging(false);
      dragStateRef.current = null;
    },
    [clearSelectionGrabTimeout],
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
