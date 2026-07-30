import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCaptureProfileTestFixture } from "~/renderer/modules/capture-profiles/CaptureProfiles.test-utils";
import { createManagedRecorderStatusTestFixture as createManagedRecorderStatus } from "~/renderer/modules/managed-recorder/ManagedRecorder.test-utils";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import {
  type AppSettings,
  type CaptureProfile,
  createDefaultSettings,
  type ManagedRecorderStatus,
} from "~/types";
import { createSettingsSlice } from "./Settings.slice";

const settings: AppSettings = {
  ...createDefaultSettings(),
  activeGame: "poe2",
  activeLeague: "Standard",
  installedGames: ["poe2"],
  lastSeenAppVersion: null,
};

const captureProfile = createCaptureProfileTestFixture({
  game: "poe2",
  id: "capture-profile-1",
  name: "PoE 2 Capture",
});

function createTestStore(
  isProfileUnlocked = false,
  managedRecorderStatus: ManagedRecorderStatus | null = null,
) {
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
        managedRecorder: {
          captureMode: "rewind",
          hydrate: vi.fn(),
          setCaptureMode: vi.fn(),
          startBuffer: vi.fn(),
          startListening: vi.fn(),
          startRunRecording: vi.fn(),
          status: managedRecorderStatus,
          stopBuffer: vi.fn(),
          stopRunRecording: vi.fn(),
        },
      }) as unknown as BoundStore,
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });

  return { promise, reject, resolve };
}

describe("Settings slice", () => {
  const updateCaptureProfile = vi.fn();
  const getSettings = vi.fn();
  const onSettingsChanged = vi.fn();
  const updateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue(settings);
    onSettingsChanged.mockReturnValue(vi.fn());
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
          onChanged: onSettingsChanged,
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
  });

  it("optimistically persists a preference", async () => {
    updateSettings.mockImplementationOnce(async (input) => ({
      ...settings,
      ...input,
    }));
    const store = createTestStore();
    await store.getState().settings.hydrate();

    const request = store
      .getState()
      .settings.updatePreference("clipsLibraryView", "manual");

    expect(store.getState().settings.value?.clipsLibraryView).toBe("manual");
    await expect(request).resolves.toBe(true);
    expect(
      store.getState().settings.preferenceErrors.clipsLibraryView,
    ).toBeUndefined();
  });

  it("rolls back a failed preference update and exposes an error", async () => {
    updateSettings.mockRejectedValueOnce(new Error("save failed"));
    const store = createTestStore();
    await store.getState().settings.hydrate();

    await expect(
      store.getState().settings.updatePreference("clipsLibraryView", "manual"),
    ).resolves.toBe(false);

    expect(store.getState().settings.value?.clipsLibraryView).toBe("death");
    expect(store.getState().settings.preferenceErrors.clipsLibraryView).toBe(
      "Could not save this preference.",
    );
  });

  it("does not let a stale preference failure roll back a newer value", async () => {
    const firstUpdate = createDeferred<AppSettings>();
    const secondUpdate = createDeferred<AppSettings>();
    updateSettings
      .mockReturnValueOnce(firstUpdate.promise)
      .mockReturnValueOnce(secondUpdate.promise);
    const store = createTestStore();
    await store.getState().settings.hydrate();

    const firstRequest = store
      .getState()
      .settings.updatePreference("clipsLibraryView", "manual");
    const secondRequest = store
      .getState()
      .settings.updatePreference("clipsLibraryView", "death");

    secondUpdate.resolve({ ...settings, clipsLibraryView: "death" });
    await expect(secondRequest).resolves.toBe(true);
    firstUpdate.reject(new Error("stale failure"));
    await expect(firstRequest).resolves.toBe(false);

    expect(store.getState().settings.value?.clipsLibraryView).toBe("death");
    expect(
      store.getState().settings.preferenceErrors.clipsLibraryView,
    ).toBeUndefined();
  });

  it("rejects settings updates when the current window exposes read-only settings", async () => {
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        captureProfiles: {
          update: updateCaptureProfile,
        },
        settings: {
          get: getSettings,
          onChanged: onSettingsChanged,
        },
      },
    });
    const store = createTestStore();

    await expect(
      store.getState().settings.update({ activeLeague: "Hardcore" }),
    ).rejects.toThrow("Settings updates are not available in this window");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("ignores stale settings hydrate responses", async () => {
    const firstHydrate = createDeferred<AppSettings>();
    const secondHydrate = createDeferred<AppSettings>();
    getSettings
      .mockReturnValueOnce(firstHydrate.promise)
      .mockReturnValueOnce(secondHydrate.promise);
    const store = createTestStore();

    const firstRequest = store.getState().settings.hydrate();
    const secondRequest = store.getState().settings.hydrate();

    secondHydrate.resolve({ ...settings, activeLeague: "Hardcore" });
    await secondRequest;
    firstHydrate.resolve({ ...settings, activeLeague: "Standard" });
    await firstRequest;

    expect(store.getState().settings.value?.activeLeague).toBe("Hardcore");
  });

  it("ignores settings hydrate responses after a change event wins the race", async () => {
    const hydrate = createDeferred<AppSettings>();
    const settingsChangedListeners: Array<(nextSettings: AppSettings) => void> =
      [];
    getSettings.mockReturnValueOnce(hydrate.promise);
    onSettingsChanged.mockImplementation(
      (callback: (nextSettings: AppSettings) => void) => {
        settingsChangedListeners.push(callback);

        return vi.fn();
      },
    );
    const store = createTestStore();
    store.getState().settings.startListening();

    const hydrateRequest = store.getState().settings.hydrate();
    settingsChangedListeners[0]?.({ ...settings, activeLeague: "Hardcore" });
    hydrate.resolve({ ...settings, activeLeague: "Standard" });
    await hydrateRequest;

    expect(store.getState().settings.value?.activeLeague).toBe("Hardcore");
  });

  it("mirrors settings change events from main", () => {
    const unsubscribe = vi.fn();
    const settingsChangedListeners: Array<(nextSettings: AppSettings) => void> =
      [];
    onSettingsChanged.mockImplementation(
      (callback: (nextSettings: AppSettings) => void) => {
        settingsChangedListeners.push(callback);

        return unsubscribe;
      },
    );
    const store = createTestStore();

    const stopListening = store.getState().settings.startListening();
    settingsChangedListeners[0]?.({ ...settings, activeLeague: "Hardcore" });

    expect(store.getState().settings.value?.activeLeague).toBe("Hardcore");

    stopListening();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("syncs changed capture settings events into the unlocked profile", async () => {
    const settingsChangedListeners: Array<(nextSettings: AppSettings) => void> =
      [];
    onSettingsChanged.mockImplementation(
      (callback: (nextSettings: AppSettings) => void) => {
        settingsChangedListeners.push(callback);

        return vi.fn();
      },
    );
    updateCaptureProfile.mockResolvedValue({
      ...captureProfile,
      recordingFps: 30,
    });
    const store = createTestStore(true);
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: {
          ...settings,
          recordingFps: 60,
          selectedCaptureProfileId: captureProfile.id,
        },
      },
    }));

    store.getState().settings.startListening();
    settingsChangedListeners[0]?.({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: captureProfile.id,
    });

    await vi.waitFor(() => {
      expect(updateCaptureProfile).toHaveBeenCalledWith({
        id: captureProfile.id,
        recordingFps: 30,
      });
    });
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

  it("keeps unlocked capture profile settings unchanged while recording or rewind is active", async () => {
    updateSettings.mockResolvedValue({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: captureProfile.id,
    });
    const store = createTestStore(
      true,
      createManagedRecorderStatus({ runRecordingActive: true }),
    );

    await store.getState().settings.update({ recordingFps: 30 });

    expect(updateCaptureProfile).not.toHaveBeenCalled();
  });

  it("ignores capture profile sync results when recording starts before completion", async () => {
    const profileUpdate = createDeferred<CaptureProfile>();
    updateSettings.mockResolvedValue({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: captureProfile.id,
    });
    updateCaptureProfile.mockReturnValueOnce(profileUpdate.promise);
    const store = createTestStore(true);

    const update = store.getState().settings.update({ recordingFps: 30 });
    await Promise.resolve();
    expect(updateCaptureProfile).toHaveBeenCalledWith({
      id: captureProfile.id,
      recordingFps: 30,
    });

    store.setState((state) => ({
      managedRecorder: {
        ...state.managedRecorder,
        status: createManagedRecorderStatus({ runRecordingActive: true }),
      },
    }));
    profileUpdate.resolve({
      ...captureProfile,
      recordingFps: 30,
    });
    await update;

    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(60);
  });

  it("does not resync a local settings update after its change event was handled", async () => {
    const settingsChangedListeners: Array<(nextSettings: AppSettings) => void> =
      [];
    const settingsUpdate = createDeferred<AppSettings>();
    onSettingsChanged.mockImplementation(
      (callback: (nextSettings: AppSettings) => void) => {
        settingsChangedListeners.push(callback);

        return vi.fn();
      },
    );
    updateSettings.mockReturnValueOnce(settingsUpdate.promise);
    updateCaptureProfile.mockResolvedValue({
      ...captureProfile,
      recordingFps: 30,
    });
    const store = createTestStore(true);
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: {
          ...settings,
          recordingFps: 60,
          selectedCaptureProfileId: captureProfile.id,
        },
      },
    }));
    store.getState().settings.startListening();

    const updateRequest = store
      .getState()
      .settings.update({ recordingFps: 30 });
    settingsChangedListeners[0]?.({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: captureProfile.id,
    });
    await vi.waitFor(() => {
      expect(updateCaptureProfile).toHaveBeenCalledTimes(1);
    });

    settingsUpdate.resolve({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: captureProfile.id,
    });
    await updateRequest;

    expect(updateCaptureProfile).toHaveBeenCalledTimes(1);
    expect(store.getState().settings.value?.recordingFps).toBe(30);
  });

  it("keeps synced profile selection when the profile list is stale", async () => {
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
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        items: [],
      },
    }));

    await store.getState().settings.update({ recordingFps: 30 });

    expect(store.getState().captureProfiles.items).toEqual([]);
    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      captureProfile.id,
    );
  });

  it("skips unlocked profile sync without a selected capture profile", async () => {
    updateSettings.mockResolvedValue({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: null,
    });
    const store = createTestStore(true);

    await store.getState().settings.update({ recordingFps: 30 });

    expect(updateCaptureProfile).not.toHaveBeenCalled();
  });

  it("skips unlocked profile sync for non-capture settings updates", async () => {
    updateSettings.mockResolvedValue({
      ...settings,
      activeLeague: "Hardcore",
      selectedCaptureProfileId: captureProfile.id,
    });
    const store = createTestStore(true);

    await store.getState().settings.update({ activeLeague: "Hardcore" });

    expect(updateCaptureProfile).not.toHaveBeenCalled();
  });

  it("stores capture profile sync errors while unlocked", async () => {
    updateSettings.mockResolvedValue({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: captureProfile.id,
    });
    updateCaptureProfile.mockRejectedValue(new Error("profile update failed"));
    const store = createTestStore(true);

    await store.getState().settings.update({ recordingFps: 30 });

    expect(store.getState().captureProfiles.error).toBe(
      "profile update failed",
    );
  });

  it("stores a fallback capture profile sync error for unknown failures", async () => {
    updateSettings.mockResolvedValue({
      ...settings,
      recordingFps: 30,
      selectedCaptureProfileId: captureProfile.id,
    });
    updateCaptureProfile.mockRejectedValue("failed");
    const store = createTestStore(true);

    await store.getState().settings.update({ recordingFps: 30 });

    expect(store.getState().captureProfiles.error).toBe(
      "Unable to update selected capture profile",
    );
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
  });

  it("ignores stale capture profile sync failures after a newer settings update", async () => {
    const firstProfileUpdate = createDeferred<CaptureProfile>();
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
      .mockResolvedValueOnce({
        ...captureProfile,
        recordingFps: 60,
      });
    const store = createTestStore(true);

    const firstUpdate = store.getState().settings.update({ recordingFps: 30 });
    await Promise.resolve();
    const secondUpdate = store.getState().settings.update({ recordingFps: 60 });
    await secondUpdate;

    firstProfileUpdate.reject(new Error("stale failure"));
    await firstUpdate;

    expect(store.getState().captureProfiles.error).toBeNull();
    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(60);
  });
});
