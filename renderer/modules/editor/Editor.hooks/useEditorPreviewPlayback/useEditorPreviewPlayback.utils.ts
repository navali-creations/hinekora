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

function findContiguousTimelineClip(input: {
  currentClip: EditorTimelineClip;
  timelineClips: EditorTimelineClip[];
  toleranceSeconds: number;
}): EditorTimelineClip | null {
  const clipEndSeconds =
    input.currentClip.startSeconds + input.currentClip.durationSeconds;

  return (
    input.timelineClips.find(
      (clip) =>
        clip.id !== input.currentClip.id &&
        Math.abs(clip.startSeconds - clipEndSeconds) <= input.toleranceSeconds,
    ) ?? null
  );
}

export { findContiguousTimelineClip, isPlaybackInsideClip };
