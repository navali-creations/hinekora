type MediaFrameStepDirection = -1 | 1;

const maximumFrameBoundaryToleranceSeconds = 0.000_75;
const frameBoundaryToleranceRatio = 0.05;

function resolveMediaFrameStepDirection(
  event: KeyboardEvent,
): MediaFrameStepDirection | null {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return null;
  }

  if (event.key === ",") {
    return -1;
  }

  return event.key === "." ? 1 : null;
}

function resolveMediaFrameStepSeconds(input: {
  currentSeconds: number;
  direction: MediaFrameStepDirection;
  framesPerSecond: number;
  originSeconds?: number;
}): number {
  if (
    !Number.isFinite(input.currentSeconds) ||
    !Number.isFinite(input.framesPerSecond) ||
    input.framesPerSecond <= 0
  ) {
    return input.currentSeconds;
  }

  const originSeconds =
    input.originSeconds !== undefined && Number.isFinite(input.originSeconds)
      ? input.originSeconds
      : 0;
  const framePosition =
    (input.currentSeconds - originSeconds) * input.framesPerSecond;
  const nearestFrameIndex = Math.round(framePosition);
  const frameBoundaryToleranceSeconds = Math.min(
    maximumFrameBoundaryToleranceSeconds,
    frameBoundaryToleranceRatio / input.framesPerSecond,
  );
  const isAtFrameBoundary =
    Math.abs(
      input.currentSeconds -
        (originSeconds + nearestFrameIndex / input.framesPerSecond),
    ) <= frameBoundaryToleranceSeconds;
  const currentFrameIndex = isAtFrameBoundary
    ? nearestFrameIndex
    : Math.floor(framePosition);

  return (
    originSeconds +
    (currentFrameIndex + input.direction) / input.framesPerSecond
  );
}

export type { MediaFrameStepDirection };
export { resolveMediaFrameStepDirection, resolveMediaFrameStepSeconds };
