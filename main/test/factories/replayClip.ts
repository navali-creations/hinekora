import type { ReplayClipView } from "~/main/modules/replay-clips";

import type { ReplayClip } from "~/types";

function createReplayClip(overrides: Partial<ReplayClip> = {}): ReplayClip {
  const now = new Date().toISOString();

  return {
    id: "clip-1",
    kind: "death",
    status: "ready",
    sourceGame: "poe1",
    sourceLeague: "Standard",
    deathTimestamp: now,
    triggerLineHash: "death-line",
    originalObsPath: null,
    processedClipPath: null,
    targetDurationSeconds: 10,
    durationSeconds: null,
    sizeBytes: 0,
    error: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createReplayClipView(
  overrides: Partial<ReplayClipView> = {},
): ReplayClipView {
  const { originalObsPath, processedClipPath, ...clip } = createReplayClip();
  void originalObsPath;
  void processedClipPath;

  return {
    ...clip,
    fileName: null,
    hasMediaFile: false,
    ...overrides,
  };
}

export { createReplayClip, createReplayClipView };
