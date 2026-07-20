import type { EditorProject } from "~/main/modules/editor";

import {
  type EditorTimelinePlaybackRate,
  editorTimelinePlaybackRates,
} from "~/types";
import { canSetTimelineClipPlaybackRate } from "../../Editor.utils/Editor.utils";

function createUnavailablePlaybackRates(input: {
  clipId: string | null;
  project: EditorProject | null;
}): ReadonlySet<EditorTimelinePlaybackRate> {
  const { clipId, project } = input;
  if (!project || !clipId) {
    return new Set(editorTimelinePlaybackRates);
  }

  return new Set(
    editorTimelinePlaybackRates.filter(
      (playbackRate) =>
        !canSetTimelineClipPlaybackRate({
          clipId,
          playbackRate,
          project,
        }),
    ),
  );
}

function resolveSpeedMenuPosition(trigger: HTMLButtonElement | null): {
  bottom: number;
  left: number;
} | null {
  const triggerBounds = trigger?.getBoundingClientRect();
  if (!triggerBounds) {
    return null;
  }

  return {
    bottom: window.innerHeight - triggerBounds.top + 4,
    left: triggerBounds.left + triggerBounds.width / 2,
  };
}

function getEnabledMenuItems(
  items: Array<HTMLButtonElement | null>,
): HTMLButtonElement[] {
  return items.filter(
    (item): item is HTMLButtonElement => item !== null && !item.disabled,
  );
}

export {
  createUnavailablePlaybackRates,
  getEnabledMenuItems,
  resolveSpeedMenuPosition,
};
