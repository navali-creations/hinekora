import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  hydrateManagedRecorder: vi.fn(),
  hydratePoeProcess: vi.fn(),
  hydrateProfiles: vi.fn(),
  hydrateSettings: vi.fn(),
  startCapturePreviewListener: vi.fn(),
  startManagedRecorderListener: vi.fn(),
  startPoeProcessListener: vi.fn(),
  startProfilesListener: vi.fn(),
  startReplayClipsListener: vi.fn(),
  startSettingsListener: vi.fn(),
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
    storeMocks.hydratePoeProcess.mockResolvedValue(undefined);
    storeMocks.hydrateProfiles.mockResolvedValue(undefined);
    storeMocks.hydrateSettings.mockResolvedValue(undefined);
    storeMocks.startCapturePreviewListener.mockReturnValue(vi.fn());
    storeMocks.startManagedRecorderListener.mockReturnValue(vi.fn());
    storeMocks.startPoeProcessListener.mockReturnValue(vi.fn());
    storeMocks.startProfilesListener.mockReturnValue(vi.fn());
    storeMocks.startReplayClipsListener.mockReturnValue(vi.fn());
    storeMocks.startSettingsListener.mockReturnValue(vi.fn());
    storeMocks.useBoundStore.mockImplementation((selector) =>
      selector({
        capturePreview: {
          startListening: storeMocks.startCapturePreviewListener,
        },
        managedRecorder: {
          hydrate: storeMocks.hydrateManagedRecorder,
          startListening: storeMocks.startManagedRecorderListener,
        },
        poeProcess: {
          hydrate: storeMocks.hydratePoeProcess,
          startListening: storeMocks.startPoeProcessListener,
        },
        profiles: {
          hydrate: storeMocks.hydrateProfiles,
          startListening: storeMocks.startProfilesListener,
        },
        replayClips: {
          startListening: storeMocks.startReplayClipsListener,
        },
        settings: {
          hydrate: storeMocks.hydrateSettings,
          startListening: storeMocks.startSettingsListener,
        },
      }),
    );
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("hydrates aura settings, profiles, and process before starting capture source refresh", async () => {
    const settingsHydration = createDeferred();
    const profileHydration = createDeferred();
    const poeProcessHydration = createDeferred();
    storeMocks.hydrateSettings.mockReturnValue(settingsHydration.promise);
    storeMocks.hydrateProfiles.mockReturnValue(profileHydration.promise);
    storeMocks.hydratePoeProcess.mockReturnValue(poeProcessHydration.promise);
    const { root } = renderApp();

    await act(async () => {
      root.render(<App />);
    });

    expect(storeMocks.hydrateSettings).toHaveBeenCalledTimes(1);
    expect(storeMocks.hydrateProfiles).not.toHaveBeenCalled();
    expect(storeMocks.hydratePoeProcess).not.toHaveBeenCalled();
    expect(storeMocks.startCapturePreviewListener).not.toHaveBeenCalled();

    await act(async () => {
      settingsHydration.resolve();
      await settingsHydration.promise;
      await Promise.resolve();
    });

    expect(storeMocks.hydrateProfiles).toHaveBeenCalledTimes(1);
    expect(storeMocks.hydratePoeProcess).toHaveBeenCalledTimes(1);
    expect(storeMocks.startCapturePreviewListener).not.toHaveBeenCalled();

    await act(async () => {
      profileHydration.resolve();
      await profileHydration.promise;
      await Promise.resolve();
    });

    expect(storeMocks.startCapturePreviewListener).not.toHaveBeenCalled();

    await act(async () => {
      poeProcessHydration.resolve();
      await poeProcessHydration.promise;
      await Promise.resolve();
    });

    expect(storeMocks.startCapturePreviewListener).toHaveBeenCalledWith({
      refreshOnStart: true,
    });
    const settingsCallOrder =
      storeMocks.hydrateSettings.mock.invocationCallOrder[0];
    const hydrateProfilesCallOrder =
      storeMocks.hydrateProfiles.mock.invocationCallOrder[0];
    const hydratePoeProcessCallOrder =
      storeMocks.hydratePoeProcess.mock.invocationCallOrder[0];
    const startCaptureListenerCallOrder =
      storeMocks.startCapturePreviewListener.mock.invocationCallOrder[0];
    expect(settingsCallOrder).toBeDefined();
    expect(hydrateProfilesCallOrder).toBeDefined();
    expect(hydratePoeProcessCallOrder).toBeDefined();
    expect(startCaptureListenerCallOrder).toBeDefined();
    expect(settingsCallOrder ?? 0).toBeLessThan(hydrateProfilesCallOrder ?? 0);
    expect(settingsCallOrder ?? 0).toBeLessThan(
      hydratePoeProcessCallOrder ?? 0,
    );
    expect(hydrateProfilesCallOrder ?? 0).toBeLessThan(
      startCaptureListenerCallOrder ?? 0,
    );
    expect(hydratePoeProcessCallOrder ?? 0).toBeLessThan(
      startCaptureListenerCallOrder ?? 0,
    );
  });

  it("cleans up aura overlay listeners on unmount", async () => {
    const stopCapturePreviewListener = vi.fn();
    const stopPoeProcessListener = vi.fn();
    const stopProfilesListener = vi.fn();
    const stopSettingsListener = vi.fn();
    storeMocks.startCapturePreviewListener.mockReturnValue(
      stopCapturePreviewListener,
    );
    storeMocks.startPoeProcessListener.mockReturnValue(stopPoeProcessListener);
    storeMocks.startProfilesListener.mockReturnValue(stopProfilesListener);
    storeMocks.startSettingsListener.mockReturnValue(stopSettingsListener);
    const { root } = renderApp();

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      root.unmount();
    });

    expect(stopCapturePreviewListener).toHaveBeenCalledTimes(1);
    expect(stopPoeProcessListener).toHaveBeenCalledTimes(1);
    expect(stopProfilesListener).toHaveBeenCalledTimes(1);
    expect(stopSettingsListener).toHaveBeenCalledTimes(1);
  });

  it("hydrates recorder overlay settings before recorder, clips, and profiles state", async () => {
    window.location.hash = "#/recorder-overlay";
    const settingsHydration = createDeferred();
    storeMocks.hydrateSettings.mockReturnValue(settingsHydration.promise);
    const { root } = renderApp();

    await act(async () => {
      root.render(<App />);
    });

    expect(storeMocks.hydrateSettings).toHaveBeenCalledTimes(1);
    expect(storeMocks.hydrateManagedRecorder).not.toHaveBeenCalled();
    expect(storeMocks.hydrateProfiles).not.toHaveBeenCalled();
    expect(storeMocks.startManagedRecorderListener).toHaveBeenCalledTimes(1);
    expect(storeMocks.startProfilesListener).toHaveBeenCalledTimes(1);
    expect(storeMocks.startReplayClipsListener).toHaveBeenCalledTimes(1);
    expect(storeMocks.startSettingsListener).toHaveBeenCalledTimes(1);

    await act(async () => {
      settingsHydration.resolve();
      await settingsHydration.promise;
      await Promise.resolve();
    });

    expect(storeMocks.hydrateManagedRecorder).toHaveBeenCalledTimes(1);
    expect(storeMocks.hydrateProfiles).toHaveBeenCalledTimes(1);
  });

  it("hydrates only settings for the clip preview overlay", async () => {
    window.location.hash = "#/clip-preview-overlay?clipId=clip-1";
    const stopSettingsListener = vi.fn();
    storeMocks.startSettingsListener.mockReturnValue(stopSettingsListener);
    const { container, root } = renderApp();

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain("Clip preview overlay");
    expect(storeMocks.hydrateSettings).toHaveBeenCalledTimes(1);
    expect(storeMocks.startSettingsListener).toHaveBeenCalledTimes(1);
    expect(storeMocks.startReplayClipsListener).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    expect(stopSettingsListener).toHaveBeenCalledTimes(1);
  });
});
