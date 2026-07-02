import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCaptureProfilesSlice } from "~/renderer/modules/capture-profiles/CaptureProfiles.slice/CaptureProfiles.slice";
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

function createProfile(
  overrides: Partial<CaptureProfile> = {},
): CaptureProfile {
  return {
    captureTarget: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    deathClipSeconds: 10,
    game: "poe1",
    id: "poe1",
    isDefault: false,
    name: "PoE 1 Capture",
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
    ...overrides,
  };
}

function createManagedRecorderStatus(
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
  const deleteCaptureProfile = vi.fn();
  const listCaptureProfiles = vi.fn();
  const updateCaptureProfile = vi.fn();
  const updateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
      });
    });
    expect(store.getState().captureProfiles.isProfileUnlocked).toBe(true);
    expect(store.getState().captureProfiles.items[0]?.recordingFps).toBe(30);
  });

  it.each([
    ["rewind is active", { bufferActive: true }],
    ["run recording is active", { runRecordingActive: true }],
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
});
