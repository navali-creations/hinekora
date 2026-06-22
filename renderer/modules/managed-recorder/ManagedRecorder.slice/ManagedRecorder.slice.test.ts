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
      ({
        ...createManagedRecorderSlice(set, get, api),
        capturePreview: {
          error: null,
          hydrate: vi.fn(),
          isLoading: false,
          refresh: vi.fn().mockResolvedValue(undefined),
          select: vi.fn(),
          selectedSourceId: null,
          sources: [],
        },
      }) as unknown as BoundStore,
  );
}

describe("ManagedRecorder slice", () => {
  const statuses = {
    buffer: createStatus({ bufferActive: true }),
    idle: createStatus(),
    recording: createStatus({ recording: true, runRecordingActive: true }),
  };
  const unsubscribe = vi.fn();
  const unsubscribeCaptureMode = vi.fn();
  let statusChangedListener: ((status: ManagedRecorderStatus) => void) | null =
    null;
  let captureModeChangedListener:
    | ((mode: "session" | "rewind") => void)
    | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    statusChangedListener = null;
    captureModeChangedListener = null;

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        managedRecorder: {
          getCaptureMode: vi.fn().mockResolvedValue("rewind"),
          getStatus: vi.fn().mockResolvedValue(statuses.idle),
          setCaptureMode: vi.fn().mockResolvedValue("session"),
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
          onCaptureModeChanged: vi.fn(
            (listener: (mode: "session" | "rewind") => void) => {
              captureModeChangedListener = listener;
              return unsubscribeCaptureMode;
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
    expect(store.getState().managedRecorder.captureMode).toBe("rewind");

    await store.getState().managedRecorder.setCaptureMode("session");
    expect(store.getState().managedRecorder.captureMode).toBe("session");

    await store.getState().managedRecorder.startBuffer();
    expect(store.getState().managedRecorder.status).toBe(statuses.buffer);
    expect(store.getState().managedRecorder.captureMode).toBe("rewind");

    await store.getState().managedRecorder.stopBuffer();
    await store.getState().managedRecorder.startRunRecording();
    expect(store.getState().managedRecorder.status).toBe(statuses.recording);
    expect(store.getState().managedRecorder.captureMode).toBe("session");

    await store.getState().managedRecorder.stopRunRecording();
    await store.getState().managedRecorder.saveReplay();
    expect(store.getState().managedRecorder.status).toBe(statuses.idle);
  });

  it("listens for recorder status changes", () => {
    const store = createTestStore();
    const stopListening = store.getState().managedRecorder.startListening();

    statusChangedListener?.(statuses.buffer);
    captureModeChangedListener?.("session");
    stopListening();

    expect(store.getState().managedRecorder.status).toBe(statuses.buffer);
    expect(store.getState().managedRecorder.captureMode).toBe("session");
    expect(store.getState().capturePreview.refresh).toHaveBeenCalledWith({
      force: true,
    });
    expect(unsubscribe).toHaveBeenCalled();
    expect(unsubscribeCaptureMode).toHaveBeenCalled();
  });

  it("refreshes capture sources only when the game becomes running", () => {
    const store = createTestStore();
    store.getState().managedRecorder.startListening();

    statusChangedListener?.(createStatus({ gameRunning: false }));
    statusChangedListener?.(createStatus({ gameRunning: true }));
    statusChangedListener?.(createStatus({ gameRunning: true }));

    expect(store.getState().capturePreview.refresh).toHaveBeenCalledTimes(1);
    expect(store.getState().capturePreview.refresh).toHaveBeenCalledWith({
      force: true,
    });
  });
});
