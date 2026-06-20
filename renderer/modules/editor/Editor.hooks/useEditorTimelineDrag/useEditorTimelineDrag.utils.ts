import type { EditorTimelineClip } from "~/main/modules/editor";

import {
  resolveTimelineClipSnap,
  type TimelineTrimEdge,
} from "../../Editor.utils/Editor.utils";

type TimelineDragState =
  | {
      kind: "playhead";
      pointerId: number;
      visibleDurationSeconds: number;
    }
  | {
      clipId: string;
      clipDurationSeconds: number;
      clipHeightPixels: number;
      grabOffsetSeconds: number;
      grabOffsetYPixels: number;
      hasTransaction: boolean;
      isMoving: boolean;
      kind: "move";
      latestCursorSeconds: number | null;
      latestPreview: TimelineClipDragPreview | null;
      pointerId: number;
      startClientX: number;
      visibleDurationSeconds: number;
    }
  | {
      clipId: string;
      edge: TimelineTrimEdge;
      kind: "trim";
      pointerId: number;
      visibleDurationSeconds: number;
    };

interface TimelineBounds {
  bounds: DOMRect;
  timelineLeft: number;
  timelineWidth: number;
}

interface TimelineClipDragPreview {
  clipId: string;
  heightPixels: number;
  snapSeconds: number | null;
  startSeconds: number;
  topPixels: number;
}

const snapThresholdPixels = 10;

function resolveClipDragPreview(input: {
  clientY: number;
  dragState: Extract<TimelineDragState, { kind: "move" }>;
  timelineBounds: TimelineBounds;
  timelineClips: EditorTimelineClip[];
  timelineSeconds: number;
}): TimelineClipDragPreview {
  const unsnappedStartSeconds = Math.min(
    Math.max(input.timelineSeconds - input.dragState.grabOffsetSeconds, 0),
    Math.max(
      input.dragState.visibleDurationSeconds -
        input.dragState.clipDurationSeconds,
      0,
    ),
  );
  const snapThresholdSeconds =
    (snapThresholdPixels / Math.max(input.timelineBounds.timelineWidth, 1)) *
    input.dragState.visibleDurationSeconds;
  const snap = resolveTimelineClipSnap({
    clipId: input.dragState.clipId,
    clips: input.timelineClips,
    durationSeconds: input.dragState.clipDurationSeconds,
    startSeconds: unsnappedStartSeconds,
    thresholdSeconds: snapThresholdSeconds,
  });
  const topPixels = Math.min(
    Math.max(
      input.clientY -
        input.timelineBounds.bounds.top -
        input.dragState.grabOffsetYPixels,
      0,
    ),
    Math.max(
      input.timelineBounds.bounds.height - input.dragState.clipHeightPixels,
      0,
    ),
  );

  return {
    clipId: input.dragState.clipId,
    heightPixels: input.dragState.clipHeightPixels,
    snapSeconds: snap.snapSeconds,
    startSeconds: snap.startSeconds,
    topPixels,
  };
}

export type { TimelineBounds, TimelineClipDragPreview, TimelineDragState };
export { resolveClipDragPreview };
