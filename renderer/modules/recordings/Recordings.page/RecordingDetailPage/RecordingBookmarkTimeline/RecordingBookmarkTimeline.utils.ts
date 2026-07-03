const recordingTimelineRailPaddingPixels = 24;
const markerIntervalsSeconds = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200];

interface ResolveRecordingTimelineSecondsFromClientXInput {
  clientX: number;
  durationSeconds: number;
  timelineGrid: HTMLElement | null;
}

function calculateRecordingTimelinePercent(
  seconds: number | null,
  durationSeconds: number,
): number {
  if (seconds === null || !Number.isFinite(seconds) || durationSeconds <= 0) {
    return 0;
  }

  return Math.min(Math.max((seconds / durationSeconds) * 100, 0), 100);
}

function calculateRecordingTimelineMarkers(durationSeconds: number): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return [0];
  }

  const interval = resolveMarkerInterval(durationSeconds / 6);
  const markerCount = Math.floor(durationSeconds / interval) + 1;
  const markers = Array.from({ length: markerCount }, (_, index) =>
    roundTimelineSeconds(index * interval),
  );
  const roundedDuration = roundTimelineSeconds(durationSeconds);
  if ((markers.at(-1) ?? 0) < roundedDuration) {
    markers.push(roundedDuration);
  }

  return markers;
}

function calculateRecordingTimelineMinorMarkers(
  durationSeconds: number,
): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return [];
  }

  const interval = resolveMarkerInterval(durationSeconds / 6);
  const minorInterval = interval / 5;
  const minorCount = Math.floor(durationSeconds / minorInterval);

  return Array.from({ length: minorCount }, (_, index) =>
    roundTimelineSeconds((index + 1) * minorInterval),
  ).filter(
    (marker) => marker < durationSeconds && Math.abs(marker % interval) > 0.001,
  );
}

function formatRecordingTimelineRailLeft(percent: number): string {
  return `calc(${recordingTimelineRailPaddingPixels}px + (100% - ${
    recordingTimelineRailPaddingPixels * 2
  }px) * ${percent / 100})`;
}

function formatRecordingTimelineRailWidth(percent: number): string {
  return `calc((100% - ${
    recordingTimelineRailPaddingPixels * 2
  }px) * ${percent / 100})`;
}

function formatRecordingTimelineMarker(seconds: number): string {
  return formatRecordingTimelineTime(seconds);
}

function formatRecordingTimelineTimestamp(
  seconds: number | null | undefined,
): string {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return "0:00.00";
  }

  const roundedCentiseconds = Math.round(seconds * 100);
  const minutes = Math.floor(roundedCentiseconds / 6_000);
  const remainingCentiseconds = roundedCentiseconds % 6_000;
  const wholeSeconds = Math.floor(remainingCentiseconds / 100);
  const centiseconds = remainingCentiseconds % 100;

  return `${minutes}:${wholeSeconds.toString().padStart(2, "0")}.${centiseconds
    .toString()
    .padStart(2, "0")}`;
}

function formatRecordingTimelineTime(
  seconds: number | null | undefined,
): string {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return "0:00";
  }

  const roundedSeconds = Math.round(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function clampRecordingTimelineSeconds(
  seconds: number,
  durationSeconds: number,
): number {
  if (!Number.isFinite(seconds)) {
    return 0;
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return Math.max(0, seconds);
  }

  return Math.min(Math.max(seconds, 0), durationSeconds);
}

function resolveRecordingTimelineSecondsFromClientX({
  clientX,
  durationSeconds,
  timelineGrid,
}: ResolveRecordingTimelineSecondsFromClientXInput): number | null {
  if (!timelineGrid || durationSeconds <= 0) {
    return null;
  }

  const bounds = timelineGrid.getBoundingClientRect();
  const timelineLeft = bounds.left + recordingTimelineRailPaddingPixels;
  const timelineRight = bounds.right - recordingTimelineRailPaddingPixels;
  if (clientX < timelineLeft || clientX > timelineRight) {
    return null;
  }

  const timelineWidth = bounds.width - recordingTimelineRailPaddingPixels * 2;
  if (timelineWidth <= 0) {
    return null;
  }

  return clampRecordingTimelineSeconds(
    ((clientX - timelineLeft) / timelineWidth) * durationSeconds,
    durationSeconds,
  );
}

function resolveMarkerInterval(targetSeconds: number): number {
  return (
    markerIntervalsSeconds.find((interval) => interval >= targetSeconds) ??
    Math.ceil(targetSeconds / 1200) * 1200
  );
}

function roundTimelineSeconds(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

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
  resolveRecordingTimelineSecondsFromClientX,
};
