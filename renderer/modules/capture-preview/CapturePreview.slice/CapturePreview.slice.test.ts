import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStoppedPoeProcessStates } from "~/main/modules/poe-process/PoeProcess.dto";
import {
  createPoeProcessStatesWithState,
  createRunningPoeProcessState,
} from "~/main/test/poe-process";
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

  it("retries until a requested refresh finds the running game source", async () => {
    vi.useFakeTimers();
    listSources
      .mockResolvedValueOnce([source])
      .mockResolvedValueOnce([source])
      .mockResolvedValueOnce([source, poe2WindowSource]);
    const store = createTestStore();
    store.setState((state) => ({
      poeProcess: {
        ...state.poeProcess,
        state: createRunningPoeProcessState("poe2"),
        states: createPoeProcessStatesWithState(
          createRunningPoeProcessState("poe2"),
        ),
      },
    }));
    const stopListening = store.getState().capturePreview.startListening();

    refreshRequestedListener?.();
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledTimes(1);
    });

    await vi.advanceTimersByTimeAsync(2_499);
    expect(listSources).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledTimes(2);
    });
    await vi.advanceTimersByTimeAsync(2_500);
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledTimes(3);
    });
    await vi.advanceTimersByTimeAsync(2_500);
    expect(listSources).toHaveBeenCalledTimes(3);
    expect(listSources).toHaveBeenNthCalledWith(1, true);
    expect(listSources).toHaveBeenNthCalledWith(2, true);
    expect(listSources).toHaveBeenNthCalledWith(3, true);

    stopListening();
    vi.useRealTimers();
  });

  it("does not retry when a requested refresh includes the running game source", async () => {
    vi.useFakeTimers();
    listSources.mockResolvedValue([source, poe2WindowSource]);
    const store = createTestStore();
    store.setState((state) => ({
      poeProcess: {
        ...state.poeProcess,
        state: createRunningPoeProcessState("poe2"),
        states: createPoeProcessStatesWithState(
          createRunningPoeProcessState("poe2"),
        ),
      },
    }));
    const stopListening = store.getState().capturePreview.startListening();

    refreshRequestedListener?.();
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledTimes(1);
    });
    await vi.advanceTimersByTimeAsync(2_500);
    expect(listSources).toHaveBeenCalledTimes(1);

    stopListening();
    vi.useRealTimers();
  });

  it("does not retry when the game stops before the retry delay elapses", async () => {
    vi.useFakeTimers();
    listSources.mockResolvedValue([source]);
    const store = createTestStore();
    store.setState((state) => ({
      poeProcess: {
        ...state.poeProcess,
        state: createRunningPoeProcessState("poe2"),
        states: createPoeProcessStatesWithState(
          createRunningPoeProcessState("poe2"),
        ),
      },
    }));
    const stopListening = store.getState().capturePreview.startListening();

    refreshRequestedListener?.();
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledTimes(1);
    });
    store.setState((state) => ({
      poeProcess: {
        ...state.poeProcess,
        state: {
          isRunning: false,
          processName: "",
        },
        states: createStoppedPoeProcessStates(),
      },
    }));

    await vi.advanceTimersByTimeAsync(2_500);
    expect(listSources).toHaveBeenCalledTimes(1);

    stopListening();
    vi.useRealTimers();
  });

  it("cancels a pending retry when the listener stops", async () => {
    vi.useFakeTimers();
    listSources.mockResolvedValue([source]);
    const store = createTestStore();
    store.setState((state) => ({
      poeProcess: {
        ...state.poeProcess,
        state: createRunningPoeProcessState("poe2"),
        states: createPoeProcessStatesWithState(
          createRunningPoeProcessState("poe2"),
        ),
      },
    }));
    const stopListening = store.getState().capturePreview.startListening();

    refreshRequestedListener?.();
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(vi.getTimerCount()).toBe(1);
    });

    stopListening();
    await vi.advanceTimersByTimeAsync(2_500);

    expect(listSources).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not retry when a newer refresh finds the running game source", async () => {
    vi.useFakeTimers();
    listSources
      .mockResolvedValueOnce([source])
      .mockResolvedValueOnce([source, poe2WindowSource]);
    const store = createTestStore();
    store.setState((state) => ({
      poeProcess: {
        ...state.poeProcess,
        state: createRunningPoeProcessState("poe2"),
        states: createPoeProcessStatesWithState(
          createRunningPoeProcessState("poe2"),
        ),
      },
    }));
    const stopListening = store.getState().capturePreview.startListening();

    refreshRequestedListener?.();
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledTimes(1);
    });
    await store.getState().capturePreview.refresh({ force: true });
    expect(listSources).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2_500);
    expect(listSources).toHaveBeenCalledTimes(2);

    stopListening();
    vi.useRealTimers();
  });

  it("stops retrying after the retry budget is exhausted", async () => {
    vi.useFakeTimers();
    listSources.mockResolvedValue([source]);
    const store = createTestStore();
    store.setState((state) => ({
      poeProcess: {
        ...state.poeProcess,
        state: createRunningPoeProcessState("poe2"),
        states: createPoeProcessStatesWithState(
          createRunningPoeProcessState("poe2"),
        ),
      },
    }));
    const stopListening = store.getState().capturePreview.startListening();

    refreshRequestedListener?.();
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledTimes(1);
    });

    for (let index = 0; index < 8; index += 1) {
      await vi.advanceTimersByTimeAsync(2_500);
      await vi.waitFor(() => {
        expect(listSources).toHaveBeenCalledTimes(index + 2);
      });
    }
    await vi.advanceTimersByTimeAsync(2_500);

    expect(listSources).toHaveBeenCalledTimes(9);
    stopListening();
    vi.useRealTimers();
  });

  it("ignores stale retry refreshes after the listener stops", async () => {
    vi.useFakeTimers();
    let resolveRetryRefresh: (sources: CapturePreviewSource[]) => void = () =>
      undefined;
    listSources.mockResolvedValueOnce([source]).mockReturnValueOnce(
      new Promise<CapturePreviewSource[]>((resolve) => {
        resolveRetryRefresh = resolve;
      }),
    );
    const store = createTestStore();
    store.setState((state) => ({
      poeProcess: {
        ...state.poeProcess,
        state: createRunningPoeProcessState("poe2"),
        states: createPoeProcessStatesWithState(
          createRunningPoeProcessState("poe2"),
        ),
      },
    }));
    const stopListening = store.getState().capturePreview.startListening();

    refreshRequestedListener?.();
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledTimes(1);
    });
    await vi.advanceTimersByTimeAsync(2_500);
    await vi.waitFor(() => {
      expect(listSources).toHaveBeenCalledTimes(2);
    });

    stopListening();
    resolveRetryRefresh([source]);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2_500);

    expect(listSources).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
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
