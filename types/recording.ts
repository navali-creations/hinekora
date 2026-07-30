const rewindBufferSeconds = 90;
const minRewindSaveSeconds = 1;
const maxRewindSaveSeconds = 60;
const defaultRewindSaveSeconds = 10;
const rewindDurationPresetSeconds = [5, 10, 15, 30, 45, 60] as const;
const replayClipPlaybackRates = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;
const defaultReplayClipPlaybackRate = 1;
const storageCleanupTargetRatio = 0.95;
const storageBytesPerGigabyte = 1024 ** 3;

function clampRewindSaveSeconds(seconds: number): number {
  return Math.min(
    maxRewindSaveSeconds,
    Math.max(minRewindSaveSeconds, Math.round(seconds)),
  );
}

type ReplayClipPlaybackRate = (typeof replayClipPlaybackRates)[number];

function isReplayClipPlaybackRate(
  value: unknown,
): value is ReplayClipPlaybackRate {
  return replayClipPlaybackRates.some((rate) => rate === value);
}

export {
  clampRewindSaveSeconds,
  defaultReplayClipPlaybackRate,
  defaultRewindSaveSeconds,
  isReplayClipPlaybackRate,
  maxRewindSaveSeconds,
  minRewindSaveSeconds,
  type ReplayClipPlaybackRate,
  replayClipPlaybackRates,
  rewindBufferSeconds,
  rewindDurationPresetSeconds,
  storageBytesPerGigabyte,
  storageCleanupTargetRatio,
};
