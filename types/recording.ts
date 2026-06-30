const rewindBufferSeconds = 90;
const minRewindSaveSeconds = 1;
const maxRewindSaveSeconds = 60;
const defaultRewindSaveSeconds = 10;
const rewindDurationPresetSeconds = [5, 10, 15, 30, 45, 60] as const;

function clampRewindSaveSeconds(seconds: number): number {
  return Math.min(
    maxRewindSaveSeconds,
    Math.max(minRewindSaveSeconds, Math.round(seconds)),
  );
}

export {
  clampRewindSaveSeconds,
  defaultRewindSaveSeconds,
  maxRewindSaveSeconds,
  minRewindSaveSeconds,
  rewindBufferSeconds,
  rewindDurationPresetSeconds,
};
