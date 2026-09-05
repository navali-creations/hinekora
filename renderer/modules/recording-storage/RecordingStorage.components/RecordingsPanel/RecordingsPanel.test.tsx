import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createManagedRecorderStatusTestFixture,
  createManagedRunRecordingSessionTestFixture,
} from "~/renderer/modules/managed-recorder/ManagedRecorder.test-utils";
import { ALL_LEAGUES_VALUE } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import type { ManagedRecorderStatus } from "~/types";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const storeMocks = vi.hoisted(() => ({
  managedRecorderStatus: null as ManagedRecorderStatus | null,
  recordingStorage: {
    clearSelectedRecordings: vi.fn(),
    deleteRecording: vi.fn(),
    error: null as string | null,
    openRecording: vi.fn(),
    recordings: [],
    recordingsPage: null,
    refreshRecordings: vi.fn(),
    revealRecording: vi.fn(),
    selectedRecordingIds: {},
    setSelectedRecordingIds: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routerMocks.navigate,
}));

vi.mock("~/renderer/store", () => ({
  useManagedRecorderSelector: (
    selector: (state: { status: ManagedRecorderStatus | null }) => unknown,
  ) => selector({ status: storeMocks.managedRecorderStatus }),
  useRecordingStorageShallow: (
    selector: (state: typeof storeMocks.recordingStorage) => unknown,
  ) => selector(storeMocks.recordingStorage),
}));

import { RecordingsPanel } from "./RecordingsPanel";

let container: HTMLDivElement;
let root: Root;

async function renderPanel() {
  await act(async () => {
    root.render(
      <RecordingsPanel scope={{ game: "poe2", league: ALL_LEAGUES_VALUE }} />,
    );
  });
}

describe("RecordingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMocks.managedRecorderStatus = null;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders and times only active or finalizing full recordings", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    storeMocks.managedRecorderStatus = createManagedRecorderStatusTestFixture({
      activeGame: "poe2",
      bufferActive: true,
      isStoppingRecording: true,
      recordingStartedAt: "2026-09-05T03:20:00.000Z",
    });

    await renderPanel();

    expect(
      container.querySelector('[data-testid="transient-run-recording-row"]'),
    ).toBeNull();
    expect(setIntervalSpy).not.toHaveBeenCalled();

    storeMocks.managedRecorderStatus = createManagedRecorderStatusTestFixture({
      activeGame: "poe2",
      recording: true,
      runRecordingActive: true,
      runRecordingSession: createManagedRunRecordingSessionTestFixture(),
    });
    await renderPanel();

    const activeRow = container.querySelector(
      '[data-testid="transient-run-recording-row"]',
    );
    expect(activeRow?.textContent).toContain("Active recording");
    expect(activeRow?.textContent).toContain("Recording");
    expect(setIntervalSpy).toHaveBeenCalledOnce();

    storeMocks.managedRecorderStatus = createManagedRecorderStatusTestFixture({
      activeGame: "poe2",
      isStoppingRecording: true,
      runRecordingSession: createManagedRunRecordingSessionTestFixture({
        state: "processing",
        stoppedAt: "2026-09-05T03:21:00.000Z",
      }),
    });
    await renderPanel();

    const finalizingRow = container.querySelector(
      '[data-testid="transient-run-recording-row"]',
    );
    expect(finalizingRow?.textContent).toContain("Processing recording");
    expect(finalizingRow?.textContent).toContain("Processing");

    storeMocks.managedRecorderStatus = createManagedRecorderStatusTestFixture();
    await renderPanel();

    expect(
      container.querySelector('[data-testid="transient-run-recording-row"]'),
    ).toBeNull();
    expect(clearIntervalSpy).toHaveBeenCalledOnce();
  });
});
