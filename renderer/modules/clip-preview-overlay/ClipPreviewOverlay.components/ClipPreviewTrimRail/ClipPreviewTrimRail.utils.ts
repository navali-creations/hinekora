import {
  type ClipPreviewTrimRange,
  clampClipPreviewPlaybackSeconds,
  clampClipPreviewTrimRange,
  moveClipPreviewTrimRange,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

type TrimDragEdge = "end" | "start";
interface UseClipPreviewTrimRailDragInput {
  disabled: boolean;
  durationSeconds: number;
  trim: ClipPreviewTrimRange;
  onSeek: (seconds: number, options?: { preservePlayback?: boolean }) => void;
  onTrimCommit: (trim: ClipPreviewTrimRange) => void;
  onTrimPreview: (
    trim: ClipPreviewTrimRange,
    options: { previewSeconds: number },
  ) => void;
  syncTrimPresentation: (trim: ClipPreviewTrimRange) => void;
}
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

function resolveTrimRailSeconds(input: {
  bounds: { left: number; width: number } | null;
  clientX: number;
  durationSeconds: number;
}): number | null {
  if (!input.bounds || input.bounds.width <= 0 || input.durationSeconds <= 0) {
    return null;
  }
  return clampClipPreviewPlaybackSeconds(
    ((input.clientX - input.bounds.left) / input.bounds.width) *
      input.durationSeconds,
    input.durationSeconds,
  );
}

function resolveTrimRailSeekSeconds(
  seconds: number,
  trim: ClipPreviewTrimRange,
): number {
  return Math.min(Math.max(seconds, trim.inSeconds), trim.outSeconds);
}

function createTrimEdgeDragRange(input: {
  durationSeconds: number;
  edge: TrimDragEdge;
  seconds: number;
  trim: ClipPreviewTrimRange;
}): ClipPreviewTrimRange {
  return clampClipPreviewTrimRange({
    durationSeconds: input.durationSeconds,
    inSeconds: input.edge === "start" ? input.seconds : input.trim.inSeconds,
    outSeconds: input.edge === "end" ? input.seconds : input.trim.outSeconds,
  });
}

function createTrimSelectionDragRange(input: {
  durationSeconds: number;
  grabOffsetSeconds: number;
  seconds: number;
  trimDurationSeconds: number;
}): ClipPreviewTrimRange {
  return moveClipPreviewTrimRange({
    durationSeconds: input.durationSeconds,
    inSeconds: input.seconds - input.grabOffsetSeconds,
    trimDurationSeconds: input.trimDurationSeconds,
  });
}

function readTrimRailBounds(
  rail: HTMLDivElement | null,
): { left: number; width: number } | null {
  const bounds = rail?.getBoundingClientRect();
  return bounds && bounds.width > 0
    ? { left: bounds.left, width: bounds.width }
    : null;
}

function shouldProcessTrimRailMove(
  timeStamp: number,
  lastMoveTime: number,
): boolean {
  return timeStamp <= 0 || timeStamp - lastMoveTime >= moveThrottleMs;
}

export type { TrimDragEdge, TrimDragState, UseClipPreviewTrimRailDragInput };
export {
  createTrimEdgeDragRange,
  createTrimSelectionDragRange,
  readTrimRailBounds,
  resolveTrimRailSeconds,
  resolveTrimRailSeekSeconds,
  selectionGrabDelayMs,
  shouldProcessTrimRailMove,
};
