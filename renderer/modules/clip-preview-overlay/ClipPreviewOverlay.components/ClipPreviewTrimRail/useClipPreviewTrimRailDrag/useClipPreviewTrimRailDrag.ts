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
    options?: { previewMedia?: boolean; previewSeconds: number },
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
  const trimRef = useRef(trim);
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

  const applyTrimDrag = (edge: TrimDragEdge, clientX: number) => {
    const seconds = resolveClipPreviewTimelineSeconds({
      clientX,
      durationSeconds: durationSecondsRef.current,
      rail: railRef.current,
    });
    if (seconds === null) {
      return;
    }

    const currentTrim = trimRef.current;
    const nextTrim = clampClipPreviewTrimRange({
      durationSeconds: durationSecondsRef.current,
      inSeconds: edge === "start" ? seconds : currentTrim.inSeconds,
      outSeconds: edge === "end" ? seconds : currentTrim.outSeconds,
    });
    onTrimChange(nextTrim, {
      previewMedia: true,
      previewSeconds: edge === "end" ? nextTrim.outSeconds : nextTrim.inSeconds,
    });
  };

  const applySelectionDrag = (
    state: Extract<TrimDragState, { kind: "selection" }>,
    clientX: number,
  ) => {
    const seconds = resolveClipPreviewTimelineSeconds({
      clientX,
      durationSeconds: durationSecondsRef.current,
      rail: railRef.current,
    });
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
    onTrimChange(nextTrim, {
      previewMedia: true,
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

    const seconds = resolveClipPreviewTimelineSeconds({
      clientX: event.clientX,
      durationSeconds: durationSecondsRef.current,
      rail: railRef.current,
    });
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
      applyTrimDrag(dragState.edge, event.clientX);
      return;
    }

    applySelectionDrag(dragState, event.clientX);
  };

  const handleRailPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    clearSelectionGrabTimeout();
    const dragState = dragStateRef.current;
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
    dragStateRef.current = null;
    setSelectionDragging(false);
  };

  const handleStartPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (disabled) {
      return;
    }

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

    const seconds = resolveClipPreviewTimelineSeconds({
      clientX: event.clientX,
      durationSeconds: durationSecondsRef.current,
      rail: railRef.current,
    });
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
    selectionGrabTimeoutRef.current = window.setTimeout(() => {
      const dragState = dragStateRef.current;
      if (
        dragState?.kind !== "selection" ||
        dragState.pointerId !== event.pointerId
      ) {
        return;
      }

      dragState.canMove = true;
      setSelectionDragging(true);
    }, selectionGrabDelayMs);
  };

  useEffect(
    () => () => {
      clearSelectionGrabTimeout();
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
