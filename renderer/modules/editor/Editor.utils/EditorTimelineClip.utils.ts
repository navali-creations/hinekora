import type {
  EditorMediaAsset,
  EditorTimelineClip,
} from "~/main/modules/editor";

import { normalizeEditorDuration } from "./EditorTime.utils";

export {
  moveTimelineClipWithinTrack,
  resolveTimelineClipSnap,
  type TimelineClipSnap,
} from "./EditorTimelineMove.utils";
export {
  clampTrimRange,
  createEditorTrimHistoryLabel,
  minimumTimelineClipDurationSeconds,
  resolveTimelineClipSourceRange,
  type TimelineTrimEdge,
  trimTimelineClipEdge,
} from "./EditorTimelineTrim.utils";

function createTimelineClipFromAsset(input: {
  asset: EditorMediaAsset;
  id: string;
  startSeconds: number;
  trackId: string;
}): EditorTimelineClip {
  const durationSeconds = normalizeEditorDuration(input.asset.durationSeconds);

  return {
    assetKey: input.asset.assetKey,
    color: input.asset.kind === "clip" ? "primary" : "secondary",
    durationSeconds,
    id: input.id,
    inSeconds: 0,
    mediaUrl: input.asset.mediaUrl,
    name: input.asset.name,
    outSeconds: durationSeconds,
    sourceInSeconds: 0,
    sourceOutSeconds: durationSeconds,
    startSeconds: input.startSeconds,
    trackId: input.trackId,
  };
}

export { createTimelineClipFromAsset };
