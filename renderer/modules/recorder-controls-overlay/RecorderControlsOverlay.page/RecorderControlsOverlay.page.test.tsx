import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ManagedRecorderSlice,
  ProfilesSlice,
  ReplayClipsSlice,
} from "~/renderer/store/store.types";

import {
  createDefaultProfile,
  type ManagedRecorderStatus,
  type Profile,
} from "~/types";
import { RecorderControlsOverlayPage } from "./RecorderControlsOverlay.page";

const storeMocks = vi.hoisted(() => ({
  useManagedRecorderShallow: vi.fn(),
  useProfilesShallow: vi.fn(),
  useReplayClipsShallow: vi.fn(),
}));

const electronMocks = vi.hoisted(() => ({
  hideRecorder: vi.fn(),
  setAuraLocked: vi.fn(),
  showAura: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useManagedRecorderShallow: storeMocks.useManagedRecorderShallow,
  useProfilesShallow: storeMocks.useProfilesShallow,
  useReplayClipsShallow: storeMocks.useReplayClipsShallow,
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: analyticsMocks.trackEvent,
}));

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

function createProfile(id: string, name: string): Profile {
  return {
    ...createDefaultProfile({ game: "poe1", name }),
    id,
  };
}

async function flushPromises(count = 3): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (buttonElement) => buttonElement.getAttribute("aria-label") === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected ${label} button to render`);
  }

  return button;
}

function getProfileSelect(container: HTMLElement): HTMLSelectElement {
  const select = container.querySelector('[aria-label="Aura profile"]');
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error("Expected aura profile select to render");
  }

  return select;
}

describe("RecorderControlsOverlayPage", () => {
  let managedRecorderState: ManagedRecorderSlice["managedRecorder"];
  let profilesState: ProfilesSlice["profiles"];
  let replayClipsState: ReplayClipsSlice["replayClips"];
  let root: Root | null = null;
  let container: HTMLDivElement;

  const renderOverlay = async () => {
    await act(async () => {
      root?.render(<RecorderControlsOverlayPage />);
      await flushPromises();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    electronMocks.setAuraLocked.mockResolvedValue(undefined);
    electronMocks.showAura.mockResolvedValue(undefined);

    managedRecorderState = {
      captureMode: "rewind",
      hydrate: vi.fn().mockResolvedValue(undefined),
      saveReplay: vi.fn().mockResolvedValue(undefined),
      setCaptureMode: vi.fn().mockResolvedValue(undefined),
      startBuffer: vi.fn().mockResolvedValue(undefined),
      startListening: vi.fn(() => vi.fn()),
      startRunRecording: vi.fn().mockResolvedValue(undefined),
      status: createStatus(),
      stopBuffer: vi.fn().mockResolvedValue(undefined),
      stopRunRecording: vi.fn().mockResolvedValue(undefined),
    };
    profilesState = {
      create: vi.fn().mockResolvedValue(undefined),
      error: null,
      hydrate: vi.fn().mockResolvedValue(undefined),
      isLoading: false,
      items: [
        createProfile("profile-1", "Default PoE Profile"),
        createProfile("profile-2", "Bossing"),
      ],
      select: vi.fn(),
      selectedProfileId: "profile-1",
      startListening: vi.fn(() => vi.fn()),
      update: vi.fn().mockResolvedValue(undefined),
    };
    replayClipsState = {
      activeClip: null,
      clearSelectedClips: vi.fn(),
      deleteClip: vi.fn().mockResolvedValue(undefined),
      deleteSelectedClips: vi.fn().mockResolvedValue(undefined),
      error: null,
      hydrate: vi.fn().mockResolvedValue(undefined),
      hydrateLibrary: vi.fn().mockResolvedValue(undefined),
      items: [],
      libraryItems: [],
      libraryLeagues: [],
      libraryPage: null,
      libraryQuery: null,
      openClip: vi.fn().mockResolvedValue(undefined),
      refreshLibrary: vi.fn().mockResolvedValue(undefined),
      revealClip: vi.fn().mockResolvedValue(undefined),
      saveManual: vi.fn().mockResolvedValue(undefined),
      selectedClipIds: {},
      setSelectedClipIds: vi.fn(),
      startListening: vi.fn(() => vi.fn()),
    };

    storeMocks.useManagedRecorderShallow.mockImplementation(
      <T,>(selector: (state: ManagedRecorderSlice["managedRecorder"]) => T) =>
        selector(managedRecorderState),
    );
    storeMocks.useProfilesShallow.mockImplementation(
      <T,>(selector: (state: ProfilesSlice["profiles"]) => T) =>
        selector(profilesState),
    );
    storeMocks.useReplayClipsShallow.mockImplementation(
      <T,>(selector: (state: ReplayClipsSlice["replayClips"]) => T) =>
        selector(replayClipsState),
    );
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        overlayWindows: {
          hideRecorder: electronMocks.hideRecorder,
          setAuraLocked: electronMocks.setAuraLocked,
          showAura: electronMocks.showAura,
        },
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    root = null;
    document.body.replaceChildren();
  });

  it("routes rewind actions to the replay buffer and manual clip APIs", async () => {
    await renderOverlay();

    getButton(container, "Enable Rewind").click();
    expect(managedRecorderState.startBuffer).toHaveBeenCalledTimes(1);
    expect(managedRecorderState.startRunRecording).not.toHaveBeenCalled();

    managedRecorderState.status = createStatus({
      bufferActive: true,
      recording: true,
    });
    await renderOverlay();

    getButton(container, "Save last 60 seconds").click();
    getButton(container, "Disable Rewind").click();

    expect(replayClipsState.saveManual).toHaveBeenCalledTimes(1);
    expect(managedRecorderState.stopBuffer).toHaveBeenCalledTimes(1);
  });

  it("routes session actions to full recording APIs and disables manual clips", async () => {
    managedRecorderState.captureMode = "session";
    await renderOverlay();

    const manualClipButton = getButton(
      container,
      "Manual clips are only available in Rewind",
    );
    expect(manualClipButton.disabled).toBe(true);

    getButton(container, "Start recording").click();
    expect(managedRecorderState.startRunRecording).toHaveBeenCalledTimes(1);
    expect(managedRecorderState.startBuffer).not.toHaveBeenCalled();

    managedRecorderState.status = createStatus({
      recording: true,
      runRecordingActive: true,
    });
    await renderOverlay();

    getButton(container, "Stop & save recording").click();
    expect(managedRecorderState.stopRunRecording).toHaveBeenCalledTimes(1);
    expect(replayClipsState.saveManual).not.toHaveBeenCalled();
  });

  it("switches aura profiles and starts add-aura mode from the crop button", async () => {
    await renderOverlay();

    const select = getProfileSelect(container);
    select.value = "profile-2";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(profilesState.select).toHaveBeenCalledWith("profile-2");
    expect(electronMocks.showAura).toHaveBeenCalledWith("profile-2");

    getButton(container, "Add aura").click();
    await flushPromises();

    expect(electronMocks.setAuraLocked).toHaveBeenCalledWith(false);
    expect(electronMocks.showAura).toHaveBeenCalledWith("profile-1", {
      startAddingAura: true,
    });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith("aura-add-started", {
      source: "recorder-overlay",
    });
  });

  it("disables recording, manual clip, and add-aura actions when the game is not running", async () => {
    managedRecorderState.status = createStatus({ gameRunning: false });
    await renderOverlay();

    expect(getButton(container, "Enable Rewind").disabled).toBe(true);
    expect(getButton(container, "Save last 60 seconds").disabled).toBe(true);
    expect(getButton(container, "Add aura").disabled).toBe(true);

    const select = getProfileSelect(container);
    select.value = "profile-2";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(profilesState.select).toHaveBeenCalledWith("profile-2");
    expect(electronMocks.showAura).not.toHaveBeenCalled();
  });

  it("closes the recorder overlay through the overlay API", async () => {
    await renderOverlay();

    getButton(container, "Close overlay").click();

    expect(electronMocks.hideRecorder).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "recorder-overlay-closed",
      { source: "overlay" },
    );
  });
});
