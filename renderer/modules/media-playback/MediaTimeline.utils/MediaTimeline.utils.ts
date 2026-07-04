const defaultTimelineMarkerIntervalsSeconds = [
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200,
];

interface ResolveTimelineSecondsFromClientXInput {
  clientX: number;
  durationSeconds: number;
  railPaddingPixels: number;
  timelineGrid: HTMLElement | null;
}

function calculateTimelinePercent(
  seconds: number | null,
  durationSeconds: number,
): number {
  if (seconds === null || !Number.isFinite(seconds) || durationSeconds <= 0) {
    return 0;
  }

  return Math.min(Math.max((seconds / durationSeconds) * 100, 0), 100);
}

function calculateTimelineMarkers(durationSeconds: number): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return [0];
  }

  const interval = resolveTimelineMarkerInterval(durationSeconds / 6);
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

function calculateTimelineMinorMarkers(durationSeconds: number): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return [];
  }

  const interval = resolveTimelineMarkerInterval(durationSeconds / 6);
  const minorInterval = interval / 5;
  const minorCount = Math.floor(durationSeconds / minorInterval);

  return Array.from({ length: minorCount }, (_, index) =>
    roundTimelineSeconds((index + 1) * minorInterval),
  ).filter(
    (marker) => marker < durationSeconds && Math.abs(marker % interval) > 0.001,
  );
}

function clampTimelineSeconds(
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

function formatTimelineRailLeft(
  percent: number,
  railPaddingPixels: number,
): string {
  return `calc(${railPaddingPixels}px + (100% - ${
    railPaddingPixels * 2
  }px) * ${percent / 100})`;
}

function formatTimelineRailWidth(
  percent: number,
  railPaddingPixels: number,
): string {
  return `calc((100% - ${railPaddingPixels * 2}px) * ${percent / 100})`;
}

function resolveTimelineSecondsFromClientX({
  clientX,
  durationSeconds,
  railPaddingPixels,
  timelineGrid,
}: ResolveTimelineSecondsFromClientXInput): number | null {
  if (!timelineGrid || durationSeconds <= 0) {
    return null;
  }

  const bounds = timelineGrid.getBoundingClientRect();
  const timelineLeft = bounds.left + railPaddingPixels;
  const timelineRight = bounds.right - railPaddingPixels;
  if (clientX < timelineLeft || clientX > timelineRight) {
    return null;
  }

  const timelineWidth = bounds.width - railPaddingPixels * 2;
  if (timelineWidth <= 0) {
    return null;
  }

  return clampTimelineSeconds(
    ((clientX - timelineLeft) / timelineWidth) * durationSeconds,
    durationSeconds,
  );
}

function resolveTimelineMarkerInterval(targetSeconds: number): number {
  return (
    defaultTimelineMarkerIntervalsSeconds.find(
      (interval) => interval >= targetSeconds,
    ) ?? Math.ceil(targetSeconds / 1200) * 1200
  );
}

function roundTimelineSeconds(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

export {
  calculateTimelineMarkers,
  calculateTimelineMinorMarkers,
  calculateTimelinePercent,
  clampTimelineSeconds,
  formatTimelineRailLeft,
  formatTimelineRailWidth,
  resolveTimelineSecondsFromClientX,
};
