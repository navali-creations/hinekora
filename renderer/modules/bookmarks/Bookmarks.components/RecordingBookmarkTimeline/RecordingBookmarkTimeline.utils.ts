import {
  calculateTimelineMarkers,
  calculateTimelineMinorMarkers,
  calculateTimelinePercent,
  clampTimelineSeconds,
  formatMediaTime,
  formatTimelineRailLeft,
  formatTimelineRailWidth,
  type MediaClipTargetSegment,
  resolveMediaClipTargetSegment,
  resolveTimelineSecondsFromClientX,
} from "~/renderer/modules/media-playback/MediaTimeline.utils/MediaTimeline.utils";

const recordingTimelineRailPaddingPixels = 24;

interface ResolveRecordingTimelineSecondsFromClientXInput {
  clientX: number;
  durationSeconds: number;
  timelineGrid: HTMLElement | null;
}

type RecordingClipTargetRulerSegment = MediaClipTargetSegment;

function calculateRecordingTimelinePercent(
  seconds: number | null,
  durationSeconds: number,
): number {
  return calculateTimelinePercent(seconds, durationSeconds);
}

function calculateRecordingTimelineMarkers(durationSeconds: number): number[] {
  return calculateTimelineMarkers(durationSeconds);
}

function calculateRecordingTimelineMinorMarkers(
  durationSeconds: number,
): number[] {
  return calculateTimelineMinorMarkers(durationSeconds);
}

function formatRecordingTimelineRailLeft(percent: number): string {
  return formatTimelineRailLeft(percent, recordingTimelineRailPaddingPixels);
}

function formatRecordingTimelineRailWidth(percent: number): string {
  return formatTimelineRailWidth(percent, recordingTimelineRailPaddingPixels);
}

function formatRecordingTimelineMarker(seconds: number): string {
  return formatRecordingTimelineTime(seconds);
}

function formatRecordingTimelineTimestamp(
  seconds: number | null | undefined,
): string {
  return formatMediaTime(seconds, true);
}

function formatRecordingTimelineTime(
  seconds: number | null | undefined,
): string {
  return formatMediaTime(seconds);
}

function clampRecordingTimelineSeconds(
  seconds: number,
  durationSeconds: number,
): number {
  return clampTimelineSeconds(seconds, durationSeconds);
}

function resolveRecordingClipTargetRulerSegment(input: {
  durationSeconds: number | null;
  offsetSeconds: number | null;
  targetDurationSeconds: number | null;
}): RecordingClipTargetRulerSegment | null {
  return resolveMediaClipTargetSegment(input);
}

function resolveRecordingTimelineSecondsFromClientX({
  clientX,
  durationSeconds,
  timelineGrid,
}: ResolveRecordingTimelineSecondsFromClientXInput): number | null {
  return resolveTimelineSecondsFromClientX({
    clientX,
    durationSeconds,
    railPaddingPixels: recordingTimelineRailPaddingPixels,
    timelineGrid,
  });
}

export type { RecordingClipTargetRulerSegment };
export {
  calculateRecordingTimelineMarkers,
  calculateRecordingTimelineMinorMarkers,
  calculateRecordingTimelinePercent,
  clampRecordingTimelineSeconds,
  formatRecordingTimelineMarker,
  formatRecordingTimelineRailLeft,
  formatRecordingTimelineRailWidth,
  formatRecordingTimelineTime,
  formatRecordingTimelineTimestamp,
  recordingTimelineRailPaddingPixels,
  resolveRecordingClipTargetRulerSegment,
  resolveRecordingTimelineSecondsFromClientX,
};
