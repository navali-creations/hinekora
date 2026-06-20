import type { EditorSliceActionContext } from "./Editor.slice.context";
import { createEditorTimelineClipActions } from "./Editor.slice.timeline.clip";
import { createEditorTimelineGapActions } from "./Editor.slice.timeline.gap";
import { createEditorTimelineTrimActions } from "./Editor.slice.timeline.trim";
import type { EditorSlice } from "./Editor.slice.types";

type EditorTimelineActions = Pick<
  EditorSlice["editor"],
  | "addAssetToTimelineAt"
  | "moveTimelineClip"
  | "removeTimelineClip"
  | "removeTimelineGap"
  | "setHoveredTimelineGap"
  | "splitTimelineClipAt"
  | "trimTimelineClipEdge"
>;

function createEditorTimelineActions(
  context: EditorSliceActionContext,
): EditorTimelineActions {
  return {
    ...createEditorTimelineClipActions(context),
    ...createEditorTimelineGapActions(context),
    ...createEditorTimelineTrimActions(context),
  };
}

export { createEditorTimelineActions };
