import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStoppedPoeProcessStates } from "~/main/modules/poe-process/PoeProcess.dto";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import {
  type CapturePreviewSource,
  type CaptureProfile,
  createDefaultSettings,
} from "~/types";
import { createCapturePreviewSlice } from "./CapturePreview.slice";

const source: CapturePreviewSource = {
  displayId: "1",
  height: 1080,
  id: "screen:1",
  kind: "screen",
  name: "Screen 1",
  thumbnailDataUrl: null,
  width: 1920,
};

const nextSource: CapturePreviewSource = {
  ...source,
  displayId: "2",
  id: "screen:2",
  name: "Screen 2",
};

const poe2WindowSource: CapturePreviewSource = {
  displayId: null,
  game: "poe2",
  height: 1440,
  id: "window:poe2",
  kind: "window",
  name: "Path of Exile 2",
  thumbnailDataUrl: null,
  width: 2560,
};

const profile: CaptureProfile = {
  captureTarget: {
    height: 1080,
    id: "screen:1",
    kind: "display",
    label: "Screen 1",
    width: 1920,
  },
  createdAt: "2026-06-18T00:00:00.000Z",
  deathClipsEnabled: true,
  deathClipSeconds: 10,
  game: "poe2",
  id: "capture-profile-1",
  isDefault: false,
  name: "PoE 2 Capture",
  manualReplaySeconds: 10,
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
  recordingTrackBookmarksInRewind: true,
  updatedAt: "2026-06-18T00:00:00.000Z",
};

function createTestStore() {
  return createBoundStoreForTests((set, get, api) => {
    const capturePreviewSlice = createCapturePreviewSlice(set, get, api);

    return {
      ...capturePreviewSlice,
      captureProfiles: {
        error: null,
        hydrate: vi.fn(),
        isLoading: false,
        items: [profile],
        selectedProfileId: profile.id,
        create: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
        select: vi.fn(),
        startListening: vi.fn(),
      },
      poeProcess: {
        error: null,
        hydrate: vi.fn(),
        startListening: vi.fn(),
        state: {
          isRunning: false,
          processName: "",
        },
        states: createStoppedPoeProcessStates(),
      },
      settings: {
        hydrate: vi.fn(),
        update: vi.fn(),
        value: {
          ...createDefaultSettings(),
          activeGame: "poe2",
        },
      },
    } as unknown as BoundStore;
  });
}

function createTestStoreWithoutSelectedProfile() {
  const store = createTestStore();
  store.setState((state) => ({
    captureProfiles: {
      ...state.captureProfiles,
      selectedProfileId: "missing",
    },
  }));

  return store;
}

describe("CapturePreview slice", () => {
  const getSourceThumbnail = vi.fn();
  const listSources = vi.fn();
  let refreshRequestedListener: (() => void) | null = null;
  const unsubscribeRefreshRequested = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    refreshRequestedListener = null;
    getSourceThumbnail.mockResolvedValue("data:image/png;base64,screen");
    listSources.mockResolvedValue([source]);

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        capturePreview: {
          getSourceThumbnail,
          listSources,
          onRefreshRequested: vi.fn((listener: () => void) => {
            refreshRequestedListener = listener;

            return unsubscribeRefreshRequested;
          }),
        },
      },
    });
  });

  it("hydrates and resolves the selected source from the selected profile", async () => {
    const store = createTestStore();

    await store.getState().capturePreview.hydrate();
    store.getState().capturePreview.select("screen:manual");
    await store.getState().capturePreview.refresh({ force: true });

    expect(listSources).toHaveBeenLastCalledWith(true);
    expect(store.getState().capturePreview).toMatchObject({
      error: null,
      isLoading: false,
      selectedSourceId: "screen:1",
      sources: [
        source,
        expect.objectContaining({
          available: false,
          game: "poe1",
          id: "missing-window:poe1",
        }),
        expect.objectContaining({
          available: false,
          game: "poe2",
          id: "missing-window:poe2",
        }),
      ],
    });
  });

  it("stores list errors", async () => {
    const store = createTestStore();
    listSources.mockRejectedValueOnce("blocked");

    await store.getState().capturePreview.refresh();

    expect(store.getState().capturePreview).toMatchObject({
      error: "Unable to list capture sources",
      isLoading: false,
    });
  });

  it("refreshes sources when main requests a capture-preview refresh", async () => {
    const store = createTestStore();
    const stopListening = store.getState().capturePreview.startListening();

    refreshRequestedListener?.();
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledWith(true);
    });

    stopListening();
    expect(unsubscribeRefreshRequested).toHaveBeenCalled();
  });

  it("coalesces concurrent capture source recovery requests", async () => {
    let resolveSources!: (sources: CapturePreviewSource[]) => void;
    listSources.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSources = resolve;
      }),
    );
    const store = createTestStore();

    const firstRequest = store.getState().capturePreview.recoverSources();
    const secondRequest = store.getState().capturePreview.recoverSources();

    expect(secondRequest).toBe(firstRequest);
    expect(listSources).toHaveBeenCalledOnce();
    resolveSources([source]);
    await firstRequest;
  });

  it("refreshes immediately when listener startup refresh is requested", async () => {
    listSources.mockResolvedValue([source, poe2WindowSource]);
    const store = createTestStore();

    const stopListening = store
      .getState()
      .capturePreview.startListening({ refreshOnStart: true });

    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledWith(true);
    });

    stopListening();
  });

  it("keeps the selected source when settings have not hydrated yet", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      settings: {
        ...state.settings,
        value: null,
      },
    }));
    store.getState().capturePreview.select("screen:manual");

    await store.getState().capturePreview.refresh();

    expect(store.getState().capturePreview.selectedSourceId).toBe("screen:1");
  });

  it("can refresh without a selected capture profile", async () => {
    const store = createTestStoreWithoutSelectedProfile();
    store.setState((state) => ({
      captureProfiles: {
        ...state.captureProfiles,
        items: [],
        selectedProfileId: null,
      },
    }));

    await store.getState().capturePreview.refresh();

    expect(store.getState().capturePreview.selectedSourceId).toBe(
      "missing-window:poe2",
    );
  });

  it("keeps an existing source when no selected profile target is available", async () => {
    const store = createTestStoreWithoutSelectedProfile();
    store.getState().capturePreview.select("screen:manual");

    await store.getState().capturePreview.refresh();

    expect(store.getState().capturePreview.selectedSourceId).toBe("screen:1");
  });

  it("stores error messages from Error objects", async () => {
    const store = createTestStore();
    listSources.mockRejectedValueOnce(new Error("No permission"));

    await store.getState().capturePreview.refresh();

    expect(store.getState().capturePreview.error).toBe("No permission");
  });

  it("loads and caches source thumbnails separately from source metadata", async () => {
    const store = createTestStore();

    await expect(
      store.getState().capturePreview.getThumbnail("screen:1"),
    ).resolves.toBe("data:image/png;base64,screen");
    await expect(
      store.getState().capturePreview.getThumbnail("screen:1"),
    ).resolves.toBe("data:image/png;base64,screen");

    expect(getSourceThumbnail).toHaveBeenCalledTimes(1);
    expect(getSourceThumbnail).toHaveBeenCalledWith("screen:1");
    expect(store.getState().capturePreview.thumbnailsBySourceId).toEqual({
      "screen:1": "data:image/png;base64,screen",
    });
  });

  it("coalesces concurrent thumbnail requests for the same source", async () => {
    let resolveThumbnail!: (value: string | null) => void;
    getSourceThumbnail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveThumbnail = resolve;
      }),
    );
    const store = createTestStore();

    const firstRequest = store
      .getState()
      .capturePreview.getThumbnail("screen:1");
    const secondRequest = store
      .getState()
      .capturePreview.getThumbnail("screen:1");

    expect(getSourceThumbnail).toHaveBeenCalledOnce();
    resolveThumbnail("data:image/png;base64,screen");
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      "data:image/png;base64,screen",
      "data:image/png;base64,screen",
    ]);
  });

  it("starts a fresh thumbnail request after a forced source refresh", async () => {
    let resolveStaleThumbnail!: (value: string | null) => void;
    getSourceThumbnail
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStaleThumbnail = resolve;
        }),
      )
      .mockResolvedValueOnce("data:image/png;base64,fresh");
    const store = createTestStore();

    const staleRequest = store
      .getState()
      .capturePreview.getThumbnail("screen:1");
    await store.getState().capturePreview.refresh({ force: true });
    await expect(
      store.getState().capturePreview.getThumbnail("screen:1"),
    ).resolves.toBe("data:image/png;base64,fresh");
    resolveStaleThumbnail("data:image/png;base64,stale");
    await expect(staleRequest).resolves.toBe("data:image/png;base64,stale");

    expect(getSourceThumbnail).toHaveBeenCalledTimes(2);
    expect(store.getState().capturePreview.thumbnailsBySourceId).toEqual({
      "screen:1": "data:image/png;base64,fresh",
    });
  });

  it("prunes cached thumbnails when refreshed sources no longer include them", async () => {
    const store = createTestStore();

    await store.getState().capturePreview.getThumbnail("screen:1");
    listSources.mockResolvedValueOnce([nextSource]);
    await store.getState().capturePreview.refresh();

    expect(store.getState().capturePreview.thumbnailsBySourceId).toEqual({});
  });

  it("keeps cached thumbnails for sources that remain listed", async () => {
    const store = createTestStore();

    await store.getState().capturePreview.getThumbnail("screen:1");
    await store.getState().capturePreview.refresh();

    expect(store.getState().capturePreview.thumbnailsBySourceId).toEqual({
      "screen:1": "data:image/png;base64,screen",
    });
  });

  it("caps retained cached thumbnails", async () => {
    getSourceThumbnail.mockImplementation(
      async (sourceId: string) => `data:image/png;base64,${sourceId}`,
    );
    const store = createTestStore();

    for (let index = 0; index < 18; index += 1) {
      await store.getState().capturePreview.getThumbnail(`screen:${index}`);
    }

    expect(
      Object.keys(store.getState().capturePreview.thumbnailsBySourceId),
    ).toHaveLength(16);
    expect(
      store.getState().capturePreview.thumbnailsBySourceId["screen:0"],
    ).toBeUndefined();
    expect(
      store.getState().capturePreview.thumbnailsBySourceId["screen:17"],
    ).toBe("data:image/png;base64,screen:17");
  });
});
