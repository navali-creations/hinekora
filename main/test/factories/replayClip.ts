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
    sizeBytes: 0,
    error: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export { createReplayClip };
