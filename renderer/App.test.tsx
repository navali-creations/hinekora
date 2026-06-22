import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  hydrateManagedRecorder: vi.fn(),
  hydrateProfiles: vi.fn(),
  hydrateReplayClips: vi.fn(),
  refreshCapturePreview: vi.fn(),
  startManagedRecorderListener: vi.fn(),
  startProfilesListener: vi.fn(),
  startReplayClipsListener: vi.fn(),
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useBoundStore: storeMocks.useBoundStore,
}));

vi.mock(
  "~/renderer/modules/aura-overlay/AuraOverlay.page/AuraOverlay.page",
  () => ({
    AuraOverlayPage: () => <div>Aura overlay</div>,
  }),
);
vi.mock(
  "~/renderer/modules/clip-preview-overlay/ClipPreviewOverlay.page/ClipPreviewOverlay.page",
  () => ({
    ClipPreviewOverlayPage: () => <div>Clip preview overlay</div>,
  }),
);
vi.mock(
  "~/renderer/modules/crop-selector-overlay/CropSelectorOverlay.page/CropSelectorOverlay.page",
  () => ({
    CropSelectorOverlayPage: () => <div>Crop selector overlay</div>,
  }),
);
vi.mock(
  "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.page/RecorderControlsOverlay.page",
  () => ({
    RecorderControlsOverlayPage: () => <div>Recorder overlay</div>,
  }),
);

import { App } from "./App";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function renderApp() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  return { container, root };
}

describe("App overlay bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "#/aura-overlay?profileId=profile-1";
    storeMocks.hydrateManagedRecorder.mockResolvedValue(undefined);
    storeMocks.hydrateProfiles.mockResolvedValue(undefined);
    storeMocks.hydrateReplayClips.mockResolvedValue(undefined);
    storeMocks.refreshCapturePreview.mockResolvedValue(undefined);
    storeMocks.startManagedRecorderListener.mockReturnValue(vi.fn());
    storeMocks.startProfilesListener.mockReturnValue(vi.fn());
    storeMocks.startReplayClipsListener.mockReturnValue(vi.fn());
    storeMocks.useBoundStore.mockImplementation((selector) =>
      selector({
        capturePreview: {
          refresh: storeMocks.refreshCapturePreview,
        },
        managedRecorder: {
          hydrate: storeMocks.hydrateManagedRecorder,
          startListening: storeMocks.startManagedRecorderListener,
        },
        profiles: {
          hydrate: storeMocks.hydrateProfiles,
          startListening: storeMocks.startProfilesListener,
        },
        replayClips: {
          hydrate: storeMocks.hydrateReplayClips,
          startListening: storeMocks.startReplayClipsListener,
        },
      }),
    );
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("hydrates aura profiles before refreshing capture sources", async () => {
    const profileHydration = createDeferred();
    storeMocks.hydrateProfiles.mockReturnValue(profileHydration.promise);
    const { root } = renderApp();

    await act(async () => {
      root.render(<App />);
    });

    expect(storeMocks.hydrateProfiles).toHaveBeenCalledTimes(1);
    expect(storeMocks.refreshCapturePreview).not.toHaveBeenCalled();

    await act(async () => {
      profileHydration.resolve();
      await profileHydration.promise;
      await Promise.resolve();
    });

    expect(storeMocks.refreshCapturePreview).toHaveBeenCalledTimes(1);
    const hydrateCallOrder =
      storeMocks.hydrateProfiles.mock.invocationCallOrder[0];
    const refreshCallOrder =
      storeMocks.refreshCapturePreview.mock.invocationCallOrder[0];
    expect(hydrateCallOrder).toBeDefined();
    expect(refreshCallOrder).toBeDefined();
    expect(hydrateCallOrder ?? 0).toBeLessThan(refreshCallOrder ?? 0);
  });

  it("hydrates recorder overlay recorder, clips, and profiles state", async () => {
    window.location.hash = "#/recorder-overlay";
    const { root } = renderApp();

    await act(async () => {
      root.render(<App />);
    });

    expect(storeMocks.hydrateManagedRecorder).toHaveBeenCalledTimes(1);
    expect(storeMocks.hydrateProfiles).toHaveBeenCalledTimes(1);
    expect(storeMocks.hydrateReplayClips).toHaveBeenCalledTimes(1);
    expect(storeMocks.startManagedRecorderListener).toHaveBeenCalledTimes(1);
    expect(storeMocks.startProfilesListener).toHaveBeenCalledTimes(1);
    expect(storeMocks.startReplayClipsListener).toHaveBeenCalledTimes(1);
  });
});
