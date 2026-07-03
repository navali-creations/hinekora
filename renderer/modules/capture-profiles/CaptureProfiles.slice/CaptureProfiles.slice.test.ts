import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCaptureProfilesSlice } from "~/renderer/modules/capture-profiles/CaptureProfiles.slice/CaptureProfiles.slice";
import { createCaptureProfileTestFixture as createProfile } from "~/renderer/modules/capture-profiles/CaptureProfiles.test-utils";
import { createManagedRecorderStatusTestFixture as createManagedRecorderStatus } from "~/renderer/modules/managed-recorder/ManagedRecorder.test-utils";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import {
  type CapturePreviewSource,
  type CaptureProfile,
  createDefaultSettings,
  type ManagedRecorderStatus,
} from "~/types";

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: vi.fn(),
}));

const poe1Source: CapturePreviewSource = {
  displayId: "display-poe1",
  height: 1080,
  id: "screen:poe1",
  kind: "screen",
  name: "PoE 1 Screen",
  thumbnailDataUrl: null,
  width: 1920,
};

const poe2Source: CapturePreviewSource = {
  displayId: "display-poe2",
  height: 1080,
  id: "screen:poe2",
  kind: "screen",
  name: "PoE 2 Screen",
  thumbnailDataUrl: null,
  width: 1920,
};

const poe2AltSource: CapturePreviewSource = {
  displayId: "display-poe2-alt",
  height: 1440,
  id: "screen:poe2-alt",
  kind: "screen",
  name: "PoE 2 Alt Screen",
  thumbnailDataUrl: null,
  width: 2560,
};

const poe1Profile = createProfile({
  captureTarget: {
    id: "display-poe1",
    kind: "display",
    label: "PoE 1 Screen",
  },
  game: "poe1",
  id: "poe1",
  name: "PoE 1 Capture",
});

const poe2Profile = createProfile({
  captureTarget: {
    id: "display-poe2",
    kind: "display",
    label: "PoE 2 Screen",
  },
  game: "poe2",
  id: "poe2",
  name: "PoE 2 Capture",
});

const poe2AltProfile = createProfile({
  captureTarget: {
    id: "display-poe2-alt",
    kind: "display",
    label: "PoE 2 Alt Screen",
  },
  game: "poe2",
  id: "poe2-alt",
  name: "PoE 2 Alt Capture",
});

describe("CaptureProfiles slice", () => {
  let captureProfilesChanged: ((profiles: CaptureProfile[]) => void) | null =
    null;
  const createCaptureProfile = vi.fn();
  const deleteCaptureProfile = vi.fn();
  const listCaptureProfiles = vi.fn();
  const updateCaptureProfile = vi.fn();
  const updateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    createCaptureProfile.mockResolvedValue(poe1Profile);
    deleteCaptureProfile.mockResolvedValue(undefined);
    listCaptureProfiles.mockResolvedValue([
      poe1Profile,
      poe2Profile,
      poe2AltProfile,
    ]);
    updateCaptureProfile.mockResolvedValue(poe1Profile);
    updateSettings.mockResolvedValue(undefined);

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        captureProfiles: {
          create: createCaptureProfile,
          delete: deleteCaptureProfile,
          list: listCaptureProfiles,
          onChanged: (callback: (profiles: CaptureProfile[]) => void) => {
            captureProfilesChanged = callback;

            return () => {
              captureProfilesChanged = null;
            };
          },
          update: updateCaptureProfile,
        },
      },
    });
  });

  function createTestStore() {
    const store = createBoundStoreForTests((set, get, api) => {
      const captureProfilesSlice = createCaptureProfilesSlice(set, get, api);

      return {
        ...captureProfilesSlice,
        capturePreview: {
          error: null,
          getThumbnail: vi.fn(),
          hydrate: vi.fn(),
          isLoading: false,
          refresh: vi.fn(),
          select: vi.fn(),
          selectedSourceId: poe1Source.id,
          sources: [poe1Source, poe2Source, poe2AltSource],
          startListening: vi.fn(),
          thumbnailsBySourceId: {},
        },
        settings: {
          hydrate: vi.fn(),
          update: updateSettings,
          value: {
            ...createDefaultSettings(),
            activeGame: "poe1",
            recordingFps: 30,
            selectedCaptureProfileId: poe1Profile.id,
          },
        },
        managedRecorder: {
          captureMode: "rewind",
          hydrate: vi.fn(),
          saveReplay: vi.fn(),
          setCaptureMode: vi.fn(),
          startBuffer: vi.fn(),
          startListening: vi.fn(),
          startRunRecording: vi.fn(),
          status: null,
          stopBuffer: vi.fn(),
          stopRunRecording: vi.fn(),
        },
      } as unknown as BoundStore;
    });

    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        items: [poe1Profile, poe2Profile, poe2AltProfile],
        selectedProfileId: poe1Profile.id,
      },
    }));

    return store;
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

  it("switches to the requested game's profile and capture target", async () => {
    const store = createTestStore();

    await store.getState().captureProfiles.selectForGame("poe2");

    expect(store.getState().captureProfiles.selectedProfileId).toBe("poe2");
    expect(store.getState().capturePreview.selectedSourceId).toBe(
      poe2Source.id,
    );
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeGame: "poe2",
        selectedCaptureProfileId: "poe2",
      }),
    );
  });

  it("stores hydrate errors", async () => {
    listCaptureProfiles.mockRejectedValueOnce(
      new Error("profiles unavailable"),
    );
    const store = createTestStore();

    await store.getState().captureProfiles.hydrate();

    expect(store.getState().captureProfiles).toMatchObject({
      error: "profiles unavailable",
      isLoading: false,
    });
  });

  it("stores fallback hydrate errors for unknown failures", async () => {
    listCaptureProfiles.mockRejectedValueOnce("blocked");
    const store = createTestStore();

    await store.getState().captureProfiles.hydrate();

    expect(store.getState().captureProfiles).toMatchObject({
      error: "Load failed",
      isLoading: false,
    });
  });

  it("hydrates with default game fallback when settings are not loaded", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: null,
      },
    }));

    await store.getState().captureProfiles.hydrate();

    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      poe1Profile.id,
    );
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeGame: "poe1",
        selectedCaptureProfileId: poe1Profile.id,
      }),
    );
  });

  it("ignores invalid persisted per-game profile memory while hydrating", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: {
          ...state.settings.value!,
          activeGame: "poe2",
          selectedCaptureProfileId: null,
          selectedCaptureProfileIdsByGame: {
            poe1: null,
            poe2: "missing-profile",
          },
        },
      },
    }));

    await store.getState().captureProfiles.hydrate();

    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      poe2Profile.id,
    );
  });

  it("hydrates with a cross-game fallback when the active game has no profile", async () => {
    listCaptureProfiles.mockResolvedValueOnce([poe1Profile]);
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: {
          ...state.settings.value!,
          activeGame: "poe2",
          selectedCaptureProfileId: null,
        },
      },
    }));

    await store.getState().captureProfiles.hydrate();

    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      poe1Profile.id,
    );
  });

  it("hydrates with no selected profile when no profiles exist", async () => {
    listCaptureProfiles.mockResolvedValueOnce([]);
    const store = createTestStore();

    await store.getState().captureProfiles.hydrate();

    expect(store.getState().captureProfiles.selectedProfileId).toBeNull();
  });

  it("creates a profile for the active game and selects it", async () => {
    const createdProfile = createProfile({
      game: "poe2",
      id: "poe2-created",
      name: "Bossing",
    });
    createCaptureProfile.mockResolvedValueOnce(createdProfile);
    listCaptureProfiles.mockResolvedValueOnce([
      poe1Profile,
      poe2Profile,
      poe2AltProfile,
      createdProfile,
    ]);
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: {
          ...state.settings.value!,
          activeGame: "poe2",
        },
      },
    }));

    await store.getState().captureProfiles.create("Bossing");

    expect(createCaptureProfile).toHaveBeenCalledWith({
      game: "poe2",
      name: "Bossing",
    });
    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      "poe2-created",
    );
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeGame: "poe2",
        selectedCaptureProfileId: "poe2-created",
      }),
    );
  });

  it("creates a profile with the default game when settings are not loaded", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: null,
      },
    }));

    await store.getState().captureProfiles.create("Leveling");

    expect(createCaptureProfile).toHaveBeenCalledWith({
      game: "poe1",
      name: "Leveling",
    });
  });

  it("updates the selected profile and reapplies its settings", async () => {
    const updatedProfile = {
      ...poe1Profile,
      recordingFps: 30,
    };
    updateCaptureProfile.mockResolvedValueOnce(updatedProfile);
    listCaptureProfiles.mockResolvedValueOnce([
      updatedProfile,
      poe2Profile,
      poe2AltProfile,
    ]);
    const store = createTestStore();

    await store
      .getState()
      .captureProfiles.update({ id: poe1Profile.id, recordingFps: 30 });

    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(30);
    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      poe1Profile.id,
    );
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        recordingFps: 30,
        selectedCaptureProfileId: poe1Profile.id,
      }),
    );
  });

  it("updates an inactive profile without changing selection", async () => {
    const updatedProfile = {
      ...poe2AltProfile,
      recordingFps: 30,
    };
    updateCaptureProfile.mockResolvedValueOnce(updatedProfile);
    listCaptureProfiles.mockResolvedValueOnce([
      poe1Profile,
      poe2Profile,
      updatedProfile,
    ]);
    const store = createTestStore();

    await store
      .getState()
      .captureProfiles.update({ id: poe2AltProfile.id, recordingFps: 30 });

    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      poe1Profile.id,
    );
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("reports missing profiles for profile-only selection", () => {
    const store = createTestStore();

    store.getState().captureProfiles.select("missing-profile");

    expect(store.getState().captureProfiles.error).toBe(
      "Capture profile not found",
    );
  });

  it("reports missing profiles for profile and preview-source selection", () => {
    const store = createTestStore();

    store.getState().captureProfiles.selectWithPreviewSource("missing-profile");

    expect(store.getState().captureProfiles.error).toBe(
      "Capture profile not found",
    );
  });

  it("selects the profile capture target in live preview when a profile is selected", () => {
    const store = createTestStore();

    store.getState().captureProfiles.selectWithPreviewSource("poe2-alt");

    expect(store.getState().captureProfiles.selectedProfileId).toBe("poe2-alt");
    expect(store.getState().capturePreview.selectedSourceId).toBe(
      poe2AltSource.id,
    );
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeGame: "poe2",
        selectedCaptureProfileId: "poe2-alt",
      }),
    );
  });

  it.each([
    "profile-only selection",
    "profile and preview-source selection",
    "game selection",
  ] as const)("blocks %s while recording or rewind is active", async (label) => {
    const store = createTestStore();
    store.setState((state) => ({
      managedRecorder: {
        ...state.managedRecorder,
        status: createManagedRecorderStatus({ runRecordingActive: true }),
      },
    }));

    if (label === "profile-only selection") {
      store.getState().captureProfiles.select("poe2-alt");
    } else if (label === "profile and preview-source selection") {
      store.getState().captureProfiles.selectWithPreviewSource("poe2-alt");
    } else {
      await store.getState().captureProfiles.selectForGame("poe2");
    }

    expect(store.getState().captureProfiles.selectedProfileId).toBe("poe1");
    expect(store.getState().capturePreview.selectedSourceId).toBe(
      poe1Source.id,
    );
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("blocks profile creation while recording or rewind is active", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      managedRecorder: {
        ...state.managedRecorder,
        status: createManagedRecorderStatus({ runRecordingActive: true }),
      },
    }));

    await store.getState().captureProfiles.create("Bossing");

    expect(createCaptureProfile).not.toHaveBeenCalled();
    expect(listCaptureProfiles).not.toHaveBeenCalled();
    expect(store.getState().captureProfiles.selectedProfileId).toBe("poe1");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("blocks profile updates while recording or rewind is active", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      managedRecorder: {
        ...state.managedRecorder,
        status: createManagedRecorderStatus({ runRecordingActive: true }),
      },
    }));

    await store
      .getState()
      .captureProfiles.update({ id: poe1Profile.id, recordingFps: 30 });

    expect(updateCaptureProfile).not.toHaveBeenCalled();
    expect(listCaptureProfiles).not.toHaveBeenCalled();
    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(60);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("ignores profile update results when recording starts before completion", async () => {
    const updateDeferred = createDeferred<CaptureProfile>();
    updateCaptureProfile.mockReturnValueOnce(updateDeferred.promise);
    const store = createTestStore();

    const update = store
      .getState()
      .captureProfiles.update({ id: poe1Profile.id, recordingFps: 30 });
    expect(updateCaptureProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: poe1Profile.id,
        recordingFps: 30,
      }),
    );

    store.setState((state) => ({
      managedRecorder: {
        ...state.managedRecorder,
        status: createManagedRecorderStatus({ runRecordingActive: true }),
      },
    }));
    updateDeferred.resolve({
      ...poe1Profile,
      recordingFps: 30,
    });
    await update;

    expect(listCaptureProfiles).not.toHaveBeenCalled();
    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(60);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("blocks profile deletion while recording or rewind is active", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      managedRecorder: {
        ...state.managedRecorder,
        status: createManagedRecorderStatus({ runRecordingActive: true }),
      },
    }));

    await store.getState().captureProfiles.delete(poe1Profile.id);

    expect(deleteCaptureProfile).not.toHaveBeenCalled();
    expect(listCaptureProfiles).not.toHaveBeenCalled();
    expect(store.getState().captureProfiles.selectedProfileId).toBe("poe1");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("remembers the last selected capture profile for each game", async () => {
    const store = createTestStore();

    store.getState().captureProfiles.select("poe2-alt");
    store.getState().captureProfiles.select("poe1");
    await store.getState().captureProfiles.selectForGame("poe2");

    expect(store.getState().captureProfiles.selectedProfileId).toBe("poe2-alt");
    expect(store.getState().capturePreview.selectedSourceId).toBe(
      poe2AltSource.id,
    );
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedCaptureProfileId: "poe2-alt",
        selectedCaptureProfileIdsByGame: expect.objectContaining({
          poe2: "poe2-alt",
        }),
      }),
    );
  });

  it("restores per-game capture profile memory from persisted settings", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: {
          ...state.settings.value!,
          selectedCaptureProfileIdsByGame: {
            poe1: "poe1",
            poe2: "poe2-alt",
          },
        },
      },
    }));

    await store.getState().captureProfiles.hydrate();
    await store.getState().captureProfiles.selectForGame("poe2");

    expect(store.getState().captureProfiles.selectedProfileId).toBe("poe2-alt");
    expect(store.getState().capturePreview.selectedSourceId).toBe(
      poe2AltSource.id,
    );
  });

  it("does not resave settings when persisted profile memory already matches", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: {
          ...createDefaultSettings(),
          activeGame: "poe2",
          recordingFps: 60,
          selectedCaptureProfileId: "poe2-alt",
          selectedCaptureProfileIdsByGame: {
            poe2: "poe2-alt",
          },
        },
      },
    }));

    await store.getState().captureProfiles.hydrate();

    expect(store.getState().captureProfiles.selectedProfileId).toBe("poe2-alt");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("restores the persisted selected capture profile even when active game is stale", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: {
          ...createDefaultSettings(),
          activeGame: "poe1",
          selectedCaptureProfileId: "poe2-alt",
          selectedCaptureProfileIdsByGame: {
            poe2: "poe2-alt",
          },
        },
      },
    }));

    await store.getState().captureProfiles.hydrate();

    expect(store.getState().captureProfiles.selectedProfileId).toBe("poe2-alt");
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeGame: "poe2",
        selectedCaptureProfileId: "poe2-alt",
        selectedCaptureProfileIdsByGame: {
          poe2: "poe2-alt",
        },
      }),
    );
  });

  it("removes a deleted inactive profile from persisted per-game memory", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: {
          ...state.settings.value!,
          selectedCaptureProfileIdsByGame: {
            poe1: poe1Profile.id,
            poe2: poe2AltProfile.id,
          },
        },
      },
    }));
    listCaptureProfiles.mockResolvedValueOnce([poe1Profile, poe2Profile]);

    await store.getState().captureProfiles.delete(poe2AltProfile.id);

    expect(deleteCaptureProfile).toHaveBeenCalledWith(poe2AltProfile.id);
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedCaptureProfileId: poe1Profile.id,
        selectedCaptureProfileIdsByGame: {
          poe1: poe1Profile.id,
        },
      }),
    );
  });

  it("falls back after deleting the selected profile", async () => {
    const store = createTestStore();
    listCaptureProfiles.mockResolvedValueOnce([poe2Profile]);

    await store.getState().captureProfiles.delete(poe1Profile.id);

    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      poe2Profile.id,
    );
  });

  it("clears selection after deleting the last selected profile", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: null,
      },
    }));
    listCaptureProfiles.mockResolvedValueOnce([]);

    await store.getState().captureProfiles.delete(poe1Profile.id);

    expect(store.getState().captureProfiles.selectedProfileId).toBeNull();
  });

  it("prunes remembered profiles that disappear from the profile list", async () => {
    const store = createTestStore();

    store.getState().captureProfiles.select("poe2-alt");
    store.getState().captureProfiles.select("poe1");
    listCaptureProfiles.mockResolvedValueOnce([poe1Profile, poe2Profile]);

    await store.getState().captureProfiles.delete(poe2AltProfile.id);

    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedCaptureProfileId: poe1Profile.id,
        selectedCaptureProfileIdsByGame: {
          poe1: poe1Profile.id,
        },
      }),
    );
  });

  it("clears the selected game's memory when no profile exists for that game", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        items: [poe1Profile],
      },
      settings: {
        ...state.settings,
        value: {
          ...state.settings.value!,
          selectedCaptureProfileIdsByGame: {
            poe1: poe1Profile.id,
            poe2: poe2AltProfile.id,
          },
        },
      },
    }));

    await store.getState().captureProfiles.selectForGame("poe2");

    expect(store.getState().captureProfiles.selectedProfileId).toBeNull();
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeGame: "poe2",
        selectedCaptureProfileId: null,
        selectedCaptureProfileIdsByGame: {
          poe1: poe1Profile.id,
        },
      }),
    );
  });

  it("stores game-switch persistence errors", async () => {
    updateSettings.mockRejectedValueOnce(new Error("settings offline"));
    const store = createTestStore();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        items: [poe1Profile],
      },
    }));

    await store.getState().captureProfiles.selectForGame("poe2");

    expect(store.getState().captureProfiles.error).toBe("settings offline");
  });

  it("stores fallback game-switch persistence errors", async () => {
    updateSettings.mockRejectedValueOnce("failed");
    const store = createTestStore();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        items: [poe1Profile],
      },
    }));

    await store.getState().captureProfiles.selectForGame("poe2");

    expect(store.getState().captureProfiles.error).toBe(
      "Unable to persist selected capture profile",
    );
  });

  it("can switch games without loaded settings or a matching profile", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        items: [poe1Profile],
      },
      settings: {
        ...state.settings,
        value: null,
      },
    }));

    await store.getState().captureProfiles.selectForGame("poe2");

    expect(store.getState().captureProfiles.selectedProfileId).toBeNull();
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeGame: "poe2",
        selectedCaptureProfileId: null,
        selectedCaptureProfileIdsByGame: {},
      }),
    );
  });

  it("saves current settings into the selected profile when unlocked", async () => {
    const store = createTestStore();
    updateCaptureProfile.mockResolvedValue({
      ...poe1Profile,
      recordingFps: 30,
    });

    store.getState().captureProfiles.setProfileUnlocked(true);

    await vi.waitFor(() => {
      expect(updateCaptureProfile).toHaveBeenCalledWith({
        id: poe1Profile.id,
        captureTarget: {
          game: null,
          height: 1080,
          id: "display-poe1",
          kind: "display",
          label: "PoE 1 Screen",
          width: 1920,
        },
        deathClipSeconds: 10,
        recordingAudioInputDeviceId: null,
        recordingAudioOutputDeviceId: null,
        recordingAutoStartMode: "off",
        recordingClipQuality: "high",
        recordingEncoder: "hardware_h264",
        recordingFps: 30,
        recordingHideOverlaysFromRecording: true,
        recordingHideOverlaysFromRewind: true,
        recordingOutputResolution: "native",
        recordingRunQuality: "moderate",
        recordingTrackBookmarksInRewind: true,
      });
    });
    expect(store.getState().captureProfiles.isProfileUnlocked).toBe(true);
    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(30);
  });

  it("saves unlocked profile settings without a capture target when no source is selected", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      capturePreview: {
        ...state.capturePreview,
        selectedSourceId: "missing-source",
      },
    }));

    store.getState().captureProfiles.setProfileUnlocked(true);

    await vi.waitFor(() => {
      expect(updateCaptureProfile).toHaveBeenCalledWith(
        expect.not.objectContaining({
          captureTarget: expect.anything(),
        }),
      );
    });
  });

  it("saves unlocked profile settings without a target for another game's source", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      capturePreview: {
        ...state.capturePreview,
        selectedSourceId: "window:poe2",
        sources: [
          ...state.capturePreview.sources,
          {
            available: true,
            displayId: null,
            game: "poe2",
            height: 1440,
            id: "window:poe2",
            kind: "window",
            name: "Path of Exile 2",
            thumbnailDataUrl: null,
            width: 2560,
          },
        ],
      },
    }));

    store.getState().captureProfiles.setProfileUnlocked(true);

    await vi.waitFor(() => {
      expect(updateCaptureProfile).toHaveBeenCalledWith(
        expect.not.objectContaining({
          captureTarget: expect.anything(),
        }),
      );
    });
  });

  it("keeps unlocked persistence selection when the updated profile is not listed", async () => {
    updateCaptureProfile.mockResolvedValueOnce({
      ...poe1Profile,
      id: "poe1-recreated",
    });
    const store = createTestStore();

    store.getState().captureProfiles.setProfileUnlocked(true);

    await vi.waitFor(() => {
      expect(store.getState().captureProfiles.selectedProfileId).toBe(
        "poe1-recreated",
      );
    });
  });

  it("toggles profile lock state", async () => {
    const store = createTestStore();

    store.getState().captureProfiles.toggleProfileLock();

    await vi.waitFor(() => {
      expect(updateCaptureProfile).toHaveBeenCalled();
    });
    expect(store.getState().captureProfiles.isProfileUnlocked).toBe(true);

    store.getState().captureProfiles.toggleProfileLock();

    expect(store.getState().captureProfiles.isProfileUnlocked).toBe(false);
  });

  it("skips unlocked persistence when no profile is selected", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        selectedProfileId: null,
      },
    }));

    store.getState().captureProfiles.setProfileUnlocked(true);
    await Promise.resolve();

    expect(updateCaptureProfile).not.toHaveBeenCalled();
    expect(store.getState().captureProfiles.isProfileUnlocked).toBe(true);
  });

  it("skips unlocked persistence when the selected profile is stale", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        items: [poe2Profile],
      },
    }));

    store.getState().captureProfiles.setProfileUnlocked(true);
    await Promise.resolve();

    expect(updateCaptureProfile).not.toHaveBeenCalled();
    expect(store.getState().captureProfiles.isProfileUnlocked).toBe(true);
  });

  it("stores unlocked profile persistence errors", async () => {
    updateCaptureProfile.mockRejectedValueOnce(new Error("save failed"));
    const store = createTestStore();

    store.getState().captureProfiles.setProfileUnlocked(true);

    await vi.waitFor(() => {
      expect(store.getState().captureProfiles.error).toBe("save failed");
    });
  });

  it("stores fallback unlocked profile persistence errors", async () => {
    updateCaptureProfile.mockRejectedValueOnce("failed");
    const store = createTestStore();

    store.getState().captureProfiles.setProfileUnlocked(true);

    await vi.waitFor(() => {
      expect(store.getState().captureProfiles.error).toBe(
        "Unable to update selected capture profile",
      );
    });
  });

  it.each([
    ["rewind is active", { bufferActive: true }],
    ["run recording is active", { runRecordingActive: true }],
    ["recording is active", { recording: true }],
    ["recording is starting", { isStartingRecording: true }],
    ["recording is stopping", { isStoppingRecording: true }],
  ] satisfies Array<
    [string, Partial<ManagedRecorderStatus>]
  >)("does not unlock while %s", async (_label, status) => {
    const store = createTestStore();
    store.setState((state) => ({
      managedRecorder: {
        ...state.managedRecorder,
        status: createManagedRecorderStatus(status),
      },
    }));

    store.getState().captureProfiles.setProfileUnlocked(true);

    await vi.waitFor(() => {
      expect(updateCaptureProfile).not.toHaveBeenCalled();
    });
    expect(store.getState().captureProfiles.isProfileUnlocked).toBe(false);
  });

  it("ignores stale unlock persistence after the selection changes", async () => {
    let resolveUpdate: (profile: CaptureProfile) => void = () => undefined;
    updateCaptureProfile.mockReturnValue(
      new Promise<CaptureProfile>((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const store = createTestStore();

    store.getState().captureProfiles.setProfileUnlocked(true);
    store.getState().captureProfiles.select("poe2");
    resolveUpdate({
      ...poe1Profile,
      recordingFps: 30,
    });

    await vi.waitFor(() => {
      expect(updateCaptureProfile).toHaveBeenCalled();
    });
    expect(store.getState().captureProfiles.selectedProfileId).toBe("poe2");
    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(60);
  });

  it("ignores unlock persistence results when recording starts before completion", async () => {
    const updateDeferred = createDeferred<CaptureProfile>();
    updateCaptureProfile.mockReturnValueOnce(updateDeferred.promise);
    const store = createTestStore();

    store.getState().captureProfiles.setProfileUnlocked(true);
    expect(updateCaptureProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: poe1Profile.id,
        recordingFps: 30,
      }),
    );

    store.setState((state) => ({
      managedRecorder: {
        ...state.managedRecorder,
        status: createManagedRecorderStatus({ runRecordingActive: true }),
      },
    }));
    updateDeferred.resolve({
      ...poe1Profile,
      recordingFps: 30,
    });

    await vi.waitFor(() => {
      expect(updateCaptureProfile).toHaveBeenCalled();
    });
    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(60);
  });

  it("ignores stale selected profile persistence failures", async () => {
    let rejectFirstUpdate: (error: unknown) => void = () => undefined;
    const firstUpdate = new Promise<CaptureProfile>((_resolve, reject) => {
      rejectFirstUpdate = reject;
    });
    updateSettings
      .mockReturnValueOnce(firstUpdate)
      .mockResolvedValueOnce(undefined);
    const store = createTestStore();

    store.getState().captureProfiles.select("poe2");
    store.getState().captureProfiles.select("poe1");
    rejectFirstUpdate(new Error("stale failure"));
    await Promise.resolve();

    expect(store.getState().captureProfiles.error).toBeNull();
  });

  it("stores selected profile persistence errors", async () => {
    updateSettings.mockRejectedValueOnce(new Error("profile settings failed"));
    const store = createTestStore();

    store.getState().captureProfiles.select("poe2");

    await vi.waitFor(() => {
      expect(store.getState().captureProfiles.error).toBe(
        "profile settings failed",
      );
    });
  });

  it("stores fallback selected profile persistence errors", async () => {
    updateSettings.mockRejectedValueOnce("failed");
    const store = createTestStore();

    store.getState().captureProfiles.select("poe2");

    await vi.waitFor(() => {
      expect(store.getState().captureProfiles.error).toBe(
        "Unable to persist selected capture profile",
      );
    });
  });

  it("applies selected profile settings when settings are not loaded", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: null,
      },
    }));

    store.getState().captureProfiles.select("poe2");

    await vi.waitFor(() => {
      expect(updateSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          activeGame: "poe2",
          selectedCaptureProfileId: "poe2",
        }),
      );
    });
  });

  it("keeps the current selected profile when profile changes arrive before settings catch up", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        selectedProfileId: poe2Profile.id,
      },
      settings: {
        ...state.settings,
        value: {
          ...state.settings.value!,
          activeGame: "poe1",
          selectedCaptureProfileId: poe2Profile.id,
        },
      },
    }));
    store.getState().captureProfiles.startListening();

    captureProfilesChanged?.([
      poe1Profile,
      {
        ...poe2Profile,
        captureTarget: {
          id: "display-poe2-next",
          kind: "display",
          label: "PoE 2 Next Screen",
        },
      },
    ]);

    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      poe2Profile.id,
    );
    await vi.waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          activeGame: "poe2",
          selectedCaptureProfileId: poe2Profile.id,
        }),
      );
    });
  });

  it("does not change selection or apply profile settings from profile changes while recording or rewind is active", () => {
    const store = createTestStore();
    store.setState((state) => ({
      managedRecorder: {
        ...state.managedRecorder,
        status: createManagedRecorderStatus({ runRecordingActive: true }),
      },
    }));
    store.getState().captureProfiles.startListening();

    captureProfilesChanged?.([poe2Profile]);

    expect(store.getState().captureProfiles.items).toEqual([poe2Profile]);
    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      poe1Profile.id,
    );
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("falls back to the active game profile when the selected profile disappears", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        selectedProfileId: poe2AltProfile.id,
      },
      settings: {
        ...state.settings,
        value: {
          ...state.settings.value!,
          activeGame: "poe2",
          selectedCaptureProfileId: poe2AltProfile.id,
        },
      },
    }));
    store.getState().captureProfiles.startListening();

    captureProfilesChanged?.([poe1Profile, poe2Profile]);

    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      poe2Profile.id,
    );
    await vi.waitFor(() => {
      expect(updateSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selectedCaptureProfileId: poe2Profile.id,
        }),
      );
    });
  });

  it("clears selection when changed profiles contain no fallback", () => {
    const store = createTestStore();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        selectedProfileId: poe2AltProfile.id,
      },
      settings: {
        ...state.settings,
        value: {
          ...state.settings.value!,
          activeGame: "poe2",
          selectedCaptureProfileId: poe2AltProfile.id,
        },
      },
    }));
    store.getState().captureProfiles.startListening();

    captureProfilesChanged?.([]);

    expect(store.getState().captureProfiles.selectedProfileId).toBeNull();
  });

  it("uses default game fallback when profile changes arrive before settings load", () => {
    const store = createTestStore();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        selectedProfileId: "missing-profile",
      },
      settings: {
        ...state.settings,
        value: null,
      },
    }));
    store.getState().captureProfiles.startListening();

    captureProfilesChanged?.([poe1Profile]);

    expect(store.getState().captureProfiles.selectedProfileId).toBe(
      poe1Profile.id,
    );
  });
});
