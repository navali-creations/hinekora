import type { ReplayStatusOverlayFinalStatus } from "~/main/modules/replay-status-overlay";

import type { ReplayClip } from "~/types";

interface NativeReplayStatusE2EState {
  clipStatus: ReplayClip["status"] | null;
  finalStatus: ReplayStatusOverlayFinalStatus | null;
  manualReplayShowPreview: boolean;
  previewRequested: boolean;
  previewAttempts: number;
  previewFailures: number;
  processingStarted: boolean;
  statusRequested: boolean;
}

interface NativeReplayStatusE2EHarness {
  getState: () => NativeReplayStatusE2EState;
  releaseSave: (result: ReplayStatusOverlayFinalStatus) => void;
  releaseProcessing: () => void;
  requestPreview: () => void;
  setCaptureProtection: (enabled: boolean) => void;
}

type NativeReplayStatusE2EGlobal = typeof globalThis & {
  __HINEKORA_REPLAY_STATUS_E2E__: NativeReplayStatusE2EHarness;
};

export type {
  NativeReplayStatusE2EGlobal,
  NativeReplayStatusE2EHarness,
  NativeReplayStatusE2EState,
};
