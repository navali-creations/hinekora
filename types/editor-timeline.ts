const editorTimelinePlaybackRates = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4, 8, 16,
] as const;
const defaultEditorTimelinePlaybackRate = 1;
const maxEditorExportDurationSeconds = 4 * 60 * 60;

type EditorTimelinePlaybackRate = (typeof editorTimelinePlaybackRates)[number];

interface TimelineClipLike {
  durationSeconds: number;
  id: string;
  startSeconds: number;
}

interface TimelineTrackLike<TClip extends TimelineClipLike = TimelineClipLike> {
  clips: TClip[];
}

interface TimelineProjectLike<
  TTrack extends TimelineTrackLike = TimelineTrackLike,
> {
  durationSeconds: number;
  tracks: TTrack[];
}

interface NormalizeTimelineProjectOptions {
  preserveDuration?: boolean;
}

function calculateTimelineProjectDuration<TTrack extends TimelineTrackLike>(
  tracks: TTrack[],
): number {
  return tracks
    .flatMap((track) => track.clips)
    .reduce(
      (duration, clip) =>
        Math.max(duration, clip.startSeconds + clip.durationSeconds),
      0,
    );
}

function normalizeTimelineProject<TProject extends TimelineProjectLike>(
  project: TProject,
  options: NormalizeTimelineProjectOptions = {},
): TProject {
  let didChangeTracks = false;
  const tracks = project.tracks.map((track) => {
    const { clips, didChange } = normalizeTimelineTrackClips(track.clips);
    didChangeTracks = didChangeTracks || didChange;

    if (!didChange) {
      return track;
    }

    return {
      ...track,
      clips,
    };
  }) as TProject["tracks"];
  const timelineDurationSeconds = calculateTimelineProjectDuration(tracks);
  const durationSeconds = options.preserveDuration
    ? Math.max(project.durationSeconds, timelineDurationSeconds)
    : timelineDurationSeconds;
  if (!didChangeTracks && durationSeconds === project.durationSeconds) {
    return project;
  }

  return {
    ...project,
    durationSeconds,
    tracks,
  };
}

function normalizeTimelineTrackClips<TClip extends TimelineClipLike>(
  clips: TClip[],
): { clips: TClip[]; didChange: boolean } {
  let cursorSeconds = 0;
  let didChange = false;
  const sortedClips = [...clips].sort(
    (first, second) =>
      first.startSeconds - second.startSeconds ||
      first.id.localeCompare(second.id),
  );
  const normalizedClips = sortedClips.map((clip, index) => {
    didChange = didChange || clip !== clips[index];
    const startSeconds = roundTimelineSeconds(
      Math.max(clip.startSeconds, cursorSeconds, 0),
    );
    cursorSeconds = roundTimelineSeconds(startSeconds + clip.durationSeconds);

    if (startSeconds === clip.startSeconds) {
      return clip;
    }

    didChange = true;
    return {
      ...clip,
      startSeconds,
    };
  });

  return {
    clips: didChange ? normalizedClips : clips,
    didChange,
  };
}

function roundTimelineSeconds(seconds: number): number {
  return Math.round(seconds * 1_000) / 1_000;
}

function isEditorTimelinePlaybackRate(
  value: unknown,
): value is EditorTimelinePlaybackRate {
  return editorTimelinePlaybackRates.some((rate) => rate === value);
}

export {
  calculateTimelineProjectDuration,
  defaultEditorTimelinePlaybackRate,
  type EditorTimelinePlaybackRate,
  editorTimelinePlaybackRates,
  isEditorTimelinePlaybackRate,
  maxEditorExportDurationSeconds,
  type NormalizeTimelineProjectOptions,
  normalizeTimelineProject,
};
