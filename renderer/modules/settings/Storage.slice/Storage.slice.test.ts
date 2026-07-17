import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  StorageGameLeagueUsage,
  StorageInfo,
} from "~/main/modules/storage/Storage.dto";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createStorageSlice } from "./Storage.slice";

function createStorageInfo(): StorageInfo {
  return {
    storagePath: "C:\\Videos\\Hinekora Recordings",
    mediaSizeBytes: 0,
    appInstallationSizeBytes: 0,
    temporarySizeBytes: 0,
    rewindBufferEstimateBytes: 0,
    databaseSizeBytes: 0,
    totalTrackedSizeBytes: 0,
    diskTotalBytes: 100,
    diskFreeBytes: 50,
    appInstallationDiskTotalBytes: 100,
    appInstallationDiskFreeBytes: 50,
    databaseDiskTotalBytes: 100,
    databaseDiskFreeBytes: 50,
    breakdown: [],
    calculatedAt: "2026-06-18T00:00:00.000Z",
  };
}

function createGameLeagueUsage(): StorageGameLeagueUsage {
  return {
    id: "poe2:Standard",
    game: "poe2",
    leagueName: "Standard",
    clipCount: 1,
    recordingCount: 1,
    estimatedSizeBytes: 10,
    hasActiveRecording: false,
  };
}

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createStorageSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("Storage slice", () => {
  const getInfo = vi.fn();
  const getGameLeagueUsage = vi.fn();
  const deleteGameLeagueData = vi.fn();
  const revealPaths = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getInfo.mockResolvedValue(createStorageInfo());
    getGameLeagueUsage.mockResolvedValue([createGameLeagueUsage()]);
    deleteGameLeagueData.mockResolvedValue({
      success: true,
      cleanupError: "Failed to delete one or more files",
      freedBytes: 10,
      failedFileCount: 1,
      deletedClipCount: 1,
      deletedRecordingCount: 1,
    });
    revealPaths.mockResolvedValue({
      storagePath: "C:\\Videos\\Hinekora Recordings",
      databasePath: "C:\\Data\\hinekora.sqlite",
    });

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        storage: {
          getInfo,
          getGameLeagueUsage,
          deleteGameLeagueData,
          revealPaths,
        },
      },
    });
  });

  it("refreshes after league cleanup warnings and keeps the warning", async () => {
    const store = createTestStore();

    await store.getState().storage.deleteGameLeagueData({
      game: "poe2",
      leagueName: "Standard",
    });

    expect(getInfo).toHaveBeenCalledTimes(1);
    expect(getGameLeagueUsage).toHaveBeenCalledTimes(1);
    expect(store.getState().storage.deletingGameLeagueId).toBeNull();
    expect(store.getState().storage.error).toBe(
      "Failed to delete one or more files",
    );
  });

  it("clears errors after successful league cleanup without warnings", async () => {
    deleteGameLeagueData.mockResolvedValueOnce({
      success: true,
      freedBytes: 10,
      failedFileCount: 0,
      deletedClipCount: 1,
      deletedRecordingCount: 1,
    });
    const store = createTestStore();

    await store.getState().storage.deleteGameLeagueData({
      game: "poe2",
      leagueName: "Standard",
    });

    expect(store.getState().storage.error).toBeNull();
    expect(store.getState().storage.deletingGameLeagueId).toBeNull();
  });

  it("refreshes storage info and usage", async () => {
    const store = createTestStore();

    await store.getState().storage.refresh();

    expect(store.getState().storage).toMatchObject({
      error: null,
      gameLeagueUsage: [createGameLeagueUsage()],
      info: createStorageInfo(),
      isLoading: false,
    });
  });

  it("stores refresh fallback errors", async () => {
    const store = createTestStore();
    getInfo.mockRejectedValueOnce("info failed");
    getGameLeagueUsage.mockRejectedValueOnce("usage failed");

    await store.getState().storage.fetchStorageInfo();
    expect(store.getState().storage.error).toBe("Failed to fetch storage");

    await store.getState().storage.fetchGameLeagueUsage();
    expect(store.getState().storage.error).toBe(
      "Failed to fetch storage usage",
    );

    getInfo.mockRejectedValueOnce(new Error("info failed"));
    await store.getState().storage.fetchStorageInfo();
    expect(store.getState().storage.error).toBe("info failed");

    getGameLeagueUsage.mockRejectedValueOnce(new Error("usage failed"));
    await store.getState().storage.fetchGameLeagueUsage();
    expect(store.getState().storage.error).toBe("usage failed");
  });

  it("returns failed delete results and clears deleting state", async () => {
    const store = createTestStore();
    deleteGameLeagueData
      .mockResolvedValueOnce({
        success: false,
      })
      .mockRejectedValueOnce(new Error("delete failed"))
      .mockRejectedValueOnce("delete failed");

    const failedResult = await store.getState().storage.deleteGameLeagueData({
      game: "poe2",
      leagueName: "Standard",
    });
    expect(failedResult).toMatchObject({
      success: false,
    });
    expect(store.getState().storage.error).toBe("Failed to delete league data");
    expect(store.getState().storage.deletingGameLeagueId).toBeNull();

    const thrownResult = await store.getState().storage.deleteGameLeagueData({
      game: "poe2",
      leagueName: "Standard",
    });
    expect(thrownResult).toMatchObject({
      error: "delete failed",
      success: false,
    });

    const stringThrownResult = await store
      .getState()
      .storage.deleteGameLeagueData({
        game: "poe2",
        leagueName: "Standard",
      });
    expect(stringThrownResult).toMatchObject({
      error: "Failed to delete league data",
      success: false,
    });
    expect(store.getState().storage.deletingGameLeagueId).toBeNull();
  });
});
