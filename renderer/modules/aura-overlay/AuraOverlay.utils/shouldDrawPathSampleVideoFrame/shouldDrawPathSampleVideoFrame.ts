const pathSampleVideoMaxFps = 60;
const pathSampleVideoFrameIntervalMs = 1_000 / pathSampleVideoMaxFps;

function shouldDrawPathSampleVideoFrame(
  nowMs: number,
  lastDrawMs: number | null,
): boolean {
  return (
    lastDrawMs === null || nowMs - lastDrawMs >= pathSampleVideoFrameIntervalMs
  );
}

export { shouldDrawPathSampleVideoFrame };
