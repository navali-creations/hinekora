import {
  calculateTimelineDuration,
  createEditorTrimHistoryLabel,
  normalizeEditorDuration,
  resolveTimelineClipSourceRange,
  roundToMilliseconds,
  trimTimelineClipEdge as trimClipEdge,
} from "../Editor.utils/Editor.utils";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorSlice } from "./Editor.slice.types";

type EditorTimelineTrimActions = Pick<
  EditorSlice["editor"],
  "splitTimelineClipAt" | "trimTimelineClipEdge"
>;

function createEditorTimelineTrimActions({
  get,
  updateProject,
}: EditorSliceActionContext): EditorTimelineTrimActions {
  return {
    splitTimelineClipAt: (timelineSeconds) => {
      const splitSeconds = roundToMilliseconds(timelineSeconds);
      updateProject(
        (project) => {
          const assetByKey = new Map(
            project.assets.map((asset) => [asset.assetKey, asset] as const),
          );
          let selectedSplitAssetKey = "";
          let selectedSplitClipId = "";
          const tracks = project.tracks.map((track) => {
            const clipIndex = track.clips.findIndex(
              (clip) =>
                clip.startSeconds < splitSeconds &&
                clip.startSeconds + clip.durationSeconds > splitSeconds,
            );
            if (clipIndex === -1) {
              return track;
            }

            const clip = track.clips[clipIndex];
            if (!clip) {
              return track;
            }

            const firstDurationSeconds = roundToMilliseconds(
              splitSeconds - clip.startSeconds,
            );
            const secondDurationSeconds = roundToMilliseconds(
              clip.startSeconds + clip.durationSeconds - splitSeconds,
            );
            if (firstDurationSeconds <= 0 || secondDurationSeconds <= 0) {
              return track;
            }

            const asset = assetByKey.get(clip.assetKey);
            const sourceRange = resolveTimelineClipSourceRange({
              assetDurationSeconds: normalizeEditorDuration(
                asset?.durationSeconds ?? null,
              ),
              clip,
            });
            const playbackRate = clip.playbackRate;
            const firstClip = {
              ...clip,
              durationSeconds: firstDurationSeconds,
              outSeconds: roundToMilliseconds(
                clip.inSeconds + firstDurationSeconds * playbackRate,
              ),
              sourceInSeconds: sourceRange.sourceInSeconds,
              sourceOutSeconds: sourceRange.sourceOutSeconds,
            };
            const secondClip = {
              ...clip,
              durationSeconds: secondDurationSeconds,
              id: `timeline-${crypto.randomUUID()}`,
              inSeconds: firstClip.outSeconds,
              sourceInSeconds: sourceRange.sourceInSeconds,
              sourceOutSeconds: sourceRange.sourceOutSeconds,
              startSeconds: splitSeconds,
            };
            selectedSplitAssetKey = secondClip.assetKey;
            selectedSplitClipId = secondClip.id;

            return {
              ...track,
              clips: [
                ...track.clips.slice(0, clipIndex),
                firstClip,
                secondClip,
                ...track.clips.slice(clipIndex + 1),
              ],
            };
          });
          if (!selectedSplitAssetKey || !selectedSplitClipId) {
            return project;
          }

          return {
            ...project,
            activeClipId: selectedSplitClipId,
            selectedAssetKey: selectedSplitAssetKey,
            tracks,
            updatedAt: new Date().toISOString(),
          };
        },
        { historyLabel: "Split" },
      );
    },
    trimTimelineClipEdge: (clipId, edge, timelineSeconds) => {
      const trimActionLabel = createEditorTrimHistoryLabel(edge);
      const trimActionSubtitle =
        get()
          .editor.project?.tracks.flatMap((track) => track.clips)
          .find((clip) => clip.id === clipId)?.name ?? null;
      updateProject(
        (project) => {
          const assetByKey = new Map(
            project.assets.map((asset) => [asset.assetKey, asset] as const),
          );
          let didTrim = false;
          const tracks = project.tracks.map((track) => {
            const clipIndex = track.clips.findIndex(
              (timelineClip) => timelineClip.id === clipId,
            );
            if (clipIndex === -1) {
              return track;
            }

            const clip = track.clips[clipIndex];
            if (!clip) {
              return track;
            }

            const previousClip = track.clips[clipIndex - 1];
            const nextClip = track.clips[clipIndex + 1];
            const previousClipEndSeconds = previousClip
              ? roundToMilliseconds(
                  previousClip.startSeconds + previousClip.durationSeconds,
                )
              : 0;
            const asset = assetByKey.get(clip.assetKey);
            const trimmedClip = trimClipEdge({
              assetDurationSeconds: normalizeEditorDuration(
                asset?.durationSeconds ?? null,
              ),
              clip,
              edge,
              maxEndSeconds:
                edge === "end"
                  ? Number.POSITIVE_INFINITY
                  : (nextClip?.startSeconds ?? Number.POSITIVE_INFINITY),
              minStartSeconds: 0,
              timelineSeconds,
            });
            const resolvedTrimmedClip =
              edge === "start" && previousClip
                ? {
                    ...trimmedClip,
                    startSeconds: Math.max(
                      trimmedClip.startSeconds,
                      previousClipEndSeconds,
                    ),
                  }
                : trimmedClip;
            const clipDidTrim =
              resolvedTrimmedClip.durationSeconds !== clip.durationSeconds ||
              resolvedTrimmedClip.inSeconds !== clip.inSeconds ||
              resolvedTrimmedClip.outSeconds !== clip.outSeconds ||
              resolvedTrimmedClip.startSeconds !== clip.startSeconds;
            didTrim = didTrim || clipDidTrim;
            const trimmedClipEndSeconds = roundToMilliseconds(
              resolvedTrimmedClip.startSeconds +
                resolvedTrimmedClip.durationSeconds,
            );
            const pushSeconds = clipDidTrim
              ? roundToMilliseconds(
                  Math.max(
                    trimmedClipEndSeconds -
                      (nextClip?.startSeconds ?? Infinity),
                    0,
                  ),
                )
              : 0;

            return {
              ...track,
              clips: track.clips.map((timelineClip, timelineClipIndex) =>
                timelineClip.id === clipId && clipDidTrim
                  ? resolvedTrimmedClip
                  : pushSeconds > 0 && timelineClipIndex > clipIndex
                    ? {
                        ...timelineClip,
                        startSeconds: roundToMilliseconds(
                          timelineClip.startSeconds + pushSeconds,
                        ),
                      }
                    : timelineClip,
              ),
            };
          });
          if (!didTrim) {
            return project;
          }

          return {
            ...project,
            durationSeconds: calculateTimelineDuration(tracks),
            tracks,
            updatedAt: new Date().toISOString(),
          };
        },
        {
          historyLabel: trimActionLabel,
          historySubtitle: trimActionSubtitle,
        },
      );
    },
  };
}

export { createEditorTimelineTrimActions };
