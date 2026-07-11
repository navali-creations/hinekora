import { useEffect, useRef } from "react";

import type { ClipPreviewTrimRange } from "../../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import {
  createTrimEdgeDragRange,
  createTrimSelectionDragRange,
  readTrimRailBounds,
  resolveTrimRailSeconds,
  type TrimDragEdge,
  type TrimDragState,
} from "../ClipPreviewTrimRail.utils";

interface ClipPreviewTrimDragControllerInput {
  durationSeconds: number;
  onTrimCommit: (trim: ClipPreviewTrimRange) => void;
  onTrimPreview: (
    trim: ClipPreviewTrimRange,
    options: { previewSeconds: number },
  ) => void;
  syncTrimPresentation: (trim: ClipPreviewTrimRange) => void;
  trim: ClipPreviewTrimRange;
}

function useClipPreviewTrimDragController({
  durationSeconds,
  onTrimCommit,
  onTrimPreview,
  syncTrimPresentation,
  trim,
}: ClipPreviewTrimDragControllerInput) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<TrimDragState | null>(null);
  const durationSecondsRef = useRef(durationSeconds);
  const railBoundsRef = useRef<{ left: number; width: number } | null>(null);
  const trimRef = useRef(trim);
  const committedTrimRef = useRef(trim);
  const lastDragMoveTimeRef = useRef(0);

  durationSecondsRef.current = durationSeconds;
  if (!dragStateRef.current) {
    trimRef.current = trim;
    committedTrimRef.current = trim;
  }

  const previewTrim = (
    nextTrim: ClipPreviewTrimRange,
    previewSeconds: number,
  ) => {
    trimRef.current = nextTrim;
    syncTrimPresentation(nextTrim);
    onTrimPreview(nextTrim, { previewSeconds });
  };

  const commitTrim = () => {
    const nextTrim = trimRef.current;
    const committedTrim = committedTrimRef.current;
    if (
      nextTrim.inSeconds === committedTrim.inSeconds &&
      nextTrim.outSeconds === committedTrim.outSeconds
    ) {
      return;
    }

    committedTrimRef.current = nextTrim;
    onTrimCommit(nextTrim);
  };

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
      nextTrim.inSeconds !== currentTrim.inSeconds ||
      nextTrim.outSeconds !== currentTrim.outSeconds
    ) {
      previewTrim(
        nextTrim,
        edge === "end" ? nextTrim.outSeconds : nextTrim.inSeconds,
      );
    }
  };

  const applySelectionDrag = (
    state: Extract<TrimDragState, { kind: "selection" }>,
    clientX: number,
  ) => {
    const seconds = resolveTimelineSeconds(clientX);
    if (seconds === null || !state.canMove) {
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
      nextTrim.inSeconds !== currentTrim.inSeconds ||
      nextTrim.outSeconds !== currentTrim.outSeconds
    ) {
      previewTrim(nextTrim, nextTrim.inSeconds);
    }
  };

  useEffect(
    () => () => {
      lastDragMoveTimeRef.current = 0;
      dragStateRef.current = null;
    },
    [],
  );

  return {
    applySelectionDrag,
    applyTrimDrag,
    cacheRailBounds,
    commitTrim,
    dragStateRef,
    lastDragMoveTimeRef,
    railRef,
    resolveTimelineSeconds,
    trimRef,
  };
}

export { useClipPreviewTrimDragController };
