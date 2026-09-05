import type { EditorTimelineClip } from "~/main/modules/editor";

const playbackSyncToleranceSeconds = 0.08;

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

function shouldSynchronizeEditorPreviewSource(input: {
  currentSeconds: number;
  isPlaying: boolean;
  sourceSeconds: number;
}): boolean {
  return (
    !input.isPlaying ||
    Math.abs(input.currentSeconds - input.sourceSeconds) >
      playbackSyncToleranceSeconds
  );
}

export {
  findContiguousTimelineClip,
  isPlaybackInsideClip,
  shouldSynchronizeEditorPreviewSource,
};
