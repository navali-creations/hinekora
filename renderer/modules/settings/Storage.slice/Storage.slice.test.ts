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
    recordingsSizeBytes: 0,
    recordingUsageTruncated: false,
    exportStorageVolumes: [],
    exportVideosUsageTruncated: false,
    appInstallationSizeBytes: 0,
    temporarySizeBytes: 0,
    rewindBufferEstimateBytes: 0,
    databaseSizeBytes: 0,
    totalTrackedSizeBytes: 0,
    diskTotalBytes: 100,
    diskFreeBytes: 50,
    appInstallationOnStorageDrive: true,
    databaseOnStorageDrive: true,
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
  const getAnalysisAvailability = vi.fn();
  const getInfo = vi.fn();
  const getGameLeagueUsage = vi.fn();
  const deleteGameLeagueData = vi.fn();
  const onAnalysisAvailabilityChanged = vi.fn();
  const revealPaths = vi.fn();
  let analysisAvailabilityListener:
    | ((availability: "deferred" | "ready") => void)
    | null;

  beforeEach(() => {
    vi.clearAllMocks();
    analysisAvailabilityListener = null;
    getAnalysisAvailability.mockResolvedValue("ready");
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
      exportStoragePath: "C:\\Videos\\Hinekora Exports",
      exportStorageVolumes: [],
      databasePath: "C:\\Data\\hinekora.sqlite",
    });
    onAnalysisAvailabilityChanged.mockImplementation((listener) => {
      analysisAvailabilityListener = listener;
      return vi.fn();
    });

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        storage: {
          getAnalysisAvailability,
          getInfo,
          getGameLeagueUsage,
          deleteGameLeagueData,
          onAnalysisAvailabilityChanged,
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

    expect(store.getState().storage.deletingGameLeagueId).toBeNull();
    expect(store.getState().storage.error).toBe(
      "Failed to delete one or more files",
    );
    await vi.waitFor(() => {
      expect(getInfo).toHaveBeenCalledTimes(1);
      expect(getGameLeagueUsage).toHaveBeenCalledTimes(1);
    });
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
    expect(getAnalysisAvailability).toHaveBeenCalledOnce();
  });

  it("runs one fresh analysis after a mutation overlaps an active refresh", async () => {
    let resolveInitialInfo!: (info: StorageInfo) => void;
    getInfo
      .mockReturnValueOnce(
        new Promise<StorageInfo>((resolvePromise) => {
          resolveInitialInfo = resolvePromise;
        }),
      )
      .mockResolvedValueOnce({
        ...createStorageInfo(),
        storagePath: "D:\\Hinekora Recordings",
      });
    const store = createTestStore();

    const initialRefresh = store.getState().storage.refresh();
    await vi.waitFor(() => {
      expect(getInfo).toHaveBeenCalledOnce();
    });
    const mutationRefresh = store.getState().storage.refreshAfterMutation();

    resolveInitialInfo(createStorageInfo());
    await Promise.all([initialRefresh, mutationRefresh]);

    expect(getInfo).toHaveBeenCalledTimes(2);
    expect(getGameLeagueUsage).toHaveBeenCalledTimes(2);
    expect(store.getState().storage.info?.storagePath).toBe(
      "D:\\Hinekora Recordings",
    );
  });

  it("defers refreshes and resumes them from authoritative availability", async () => {
    getAnalysisAvailability.mockResolvedValueOnce("deferred");
    const store = createTestStore();
    const unsubscribe = store.getState().storage.startListening();

    await store.getState().storage.refresh();

    expect(store.getState().storage.analysisAvailability).toBe("deferred");
    expect(getInfo).not.toHaveBeenCalled();
    expect(getGameLeagueUsage).not.toHaveBeenCalled();

    analysisAvailabilityListener?.("ready");

    await vi.waitFor(() => {
      expect(getInfo).toHaveBeenCalledOnce();
      expect(getGameLeagueUsage).toHaveBeenCalledOnce();
    });
    expect(store.getState().storage.analysisAvailability).toBe("ready");
    unsubscribe();
  });

  it("reconciles a refresh requested before listener hydration", async () => {
    let resolveInitialAvailability!: (
      availability: "deferred" | "ready",
    ) => void;
    getAnalysisAvailability
      .mockReturnValueOnce(
        new Promise<"deferred" | "ready">((resolvePromise) => {
          resolveInitialAvailability = resolvePromise;
        }),
      )
      .mockResolvedValueOnce("ready");
    const store = createTestStore();

    const refresh = store.getState().storage.refresh();
    store.getState().storage.startListening();
    resolveInitialAvailability("deferred");
    await refresh;

    await vi.waitFor(() => {
      expect(getAnalysisAvailability).toHaveBeenCalledTimes(2);
      expect(getInfo).toHaveBeenCalledOnce();
      expect(getGameLeagueUsage).toHaveBeenCalledOnce();
    });
    expect(store.getState().storage.analysisAvailability).toBe("ready");
  });

  it("clears successful delete state before a deferred refresh can run", async () => {
    deleteGameLeagueData.mockResolvedValueOnce({
      success: true,
      freedBytes: 10,
      deletedClipCount: 1,
      deletedRecordingCount: 1,
    });
    const store = createTestStore();
    store.getState().storage.startListening();
    await store.getState().storage.refresh();
    expect(store.getState().storage.gameLeagueUsage).toHaveLength(1);
    analysisAvailabilityListener?.("deferred");
    getInfo.mockClear();
    getGameLeagueUsage.mockClear();

    const result = await store.getState().storage.deleteGameLeagueData({
      game: "poe2",
      leagueName: "Standard",
    });

    expect(result.success).toBe(true);
    expect(store.getState().storage.deletingGameLeagueId).toBeNull();
    expect(store.getState().storage.analysisAvailability).toBe("deferred");
    expect(store.getState().storage.gameLeagueUsage).toEqual([]);
    expect(getInfo).not.toHaveBeenCalled();
    expect(getGameLeagueUsage).not.toHaveBeenCalled();

    analysisAvailabilityListener?.("ready");
    await vi.waitFor(() => {
      expect(getInfo).toHaveBeenCalledOnce();
      expect(getGameLeagueUsage).toHaveBeenCalledOnce();
    });
  });

  it("stays loading until every concurrent storage request finishes", async () => {
    let resolveInfo!: (info: StorageInfo) => void;
    let resolveUsage!: (usage: StorageGameLeagueUsage[]) => void;
    getInfo.mockReturnValueOnce(
      new Promise<StorageInfo>((resolvePromise) => {
        resolveInfo = resolvePromise;
      }),
    );
    getGameLeagueUsage.mockReturnValueOnce(
      new Promise<StorageGameLeagueUsage[]>((resolvePromise) => {
        resolveUsage = resolvePromise;
      }),
    );
    const store = createTestStore();

    const refresh = store.getState().storage.refresh();
    await vi.waitFor(() => {
      expect(store.getState().storage.isLoading).toBe(true);
    });

    resolveUsage([createGameLeagueUsage()]);
    await vi.waitFor(() => {
      expect(store.getState().storage.gameLeagueUsage).toHaveLength(1);
    });
    expect(store.getState().storage.isLoading).toBe(true);

    resolveInfo(createStorageInfo());
    await refresh;
    expect(store.getState().storage.isLoading).toBe(false);
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

  it("queues individual storage-info refreshes while analysis is deferred", async () => {
    getAnalysisAvailability.mockResolvedValueOnce("deferred");
    const store = createTestStore();
    store.getState().storage.startListening();

    await store.getState().storage.fetchStorageInfo();
    expect(getInfo).not.toHaveBeenCalled();

    analysisAvailabilityListener?.("ready");
    await vi.waitFor(() => {
      expect(getInfo).toHaveBeenCalledOnce();
      expect(getGameLeagueUsage).toHaveBeenCalledOnce();
    });
  });

  it("reports availability failures and retries before starting analysis", async () => {
    getAnalysisAvailability
      .mockRejectedValueOnce(new Error("Availability failed"))
      .mockRejectedValueOnce("Availability failed");
    const store = createTestStore();

    await store.getState().storage.refresh();
    expect(store.getState().storage.error).toBe("Availability failed");
    expect(getInfo).not.toHaveBeenCalled();

    await store.getState().storage.refresh();
    expect(store.getState().storage.error).toBe(
      "Failed to check storage availability",
    );
    expect(getInfo).not.toHaveBeenCalled();

    await store.getState().storage.refresh();
    expect(getInfo).toHaveBeenCalledOnce();
    expect(getGameLeagueUsage).toHaveBeenCalledOnce();
    expect(store.getState().storage.analysisAvailability).toBe("ready");
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
