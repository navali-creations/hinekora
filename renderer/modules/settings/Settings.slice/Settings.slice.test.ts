import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import {
  type AppSettings,
  type CaptureProfile,
  createDefaultSettings,
} from "~/types";

const analyticsMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: analyticsMocks.trackEvent,
}));

import {
  createSettingsSlice,
  shouldTrackSettingsUpdate,
} from "./Settings.slice";

const settings: AppSettings = {
  ...createDefaultSettings(),
  activeGame: "poe2",
  activeLeague: "Standard",
  installedGames: ["poe2"],
  lastSeenAppVersion: null,
};

const captureProfile: CaptureProfile = {
  captureTarget: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  deathClipSeconds: 10,
  game: "poe2",
  id: "capture-profile-1",
  isDefault: false,
  name: "PoE 2 Capture",
  recordingAudioInputDeviceId: null,
  recordingAudioOutputDeviceId: null,
  recordingAutoStartMode: "off",
  recordingClipQuality: "high",
  recordingEncoder: "hardware_h264",
  recordingFps: 60,
  recordingHideOverlaysFromRecording: true,
  recordingHideOverlaysFromRewind: true,
  recordingOutputResolution: "native",
  recordingRunQuality: "moderate",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function createTestStore(isProfileUnlocked = false) {
  return createBoundStoreForTests(
    (set, get, api) =>
      ({
        ...createSettingsSlice(set, get, api),
        captureProfiles: {
          create: vi.fn(),
          delete: vi.fn(),
          error: null,
          hydrate: vi.fn(),
          isLoading: false,
          isProfileUnlocked,
          items: [captureProfile],
          select: vi.fn(),
          selectForGame: vi.fn(),
          selectWithPreviewSource: vi.fn(),
          selectedProfileId: captureProfile.id,
          setProfileUnlocked: vi.fn(),
          startListening: vi.fn(),
          toggleProfileLock: vi.fn(),
          update: vi.fn(),
        },
      }) as unknown as BoundStore,
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

describe("Settings slice", () => {
  const updateCaptureProfile = vi.fn();
  const getSettings = vi.fn();
  const updateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue(settings);
    updateSettings.mockResolvedValue({ ...settings, activeLeague: "Hardcore" });
    updateCaptureProfile.mockResolvedValue(captureProfile);

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        captureProfiles: {
          update: updateCaptureProfile,
        },
        settings: {
          get: getSettings,
          update: updateSettings,
        },
      },
    });
  });

  it("hydrates and updates settings", async () => {
    const store = createTestStore();

    await store.getState().settings.hydrate();
    await store.getState().settings.update({ activeLeague: "Hardcore" });

    expect(getSettings).toHaveBeenCalled();
    expect(updateSettings).toHaveBeenCalledWith({ activeLeague: "Hardcore" });
    expect(store.getState().settings.value?.activeLeague).toBe("Hardcore");
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith("settings-updated");
  });

  it("does not track character-name-only settings updates", async () => {
    updateSettings.mockResolvedValue({
      ...settings,
      poe1CharacterName: "Ailucannon",
    });
    const store = createTestStore();

    await store.getState().settings.update({
      poe1CharacterName: "Ailucannon",
    });

    expect(updateSettings).toHaveBeenCalledWith({
      poe1CharacterName: "Ailucannon",
    });
    expect(analyticsMocks.trackEvent).not.toHaveBeenCalled();
    expect(shouldTrackSettingsUpdate({ poe2CharacterName: "Ailumonk" })).toBe(
      false,
    );
    expect(
      shouldTrackSettingsUpdate({
        activeLeague: "Hardcore",
        poe1CharacterName: "Ailucannon",
      }),
    ).toBe(true);
    expect(shouldTrackSettingsUpdate({ selectedProfileId: "profile-1" })).toBe(
      false,
    );
    expect(
      shouldTrackSettingsUpdate({
        selectedCaptureProfileIdsByGame: { poe2: "capture-profile-1" },
      }),
    ).toBe(false);
  });

  it("keeps capture profile settings unchanged while the profile is locked", async () => {
    updateSettings.mockResolvedValue({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: captureProfile.id,
    });
    const store = createTestStore(false);

    await store.getState().settings.update({ recordingFps: 30 });

    expect(updateCaptureProfile).not.toHaveBeenCalled();
  });

  it("syncs capture settings into the selected profile while unlocked", async () => {
    updateSettings.mockResolvedValue({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: captureProfile.id,
    });
    updateCaptureProfile.mockResolvedValue({
      ...captureProfile,
      recordingFps: 30,
    });
    const store = createTestStore(true);

    await store.getState().settings.update({ recordingFps: 30 });

    expect(updateCaptureProfile).toHaveBeenCalledWith({
      id: captureProfile.id,
      recordingFps: 30,
    });
    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(30);
  });

  it("ignores stale settings update responses while syncing unlocked profiles", async () => {
    const firstSettingsUpdate = createDeferred<AppSettings>();
    const secondSettingsUpdate = createDeferred<AppSettings>();
    updateSettings
      .mockReturnValueOnce(firstSettingsUpdate.promise)
      .mockReturnValueOnce(secondSettingsUpdate.promise);
    updateCaptureProfile.mockImplementation(
      async (input: Partial<CaptureProfile> & { id: string }) => ({
        ...captureProfile,
        ...input,
      }),
    );
    const store = createTestStore(true);

    const firstUpdate = store.getState().settings.update({ recordingFps: 30 });
    const secondUpdate = store.getState().settings.update({ recordingFps: 60 });

    secondSettingsUpdate.resolve({
      ...settings,
      recordingFps: 60,
      selectedCaptureProfileId: captureProfile.id,
    });
    await secondUpdate;

    firstSettingsUpdate.resolve({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: captureProfile.id,
    });
    await firstUpdate;

    expect(updateCaptureProfile).toHaveBeenCalledTimes(1);
    expect(updateCaptureProfile).toHaveBeenCalledWith({
      id: captureProfile.id,
      recordingFps: 60,
    });
    expect(store.getState().settings.value?.recordingFps).toBe(60);
    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(60);
    expect(analyticsMocks.trackEvent).toHaveBeenCalledTimes(1);
  });

  it("ignores stale capture profile sync results after a newer settings update", async () => {
    const firstProfileUpdate = createDeferred<CaptureProfile>();
    const secondProfileUpdate = createDeferred<CaptureProfile>();
    updateSettings
      .mockResolvedValueOnce({
        ...settings,
        recordingFps: 30,
        selectedCaptureProfileId: captureProfile.id,
      })
      .mockResolvedValueOnce({
        ...settings,
        recordingFps: 60,
        selectedCaptureProfileId: captureProfile.id,
      });
    updateCaptureProfile
      .mockReturnValueOnce(firstProfileUpdate.promise)
      .mockReturnValueOnce(secondProfileUpdate.promise);
    const store = createTestStore(true);

    const firstUpdate = store.getState().settings.update({ recordingFps: 30 });
    await Promise.resolve();
    expect(updateCaptureProfile).toHaveBeenCalledTimes(1);

    const secondUpdate = store.getState().settings.update({ recordingFps: 60 });
    await Promise.resolve();
    expect(updateCaptureProfile).toHaveBeenCalledTimes(2);

    secondProfileUpdate.resolve({
      ...captureProfile,
      recordingFps: 60,
    });
    await secondUpdate;

    firstProfileUpdate.resolve({
      ...captureProfile,
      recordingFps: 30,
    });
    await firstUpdate;

    expect(store.getState().settings.value?.recordingFps).toBe(60);
    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(60);
    expect(analyticsMocks.trackEvent).toHaveBeenCalledTimes(1);
  });
});
