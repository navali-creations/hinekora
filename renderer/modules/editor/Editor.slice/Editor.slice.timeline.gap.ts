import {
  calculateTimelineDuration,
  roundToMilliseconds,
} from "../Editor.utils/Editor.utils";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorSlice } from "./Editor.slice.types";

type EditorTimelineGapActions = Pick<
  EditorSlice["editor"],
  "removeTimelineGap" | "setHoveredTimelineGap"
>;

function createEditorTimelineGapActions({
  set,
  updateProject,
}: EditorSliceActionContext): EditorTimelineGapActions {
  return {
    removeTimelineGap: (gap) => {
      set((state) => {
        state.editor.hoveredTimelineGap = null;
      });
      const gapStartSeconds = roundToMilliseconds(gap.startSeconds);
      const gapEndSeconds = roundToMilliseconds(gap.endSeconds);
      const gapDurationSeconds = roundToMilliseconds(
        gapEndSeconds - gapStartSeconds,
      );
      if (gapDurationSeconds <= 0) {
        return;
      }

      updateProject(
        (project) => {
          const tracks = project.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) =>
              clip.startSeconds >= gapEndSeconds
                ? {
                    ...clip,
                    startSeconds: roundToMilliseconds(
                      clip.startSeconds - gapDurationSeconds,
                    ),
                  }
                : clip,
            ),
          }));

          return {
            ...project,
            durationSeconds: calculateTimelineDuration(tracks),
            tracks,
            updatedAt: new Date().toISOString(),
          };
        },
        { historyLabel: "Delete gap" },
      );
    },
    setHoveredTimelineGap: (gap) => {
      set((state) => {
        state.editor.hoveredTimelineGap = gap;
      });
    },
  };
}

export { createEditorTimelineGapActions };
