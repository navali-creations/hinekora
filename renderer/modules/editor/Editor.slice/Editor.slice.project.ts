import { trackEvent } from "~/renderer/modules/umami";

import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorSlice } from "./Editor.slice.types";

type EditorProjectActions = Pick<
  EditorSlice["editor"],
  "toggleProjectAudioMuted"
>;

function createEditorProjectActions({
  get,
  updateProject,
}: EditorSliceActionContext): EditorProjectActions {
  return {
    toggleProjectAudioMuted: () => {
      const project = get().editor.project;
      if (!project) {
        return;
      }

      const isAudioMuted = project.isAudioMuted !== true;
      updateProject(
        (project) => {
          return {
            ...project,
            isAudioMuted,
            updatedAt: new Date().toISOString(),
          };
        },
        { historyLabel: isAudioMuted ? "Mute audio" : "Unmute audio" },
      );
      trackEvent("editor-audio-mute-toggled", {
        muted: isAudioMuted,
      });
    },
  };
}

export { createEditorProjectActions };
