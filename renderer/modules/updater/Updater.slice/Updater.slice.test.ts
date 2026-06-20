import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DownloadProgress,
  UpdateInfo,
} from "~/main/modules/updater/Updater.service";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createUpdaterSlice } from "./Updater.slice";

const updateInfo: UpdateInfo = {
  currentVersion: "0.1.0",
  downloadUrl: null,
  latestVersion: "0.2.0",
  manualDownload: false,
  publishedAt: "2026-06-18T00:00:00.000Z",
  releaseName: "v0.2.0",
  releaseNotes: "Changes",
  releaseUrl:
    "https://github.com/navali-creations/hinekora/releases/tag/v0.2.0",
  updateAvailable: true,
};

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createUpdaterSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("Updater slice", () => {
  const checkForUpdates = vi.fn();
  const installUpdate = vi.fn();
  const unsubscribeAvailable = vi.fn();
  const unsubscribeProgress = vi.fn();
  let availableListener: ((info: UpdateInfo) => void) | null = null;
  let progressListener: ((progress: DownloadProgress) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    availableListener = null;
    progressListener = null;
    checkForUpdates.mockResolvedValue(updateInfo);
    installUpdate.mockResolvedValue({ success: true });

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        updater: {
          checkForUpdates,
          installUpdate,
          onDownloadProgress: vi.fn(
            (listener: (progress: DownloadProgress) => void) => {
              progressListener = listener;
              return unsubscribeProgress;
            },
          ),
          onUpdateAvailable: vi.fn((listener: (info: UpdateInfo) => void) => {
            availableListener = listener;
            return unsubscribeAvailable;
          }),
        },
      },
    });
  });

  it("checks for updates, dismisses, and ignores no-update results", async () => {
    const store = createTestStore();

    await store.getState().updater.checkForUpdates();
    store.getState().updater.dismiss();

    expect(store.getState().updater).toMatchObject({
      isDismissed: true,
      updateAvailable: true,
      updateInfo,
    });

    checkForUpdates.mockResolvedValueOnce({
      ...updateInfo,
      updateAvailable: false,
    });
    await store.getState().updater.checkForUpdates();
    expect(store.getState().updater.updateInfo).toBe(updateInfo);

    checkForUpdates.mockResolvedValueOnce(null);
    await store.getState().updater.checkForUpdates();
    expect(store.getState().updater.updateInfo).toBe(updateInfo);
  });

  it("logs failed update checks", async () => {
    const store = createTestStore();
    checkForUpdates.mockRejectedValueOnce(new Error("offline"));

    await store.getState().updater.checkForUpdates();

    expect(console.error).toHaveBeenCalledWith(
      "[Updater] Failed to check for updates:",
      expect.any(Error),
    );
  });

  it("installs ready updates and stores install failures", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      updater: {
        ...state.updater,
        status: "ready",
      },
    }));

    await store.getState().updater.downloadAndInstall();

    expect(installUpdate).toHaveBeenCalled();
    expect(store.getState().updater).toMatchObject({
      error: null,
      status: "ready",
    });

    store.setState((state) => ({
      updater: {
        ...state.updater,
        status: "ready",
      },
    }));
    installUpdate
      .mockResolvedValueOnce({ success: false, error: "blocked" })
      .mockResolvedValueOnce({ success: false });

    await store.getState().updater.downloadAndInstall();
    expect(store.getState().updater).toMatchObject({
      error: "blocked",
      status: "error",
    });

    store.setState((state) => ({
      updater: {
        ...state.updater,
        status: "ready",
      },
    }));
    await store.getState().updater.downloadAndInstall();
    expect(store.getState().updater.error).toBe("Install failed");
  });

  it("retries update checks unless already downloading", async () => {
    const store = createTestStore();

    await store.getState().updater.downloadAndInstall();
    expect(store.getState().updater.updateAvailable).toBe(true);

    checkForUpdates.mockResolvedValueOnce(null);
    await store.getState().updater.downloadAndInstall();
    expect(store.getState().updater.status).toBe("idle");

    store.setState((state) => ({
      updater: {
        ...state.updater,
        status: "downloading",
      },
    }));
    checkForUpdates.mockClear();
    await store.getState().updater.downloadAndInstall();
    expect(checkForUpdates).not.toHaveBeenCalled();
  });

  it("stores retry errors and listens for update events", async () => {
    const store = createTestStore();
    checkForUpdates.mockRejectedValueOnce(new Error("offline"));

    await store.getState().updater.downloadAndInstall();
    expect(store.getState().updater).toMatchObject({
      error: "Failed to check for updates",
      status: "error",
    });

    const stopListening = store.getState().updater.startListening();
    availableListener?.(updateInfo);
    progressListener?.({ percent: 50, totalBytes: 100, transferredBytes: 50 });
    expect(store.getState().updater.status).toBe("downloading");

    progressListener?.({
      percent: 100,
      totalBytes: 100,
      transferredBytes: 100,
    });
    stopListening();

    expect(store.getState().updater.status).toBe("ready");
    expect(unsubscribeAvailable).toHaveBeenCalled();
    expect(unsubscribeProgress).toHaveBeenCalled();
  });
});
