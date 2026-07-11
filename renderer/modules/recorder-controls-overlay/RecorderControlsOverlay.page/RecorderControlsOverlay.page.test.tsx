import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecorderOverlayMode } from "~/main/modules/overlay-windows/OverlayWindows.dto";
import type {
  ManagedRecorderSlice,
  ProfilesSlice,
  ReplayClipsSlice,
  SettingsSlice,
} from "~/renderer/store/store.types";

import {
  createDefaultProfile,
  createDefaultSettings,
  type ManagedRecorderStatus,
  type Profile,
} from "~/types";
import { RecorderControlsOverlayPage } from "./RecorderControlsOverlay.page";

const storeMocks = vi.hoisted(() => ({
  useManagedRecorderShallow: vi.fn(),
  useProfilesShallow: vi.fn(),
  useReplayClipsShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
  useSettingsShallow: vi.fn(),
}));

const electronMocks = vi.hoisted(() => ({
  createManualBookmark: vi.fn(),
  getRecorderMode: vi.fn(),
  hideRecorder: vi.fn(),
  onRecorderModeChanged: vi.fn(),
  setRecorderMode: vi.fn(),
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
  useSettingsSelector: storeMocks.useSettingsSelector,
  useSettingsShallow: storeMocks.useSettingsShallow,
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

function createProfile(
  id: string,
  name: string,
  game: Profile["game"] = "poe1",
): Profile {
  return {
    ...createDefaultProfile({ game, name }),
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

function queryButton(
  container: HTMLElement,
  label: string,
): HTMLButtonElement | null {
  const button = [...container.querySelectorAll("button")].find(
    (buttonElement) => buttonElement.getAttribute("aria-label") === label,
  );

  return button instanceof HTMLButtonElement ? button : null;
}

function getTab(container: HTMLElement, label: string): HTMLButtonElement {
  const tab = [...container.querySelectorAll('button[role="tab"]')].find(
    (buttonElement) => buttonElement.textContent?.trim() === label,
  );
  if (!(tab instanceof HTMLButtonElement)) {
    throw new Error(`Expected ${label} tab to render`);
  }

  return tab;
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
  let settingsState: SettingsSlice["settings"];
  let root: Root | null = null;
  let container: HTMLDivElement;
  let modeChangedListener: ((mode: RecorderOverlayMode) => void) | null = null;

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
    modeChangedListener = null;
    electronMocks.getRecorderMode.mockResolvedValue("expanded");
    electronMocks.setRecorderMode.mockImplementation(
      async (mode: RecorderOverlayMode) => mode,
    );
    electronMocks.onRecorderModeChanged.mockImplementation(
      (callback: (mode: RecorderOverlayMode) => void) => {
        modeChangedListener = callback;
        return vi.fn();
      },
    );
    electronMocks.setAuraLocked.mockResolvedValue(undefined);
    electronMocks.showAura.mockResolvedValue(undefined);
    electronMocks.createManualBookmark.mockResolvedValue({
      bookmark: null,
      error: null,
      ok: true,
    });

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
      delete: vi.fn().mockResolvedValue(undefined),
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
      hydrateLibrary: vi.fn().mockResolvedValue(undefined),
      libraryItems: [],
      libraryLeagues: [],
      libraryPage: null,
      libraryQuery: null,
      openClip: vi.fn().mockResolvedValue(undefined),
      refreshLibrary: vi.fn().mockResolvedValue(undefined),
      revealClip: vi.fn().mockResolvedValue(undefined),
      saveManualReplay: vi.fn().mockResolvedValue(undefined),
      selectedClipIds: {},
      setSelectedClipIds: vi.fn(),
      startListening: vi.fn(() => vi.fn()),
    };
    settingsState = {
      hydrate: vi.fn().mockResolvedValue(undefined),
      startListening: vi.fn(() => vi.fn()),
      update: vi.fn().mockResolvedValue(undefined),
      value: {
        ...createDefaultSettings(),
        deathClipSeconds: 60,
      },
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
    storeMocks.useSettingsShallow.mockImplementation(
      <T,>(selector: (state: SettingsSlice["settings"]) => T) =>
        selector(settingsState),
    );
    storeMocks.useSettingsSelector.mockImplementation(
      <T,>(selector: (state: SettingsSlice["settings"]) => T) =>
        selector(settingsState),
    );
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        bookmarks: {
          createManual: electronMocks.createManualBookmark,
        },
        overlayWindows: {
          getRecorderMode: electronMocks.getRecorderMode,
          hideRecorder: electronMocks.hideRecorder,
          onRecorderModeChanged: electronMocks.onRecorderModeChanged,
          setRecorderMode: electronMocks.setRecorderMode,
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
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("routes rewind actions to the replay buffer and manual replay APIs", async () => {
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

    expect(replayClipsState.saveManualReplay).toHaveBeenCalledTimes(1);
    expect(managedRecorderState.stopBuffer).toHaveBeenCalledTimes(1);
  });

  it("labels manual replay saves with the configured rewind duration", async () => {
    settingsState.value = {
      ...createDefaultSettings(),
      deathClipSeconds: 45,
    };
    managedRecorderState.status = createStatus({
      bufferActive: true,
      recording: true,
    });

    await renderOverlay();

    expect(getButton(container, "Save last 45 seconds")).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(queryButton(container, "Save last 60 seconds")).toBeNull();
  });

  it("switches capture modes from overlay tabs and locks conflicting active modes", async () => {
    await renderOverlay();

    expect(
      container.querySelector('[aria-label="Rewind preview quality: 720p"]'),
    ).toBeInstanceOf(HTMLSpanElement);
    expect(getTab(container, "Recording").getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(getTab(container, "Rewind").getAttribute("aria-selected")).toBe(
      "true",
    );

    getTab(container, "Recording").click();

    expect(managedRecorderState.setCaptureMode).toHaveBeenCalledWith("session");

    managedRecorderState.status = createStatus({ bufferActive: true });
    await renderOverlay();

    expect(getTab(container, "Recording").disabled).toBe(true);
    getTab(container, "Recording").click();

    expect(managedRecorderState.setCaptureMode).toHaveBeenCalledTimes(1);
  });

  it("routes session actions to full recording APIs and hides manual replays", async () => {
    managedRecorderState.captureMode = "session";
    await renderOverlay();

    expect(
      container.querySelector('[aria-label^="Rewind preview quality:"]'),
    ).toBeNull();
    expect(queryButton(container, "Save last 60 seconds")).toBeNull();
    expect(getTab(container, "Recording").getAttribute("aria-selected")).toBe(
      "true",
    );

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
    expect(replayClipsState.saveManualReplay).not.toHaveBeenCalled();
  });

  it("switches aura profiles and opens aura edit mode from the grid button", async () => {
    await renderOverlay();

    const select = getProfileSelect(container);
    select.value = "profile-2";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(profilesState.select).toHaveBeenCalledWith("profile-2");
    expect(electronMocks.showAura).toHaveBeenCalledWith("profile-2");

    getButton(container, "Edit auras").click();
    await flushPromises();

    expect(electronMocks.setAuraLocked).toHaveBeenCalledWith(false);
    expect(electronMocks.showAura).toHaveBeenCalledWith("profile-1");
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "aura-edit-started",
      {
        shape: "rect",
        source: "recorder-overlay",
      },
    );
  });

  it("keeps aura actions enabled for the active game profile after a game switch", async () => {
    settingsState.value = {
      ...createDefaultSettings(),
      activeGame: "poe2",
      selectedProfileId: "profile-poe1",
    };
    profilesState.items = [
      createProfile("profile-poe1", "PoE 1 Profile", "poe1"),
      createProfile("profile-poe2", "PoE 2 Profile", "poe2"),
    ];
    profilesState.selectedProfileId = "profile-poe1";

    await renderOverlay();

    expect(getProfileSelect(container).value).toBe("profile-poe2");
    expect(getButton(container, "Edit auras").disabled).toBe(false);

    getButton(container, "Edit auras").click();
    await flushPromises();

    expect(electronMocks.setAuraLocked).toHaveBeenCalledWith(false);
    expect(electronMocks.showAura).toHaveBeenCalledWith("profile-poe2");
  });

  it("starts add-aura mode from the default aura button", async () => {
    await renderOverlay();

    getButton(container, "Add default aura").click();
    await flushPromises();

    expect(electronMocks.setAuraLocked).toHaveBeenCalledWith(false);
    expect(electronMocks.showAura).toHaveBeenCalledWith("profile-1", {
      addAuraShape: "rect",
      startAddingAura: true,
    });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith("aura-add-started", {
      shape: "rect",
      source: "recorder-overlay",
    });
  });

  it("starts arched add-aura mode from the arc aura button", async () => {
    await renderOverlay();

    getButton(container, "Add arc aura").click();
    await flushPromises();

    expect(electronMocks.setAuraLocked).toHaveBeenCalledWith(false);
    expect(electronMocks.showAura).toHaveBeenCalledWith("profile-1", {
      addAuraShape: "arc",
      startAddingAura: true,
    });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith("aura-add-started", {
      shape: "arc",
      source: "recorder-overlay",
    });
  });

  it("minimizes to compact controls with recording, manual replay, and expand actions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T12:00:00.000Z"));
    managedRecorderState.status = createStatus({
      bufferActive: true,
      recording: true,
      recordingStartedAt: "2026-06-22T11:58:55.000Z",
    });
    await renderOverlay();

    await act(async () => {
      getButton(container, "Minimize overlay").click();
      await flushPromises();
    });

    expect(electronMocks.setRecorderMode).toHaveBeenCalledWith("minimized");
    expect(container.textContent).toContain("01:05");
    expect(container.querySelector('[aria-label="Aura profile"]')).toBeNull();
    expect(
      [...container.querySelectorAll("button")]
        .map((button) => button.getAttribute("aria-label"))
        .slice(0, 2),
    ).toEqual(["Disable Rewind", "Save last 60 seconds"]);

    getButton(container, "Save last 60 seconds").click();
    expect(replayClipsState.saveManualReplay).toHaveBeenCalledTimes(1);
    getButton(container, "Disable Rewind").click();
    expect(managedRecorderState.stopBuffer).toHaveBeenCalledTimes(1);

    await act(async () => {
      getButton(container, "Expand overlay").click();
      await flushPromises();
    });

    expect(electronMocks.setRecorderMode).toHaveBeenCalledWith("expanded");
    expect(getButton(container, "Edit auras")).toBeInstanceOf(
      HTMLButtonElement,
    );
  });

  it("keeps minimized recording controls available without the manual replay action in recording mode", async () => {
    electronMocks.getRecorderMode.mockResolvedValue("minimized");
    managedRecorderState.captureMode = "session";
    await renderOverlay();

    expect(queryButton(container, "Save last 60 seconds")).toBeNull();

    getButton(container, "Start recording").click();
    expect(managedRecorderState.startRunRecording).toHaveBeenCalledTimes(1);
    expect(managedRecorderState.startBuffer).not.toHaveBeenCalled();
  });

  it("shows the configured quality only in expanded rewind mode", async () => {
    await renderOverlay();
    expect(
      container.querySelector('[aria-label="Rewind preview quality: 720p"]'),
    ).toBeInstanceOf(HTMLSpanElement);

    settingsState.value = {
      ...createDefaultSettings(),
      replayClipPreviewResolution: "1080p",
    };
    await renderOverlay();

    expect(
      container.querySelector('[aria-label="Rewind preview quality: 1080p"]'),
    ).toBeInstanceOf(HTMLSpanElement);

    await act(async () => {
      modeChangedListener?.("minimized");
      await flushPromises();
    });

    expect(
      container.querySelector('[aria-label^="Rewind preview quality:"]'),
    ).toBeNull();
  });

  it("reacts to recorder overlay mode changes from main", async () => {
    await renderOverlay();

    await act(async () => {
      modeChangedListener?.("minimized");
      await flushPromises();
    });

    expect(getButton(container, "Expand overlay")).toBeInstanceOf(
      HTMLButtonElement,
    );
  });

  it("disables recording, manual replay, and add-aura actions when the game is not running", async () => {
    managedRecorderState.status = createStatus({ gameRunning: false });
    await renderOverlay();

    expect(getButton(container, "Enable Rewind").disabled).toBe(true);
    expect(getButton(container, "Save last 60 seconds").disabled).toBe(true);
    expect(getButton(container, "Edit auras").disabled).toBe(true);
    expect(getButton(container, "Add default aura").disabled).toBe(true);

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
