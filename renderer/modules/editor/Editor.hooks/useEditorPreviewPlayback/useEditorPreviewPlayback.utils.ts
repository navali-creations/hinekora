import type { EditorTimelineClip } from "~/main/modules/editor";

function isPlaybackInsideClip(input: {
  clip: EditorTimelineClip;
  playbackSeconds: number;
}): boolean {
  const clipEndSeconds = input.clip.startSeconds + input.clip.durationSeconds;

  return (
    input.clip.startSeconds <= input.playbackSeconds &&
    input.playbackSeconds < clipEndSeconds
  );
}

export { isPlaybackInsideClip };
