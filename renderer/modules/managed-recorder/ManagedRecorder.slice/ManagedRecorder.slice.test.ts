import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import type { ManagedRecorderStatus } from "~/types";
import { createManagedRecorderSlice } from "./ManagedRecorder.slice";

function createStatus(
  overrides: Partial<ManagedRecorderStatus> = {},
): ManagedRecorderStatus {
  return {
    activeSessionDirectory: null,
    available: true,
    bufferActive: false,
    encoder: "h264",
    error: null,
    fps: 60,
    gameRunning: true,
    initialized: true,
    isStartingRecording: false,
    isStoppingRecording: false,
    lastRecordingPath: null,
    outputDirectory: "C:\\Videos",
    outputResolution: "1920x1080",
    recording: false,
    recordingStartedAt: null,
    runRecordingActive: false,
    runRecordingPath: null,
    runRecordingStartedAt: null,
    runtime: "packaged_obs",
    runtimePath: "obs.exe",
    ...overrides,
  };
}

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createManagedRecorderSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("ManagedRecorder slice", () => {
  const statuses = {
    buffer: createStatus({ bufferActive: true }),
    idle: createStatus(),
    recording: createStatus({ recording: true, runRecordingActive: true }),
  };
  const unsubscribe = vi.fn();
  let statusChangedListener: ((status: ManagedRecorderStatus) => void) | null =
    null;

  beforeEach(() => {
    vi.clearAllMocks();
    statusChangedListener = null;

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        managedRecorder: {
          getStatus: vi.fn().mockResolvedValue(statuses.idle),
          startBuffer: vi.fn().mockResolvedValue(statuses.buffer),
          stopBuffer: vi.fn().mockResolvedValue(statuses.idle),
          startRunRecording: vi.fn().mockResolvedValue(statuses.recording),
          stopRunRecording: vi.fn().mockResolvedValue(statuses.idle),
          saveReplay: vi.fn().mockResolvedValue(undefined),
          onStatusChanged: vi.fn(
            (listener: (status: ManagedRecorderStatus) => void) => {
              statusChangedListener = listener;
              return unsubscribe;
            },
          ),
        },
      },
    });
  });

  it("runs recorder actions and updates status", async () => {
    const store = createTestStore();

    await store.getState().managedRecorder.hydrate();
    expect(store.getState().managedRecorder.status).toBe(statuses.idle);

    await store.getState().managedRecorder.startBuffer();
    expect(store.getState().managedRecorder.status).toBe(statuses.buffer);

    await store.getState().managedRecorder.stopBuffer();
    await store.getState().managedRecorder.startRunRecording();
    expect(store.getState().managedRecorder.status).toBe(statuses.recording);

    await store.getState().managedRecorder.stopRunRecording();
    await store.getState().managedRecorder.saveReplay();
    expect(store.getState().managedRecorder.status).toBe(statuses.idle);
  });

  it("listens for recorder status changes", () => {
    const store = createTestStore();
    const stopListening = store.getState().managedRecorder.startListening();

    statusChangedListener?.(statuses.buffer);
    stopListening();

    expect(store.getState().managedRecorder.status).toBe(statuses.buffer);
    expect(unsubscribe).toHaveBeenCalled();
  });
});
