import type { PointerEvent } from "react";
import { useRef, useState } from "react";

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
  onSeek: (seconds: number) => void;
  onTrimChange: (trim: ClipPreviewTrimRange) => void;
}

type TrimDragEdge = "end" | "start";
type TrimDragState =
  | { edge: TrimDragEdge; kind: "edge"; pointerId: number }
  | {
      grabOffsetSeconds: number;
      hasMoved: boolean;
      initialSeconds: number;
      kind: "selection";
      pointerId: number;
      trimDurationSeconds: number;
    };

function useClipPreviewTrimRailDrag({
  disabled,
  durationSeconds,
  trim,
  onSeek,
  onTrimChange,
}: UseClipPreviewTrimRailDragInput) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<TrimDragState | null>(null);
  const [isSelectionDragging, setSelectionDragging] = useState(false);

  const applyTrimDrag = (edge: TrimDragEdge, clientX: number) => {
    const seconds = resolveClipPreviewTimelineSeconds({
      clientX,
      durationSeconds,
      rail: railRef.current,
    });
    if (seconds === null) {
      return;
    }

    onTrimChange(
      clampClipPreviewTrimRange({
        durationSeconds,
        inSeconds: edge === "start" ? seconds : trim.inSeconds,
        outSeconds: edge === "end" ? seconds : trim.outSeconds,
      }),
    );
  };

  const applySelectionDrag = (
    state: Extract<TrimDragState, { kind: "selection" }>,
    clientX: number,
  ) => {
    const seconds = resolveClipPreviewTimelineSeconds({
      clientX,
      durationSeconds,
      rail: railRef.current,
    });
    if (seconds === null) {
      return;
    }

    state.hasMoved = true;
    const nextTrim = moveClipPreviewTrimRange({
      durationSeconds,
      inSeconds: seconds - state.grabOffsetSeconds,
      trimDurationSeconds: state.trimDurationSeconds,
    });
    onTrimChange(nextTrim);
    onSeek(nextTrim.inSeconds);
  };

  const resolveSeekSeconds = (seconds: number): number => {
    if (seconds < trim.inSeconds) {
      return trim.inSeconds;
    }

    if (seconds > trim.outSeconds) {
      return trim.outSeconds;
    }

    return seconds;
  };

  const handleRailPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    const seconds = resolveClipPreviewTimelineSeconds({
      clientX: event.clientX,
      durationSeconds,
      rail: railRef.current,
    });
    if (seconds !== null) {
      onSeek(resolveSeekSeconds(seconds));
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
    const dragState = dragStateRef.current;
    if (dragState?.kind === "selection" && !dragState.hasMoved) {
      onSeek(resolveSeekSeconds(dragState.initialSeconds));
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
      durationSeconds,
      rail: railRef.current,
    });
    if (seconds === null) {
      return;
    }

    railRef.current?.setPointerCapture(event.pointerId);
    setSelectionDragging(true);
    dragStateRef.current = {
      grabOffsetSeconds: seconds - trim.inSeconds,
      hasMoved: false,
      initialSeconds: seconds,
      kind: "selection",
      pointerId: event.pointerId,
      trimDurationSeconds: trim.outSeconds - trim.inSeconds,
    };
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
