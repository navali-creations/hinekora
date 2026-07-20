import type {
  EditorMediaAsset,
  EditorProject,
  EditorTimelineClip,
} from "~/main/modules/editor";

import {
  calculateTimelineProjectDuration,
  defaultEditorTimelinePlaybackRate,
  type EditorTimelinePlaybackRate,
  maxEditorExportDurationSeconds,
} from "~/types";
import {
  normalizeEditorDuration,
  roundToMilliseconds,
} from "./EditorTime.utils";

export {
  moveTimelineClipWithinTrack,
  resolveTimelineClipSnap,
  type TimelineClipSnap,
} from "./EditorTimelineMove.utils";
export {
  clampTrimRange,
  createEditorTrimHistoryLabel,
  minimumTimelineClipDurationSeconds,
  resolveTimelineClipSourceRange,
  type TimelineTrimEdge,
  trimTimelineClipEdge,
} from "./EditorTimelineTrim.utils";

function createTimelineClipFromAsset(input: {
  asset: EditorMediaAsset;
  id: string;
  startSeconds: number;
  trackId: string;
}): EditorTimelineClip {
  const durationSeconds = normalizeEditorDuration(input.asset.durationSeconds);

  return {
    assetKey: input.asset.assetKey,
    color: input.asset.kind === "clip" ? "primary" : "secondary",
    durationSeconds,
    id: input.id,
    inSeconds: 0,
    mediaUrl: input.asset.mediaUrl,
    name: input.asset.name,
    outSeconds: durationSeconds,
    playbackRate: defaultEditorTimelinePlaybackRate,
    sourceInSeconds: 0,
    sourceOutSeconds: durationSeconds,
    startSeconds: input.startSeconds,
    trackId: input.trackId,
  };
}

function createTimelineClipPlaybackRateProject(input: {
  clipId: string;
  playbackRate: EditorTimelinePlaybackRate;
  project: EditorProject;
}): EditorProject {
  const change = resolveTimelineClipPlaybackRateChange(input);
  if (!change) {
    return input.project;
  }

  const tracks = input.project.tracks.map((track, trackIndex) => {
    if (trackIndex !== change.trackIndex) {
      return track;
    }

    const clips = track.clips.map((timelineClip, timelineClipIndex) => {
      if (timelineClipIndex === change.clipIndex) {
        return {
          ...timelineClip,
          durationSeconds: change.durationSeconds,
          playbackRate: input.playbackRate,
        };
      }
      if (change.pushSeconds > 0 && timelineClipIndex > change.clipIndex) {
        return {
          ...timelineClip,
          startSeconds: roundToMilliseconds(
            timelineClip.startSeconds + change.pushSeconds,
          ),
        };
      }

      return timelineClip;
    });

    return { ...track, clips };
  });

  const durationSeconds = calculateTimelineProjectDuration(tracks);
  if (durationSeconds > maxEditorExportDurationSeconds) {
    return input.project;
  }

  return {
    ...input.project,
    durationSeconds,
    tracks,
  };
}

function canSetTimelineClipPlaybackRate(input: {
  clipId: string;
  playbackRate: EditorTimelinePlaybackRate;
  project: EditorProject;
}): boolean {
  const clip = input.project.tracks
    .flatMap((track) => track.clips)
    .find((timelineClip) => timelineClip.id === input.clipId);
  if (!clip) {
    return false;
  }
  if (clip.playbackRate === input.playbackRate) {
    return true;
  }

  const change = resolveTimelineClipPlaybackRateChange(input);
  if (!change) {
    return false;
  }

  let durationSeconds = 0;
  for (const [trackIndex, track] of input.project.tracks.entries()) {
    for (const [clipIndex, timelineClip] of track.clips.entries()) {
      const isChangedTrack = trackIndex === change.trackIndex;
      const startSeconds =
        isChangedTrack && change.pushSeconds > 0 && clipIndex > change.clipIndex
          ? roundToMilliseconds(timelineClip.startSeconds + change.pushSeconds)
          : timelineClip.startSeconds;
      const clipDurationSeconds =
        isChangedTrack && clipIndex === change.clipIndex
          ? change.durationSeconds
          : timelineClip.durationSeconds;
      durationSeconds = Math.max(
        durationSeconds,
        startSeconds + clipDurationSeconds,
      );
    }
  }

  return durationSeconds <= maxEditorExportDurationSeconds;
}

function resolveTimelineClipPlaybackRateChange(input: {
  clipId: string;
  playbackRate: EditorTimelinePlaybackRate;
  project: EditorProject;
}): {
  clipIndex: number;
  durationSeconds: number;
  pushSeconds: number;
  trackIndex: number;
} | null {
  for (const [trackIndex, track] of input.project.tracks.entries()) {
    const clipIndex = track.clips.findIndex((clip) => clip.id === input.clipId);
    const clip = track.clips[clipIndex];
    if (!clip || clip.playbackRate === input.playbackRate) {
      continue;
    }

    const durationSeconds = calculateTimelineClipPlaybackRateDuration(
      clip,
      input.playbackRate,
    );
    const clipEndSeconds = roundToMilliseconds(
      clip.startSeconds + durationSeconds,
    );
    const nextClip = track.clips[clipIndex + 1];
    const pushSeconds = roundToMilliseconds(
      Math.max(
        clipEndSeconds - (nextClip?.startSeconds ?? Number.POSITIVE_INFINITY),
        0,
      ),
    );

    return { clipIndex, durationSeconds, pushSeconds, trackIndex };
  }

  return null;
}

function calculateTimelineClipPlaybackRateDuration(
  clip: Pick<EditorTimelineClip, "inSeconds" | "outSeconds">,
  playbackRate: EditorTimelinePlaybackRate,
): number {
  return roundToMilliseconds(
    Math.max(0.001, (clip.outSeconds - clip.inSeconds) / playbackRate),
  );
}

export {
  canSetTimelineClipPlaybackRate,
  createTimelineClipFromAsset,
  createTimelineClipPlaybackRateProject,
};
