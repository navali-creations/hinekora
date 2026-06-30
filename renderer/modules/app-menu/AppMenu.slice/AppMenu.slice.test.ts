import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LatestReleaseInfo } from "~/main/modules/updater/Updater.api";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createAppMenuSlice } from "./AppMenu.slice";

function createRelease(
  version: string,
  changeType = "Patch Changes",
): LatestReleaseInfo {
  return {
    body: "",
    changeType,
    entries: [{ description: `Release ${version}` }],
    name: `v${version}`,
    publishedAt: "2026-06-18T00:00:00.000Z",
    url: `https://github.com/navali-creations/hinekora/releases/tag/v${version}`,
    version,
  };
}

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createAppMenuSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("AppMenu slice", () => {
  const releases = [
    createRelease("0.1.0"),
    createRelease("0.2.0", "Minor Changes"),
    createRelease("0.2.1"),
  ];
  const close = vi.fn();
  const getRecentReleases = vi.fn();
  const getSettings = vi.fn();
  const getVersion = vi.fn();
  const isMaximized = vi.fn();
  const isRecorderRequested = vi.fn();
  const isRecorderVisible = vi.fn();
  const maximize = vi.fn();
  const minimize = vi.fn();
  const toggleRecorder = vi.fn();
  const unmaximize = vi.fn();
  const updateSettings = vi.fn();
  const unsubscribe = vi.fn();
  let recorderVisibilityListener: ((isVisible: boolean) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    recorderVisibilityListener = null;
    close.mockResolvedValue(undefined);
    getRecentReleases.mockResolvedValue(releases);
    getSettings.mockResolvedValue({ lastSeenAppVersion: null });
    getVersion.mockResolvedValue("0.2.1");
    isMaximized.mockResolvedValue(false);
    isRecorderRequested.mockResolvedValue(true);
    isRecorderVisible.mockResolvedValue(true);
    maximize.mockResolvedValue(undefined);
    minimize.mockResolvedValue(undefined);
    toggleRecorder.mockResolvedValue(undefined);
    unmaximize.mockResolvedValue(undefined);
    updateSettings.mockResolvedValue(undefined);

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        app: {
          getVersion,
        },
        mainWindow: {
          close,
          isMaximized,
          maximize,
          minimize,
          unmaximize,
        },
        overlayWindows: {
          isRecorderRequested,
          isRecorderVisible,
          onRecorderVisibilityChanged: vi.fn(
            (listener: (isVisible: boolean) => void) => {
              recorderVisibilityListener = listener;
              return unsubscribe;
            },
          ),
          toggleRecorder,
        },
        settings: {
          get: getSettings,
          update: updateSettings,
        },
        updater: {
          getRecentReleases,
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hydrates window and overlay state and marks the current version seen", async () => {
    const store = createTestStore();

    await store.getState().appMenu.hydrate();

    expect(store.getState().appMenu).toMatchObject({
      isMaximized: false,
      isRecorderOverlayRequested: true,
      isRecorderOverlayVisible: true,
    });
    expect(updateSettings).toHaveBeenCalledWith({
      lastSeenAppVersion: "0.2.1",
    });
  });

  it("falls back when hydrate calls fail and schedules Whats New for upgraded installs", async () => {
    const store = createTestStore();
    isMaximized.mockRejectedValueOnce(new Error("window failed"));
    isRecorderVisible.mockRejectedValueOnce(new Error("overlay failed"));
    getSettings.mockResolvedValueOnce({ lastSeenAppVersion: "0.1.0" });

    await store.getState().appMenu.hydrate();
    await vi.runOnlyPendingTimersAsync();

    expect(store.getState().appMenu).toMatchObject({
      isMaximized: false,
      isRecorderOverlayRequested: false,
      isRecorderOverlayVisible: false,
      isWhatsNewOpen: true,
      whatsNewCurrentVersion: "0.2.1",
      whatsNewFromVersion: "0.1.0",
      whatsNewSelectedVersion: "0.2.0",
    });
  });

  it("runs window and overlay actions", async () => {
    const store = createTestStore();
    isMaximized.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    isRecorderRequested.mockResolvedValueOnce(false);
    isRecorderVisible.mockResolvedValueOnce(false);

    store.getState().appMenu.minimize();
    await store.getState().appMenu.maximize();
    await store.getState().appMenu.unmaximize();
    store.getState().appMenu.close();
    store.getState().appMenu.setIsMaximized(true);
    await store.getState().appMenu.toggleRecorderOverlay();
    store.getState().appMenu.setRecorderOverlayVisible(true);

    expect(minimize).toHaveBeenCalled();
    expect(maximize).toHaveBeenCalled();
    expect(unmaximize).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(toggleRecorder).toHaveBeenCalled();
    expect(store.getState().appMenu).toMatchObject({
      isMaximized: true,
      isRecorderOverlayRequested: false,
      isRecorderOverlayVisible: true,
    });
  });

  it("opens Whats New, reuses fetched releases, selects releases, and closes it", async () => {
    const store = createTestStore();

    await store.getState().appMenu.openWhatsNew();
    await store.getState().appMenu.openWhatsNew();
    store.getState().appMenu.selectWhatsNewRelease("0.2.1");
    store.getState().appMenu.selectWhatsNewRelease("missing");
    store.setState((state) => ({
      appMenu: {
        ...state.appMenu,
        whatsNewCurrentVersion: "0.2.1",
      },
    }));
    store.getState().appMenu.closeWhatsNew();

    expect(getRecentReleases).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      lastSeenAppVersion: "0.2.1",
    });
    expect(store.getState().appMenu).toMatchObject({
      isWhatsNewOpen: false,
      whatsNewRelease: releases.at(-1),
      whatsNewSelectedVersion: "0.2.1",
    });
  });

  it("ignores last-seen persistence failures when closing Whats New", async () => {
    const store = createTestStore();

    await store.getState().appMenu.openWhatsNew();
    store.setState((state) => ({
      appMenu: {
        ...state.appMenu,
        whatsNewCurrentVersion: "0.2.1",
      },
    }));
    updateSettings.mockRejectedValueOnce(new Error("write failed"));

    store.getState().appMenu.closeWhatsNew();
    await Promise.resolve();

    expect(store.getState().appMenu.isWhatsNewOpen).toBe(false);
  });

  it("handles empty and failed Whats New fetches", async () => {
    const store = createTestStore();

    getRecentReleases.mockResolvedValueOnce([]);
    await store.getState().appMenu.openWhatsNew();
    expect(store.getState().appMenu).toMatchObject({
      whatsNewError: "Could not fetch release information.",
      whatsNewHasFetched: true,
      whatsNewIsLoading: false,
    });

    store.getState().appMenu.closeWhatsNew();
    store.setState((state) => ({
      appMenu: {
        ...state.appMenu,
        whatsNewHasFetched: false,
      },
    }));
    getRecentReleases.mockRejectedValueOnce("offline");
    await store.getState().appMenu.openWhatsNew();
    expect(store.getState().appMenu.whatsNewError).toBe(
      "Could not fetch release information.",
    );

    store.getState().appMenu.closeWhatsNew();
    store.setState((state) => ({
      appMenu: {
        ...state.appMenu,
        whatsNewHasFetched: false,
      },
    }));
    getRecentReleases.mockRejectedValueOnce(new Error("network failed"));
    await store.getState().appMenu.openWhatsNew();
    expect(store.getState().appMenu.whatsNewError).toBe("network failed");
  });

  it("listens for recorder visibility changes", async () => {
    const store = createTestStore();
    const stopListening = store.getState().appMenu.startListening();
    isRecorderRequested.mockResolvedValueOnce(false);

    recorderVisibilityListener?.(true);
    await Promise.resolve();
    stopListening();

    expect(store.getState().appMenu.isRecorderOverlayRequested).toBe(false);
    expect(store.getState().appMenu.isRecorderOverlayVisible).toBe(true);
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("falls back when recorder requested state changes cannot be read", async () => {
    const store = createTestStore();
    const stopListening = store.getState().appMenu.startListening();
    isRecorderRequested.mockRejectedValueOnce(new Error("overlay failed"));

    recorderVisibilityListener?.(true);
    await Promise.resolve();
    stopListening();

    expect(store.getState().appMenu.isRecorderOverlayRequested).toBe(false);
    expect(store.getState().appMenu.isRecorderOverlayVisible).toBe(true);
  });
});
