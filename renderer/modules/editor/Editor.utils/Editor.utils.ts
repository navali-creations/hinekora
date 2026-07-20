import type { EditorProject } from "~/main/modules/editor";

function createEditorDefaultFileName(project: EditorProject | null): string {
  const asset =
    project?.assets.find(
      (item) => item.assetKey === project.selectedAssetKey,
    ) ??
    project?.assets[0] ??
    null;
  const name = asset?.name.trim() || project?.title.trim() || "Hinekora edit";

  return name.toLowerCase().endsWith(".mp4") ? name : `${name}.mp4`;
}

export {
  type EditorMediaAssetDragData,
  type EditorVideoTrackDropData,
  editorMediaAssetDragType,
  editorVideoTrackDropType,
  isEditorMediaAssetDragData,
  isEditorVideoTrackDropData,
} from "./EditorDragDrop.utils";
export {
  publishEditorPlaybackVisualTime,
  subscribeEditorPlaybackVisualTime,
} from "./EditorPlaybackVisualTime.utils";
export {
  formatEditorTime,
  formatEditorTimestamp,
  normalizeEditorDuration,
  roundToMilliseconds,
} from "./EditorTime.utils";
export {
  canSetTimelineClipPlaybackRate,
  clampTrimRange,
  createEditorTrimHistoryLabel,
  createTimelineClipFromAsset,
  createTimelineClipPlaybackRateProject,
  minimumTimelineClipDurationSeconds,
  moveTimelineClipWithinTrack,
  resolveTimelineClipSnap,
  resolveTimelineClipSourceRange,
  type TimelineClipSnap,
  type TimelineTrimEdge,
  trimTimelineClipEdge,
} from "./EditorTimelineClip.utils";
export {
  calculateEditorTimelineDuration,
  calculateEditorTimelineExpandableDuration,
  calculateExpandableTimelineDuration,
  calculateFittedTimelineDuration,
  calculateTimelineContentScale,
  calculateTimelineDuration,
  calculateTimelineGaps,
  calculateTimelineMarkers,
  calculateTimelineMinorMarkers,
  calculateTimelinePercent,
  clampEditorTimelineZoom,
  type EditorTimelineGap,
  resolveNextEditorTimelineZoom,
  resolveTimelineSecondsFromClientX,
} from "./EditorTimelineGeometry.utils";
export { createEditorDefaultFileName };
