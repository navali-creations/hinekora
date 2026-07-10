function roundReplayClipSeconds(seconds: number): number {
  return Math.round(Math.max(seconds, 0) * 1_000) / 1_000;
}

export { roundReplayClipSeconds };
