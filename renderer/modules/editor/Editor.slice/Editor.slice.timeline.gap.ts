import { trackEvent } from "~/renderer/modules/umami";

import {
  calculateTimelineDuration,
  calculateTimelineGaps,
  roundToMilliseconds,
} from "../Editor.utils/Editor.utils";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorSlice } from "./Editor.slice.types";

type EditorTimelineGapActions = Pick<
  EditorSlice["editor"],
  | "removeAllTimelineGaps"
  | "removeTimelineGap"
  | "setHoveredTimelineGap"
  | "setTimelineGapsHighlighted"
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
          const currentGap = calculateTimelineGaps(
            project.tracks.filter((track) => track.kind === "video"),
            project.durationSeconds,
          ).find(
            (item) =>
              item.startSeconds <= gapStartSeconds &&
              item.endSeconds >= gapEndSeconds,
          );
          if (!currentGap) {
            return project;
          }

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
      trackEvent("editor-gap-deleted");
    },
    removeAllTimelineGaps: () => {
      set((state) => {
        state.editor.areTimelineGapsHighlighted = false;
        state.editor.hoveredTimelineGap = null;
      });

      let didRemoveAnyGap = false;
      updateProject(
        (project) => {
          let didCompact = false;
          const tracks = project.tracks.map((track) => {
            let cursorSeconds = 0;
            const clips = [...track.clips]
              .sort(
                (first, second) =>
                  first.startSeconds - second.startSeconds ||
                  first.id.localeCompare(second.id),
              )
              .map((clip) => {
                const startSeconds = roundToMilliseconds(cursorSeconds);
                cursorSeconds = roundToMilliseconds(
                  startSeconds + clip.durationSeconds,
                );

                if (clip.startSeconds === startSeconds) {
                  return clip;
                }

                didCompact = true;
                return {
                  ...clip,
                  startSeconds,
                };
              });

            return {
              ...track,
              clips,
            };
          });

          const durationSeconds = calculateTimelineDuration(tracks);
          if (!didCompact && durationSeconds === project.durationSeconds) {
            return project;
          }

          didRemoveAnyGap = true;
          return {
            ...project,
            durationSeconds,
            tracks,
            updatedAt: new Date().toISOString(),
          };
        },
        { historyLabel: "Clear gaps" },
      );
      if (didRemoveAnyGap) {
        trackEvent("editor-all-gaps-deleted");
      }
    },
    setHoveredTimelineGap: (gap) => {
      set((state) => {
        state.editor.hoveredTimelineGap = gap;
      });
    },
    setTimelineGapsHighlighted: (isHighlighted) => {
      set((state) => {
        state.editor.areTimelineGapsHighlighted = isHighlighted;
      });
    },
  };
}

export { createEditorTimelineGapActions };
