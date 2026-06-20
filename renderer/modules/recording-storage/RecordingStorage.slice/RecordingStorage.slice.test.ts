import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  RecordingStorageUsage,
  RunRecordingItem,
  RunRecordingLibraryPage,
} from "~/main/modules/recording-storage/RecordingStorage.dto";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createRecordingStorageSlice } from "./RecordingStorage.slice";

function createUsage(): RecordingStorageUsage {
  return {
    storageDirectory: "C:\\Videos\\Hinekora Recordings",
    databasePath: "C:\\Data\\hinekora.sqlite",
    clipsSizeBytes: 0,
    recordingsSizeBytes: 0,
    databaseSizeBytes: 0,
    totalTrackedSizeBytes: 0,
    diskTotalBytes: 100,
    diskFreeBytes: 50,
    diskWarningThresholdBytes: 10,
    lowDiskSpace: false,
    calculatedAt: "2026-06-18T00:00:00.000Z",
  };
}

function createRecording(overrides: Partial<RunRecordingItem> = {}) {
  const now = "2026-06-18T00:00:00.000Z";

  return {
    id: "recording-1",
    path: "C:\\Videos\\Hinekora Recordings\\run.mp4",
    sourceGame: "poe2",
    sourceLeague: "Standard",
    startedAt: now,
    stoppedAt: now,
    createdAt: now,
    updatedAt: now,
    fileName: "run.mp4",
    durationSeconds: 60,
    sizeBytes: 10,
    exists: true,
    ...overrides,
  } satisfies RunRecordingItem;
}

function createLibraryPage(
  items: RunRecordingItem[] = [],
): RunRecordingLibraryPage {
  return {
    items,
    availableLeagues: ["Standard"],
    pageIndex: 0,
    pageSize: 20,
    pageCount: 1,
    totalCount: items.length,
    sortBy: "createdAt",
    sortDirection: "desc",
  };
}

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createRecordingStorageSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("RecordingStorage slice", () => {
  const getUsage = vi.fn();
  const listRecordingLibrary = vi.fn();
  const openRecording = vi.fn();
  const revealRecording = vi.fn();
  const deleteRecording = vi.fn();
  const deleteManyRecordings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getUsage.mockResolvedValue(createUsage());
    listRecordingLibrary.mockResolvedValue(createLibraryPage());
    openRecording.mockResolvedValue({ ok: true, error: null });
    revealRecording.mockResolvedValue({ ok: true, error: null });
    deleteRecording.mockResolvedValue({ ok: true, error: null });
    deleteManyRecordings.mockResolvedValue({
      ok: true,
      error: null,
      deletedPaths: [],
      failed: [],
    });

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        recordingStorage: {
          getUsage,
          listRecordingLibrary,
          openRecording,
          revealRecording,
          deleteRecording,
          deleteManyRecordings,
        },
      },
    });
  });

  it("refreshes after single recording cleanup warnings and keeps the warning", async () => {
    const recording = createRecording();
    deleteRecording.mockResolvedValue({
      ok: true,
      error: null,
      cleanupError: "unlink failed",
    });
    const store = createTestStore();
    store.setState((state) => ({
      recordingStorage: {
        ...state.recordingStorage,
        recordings: [recording],
        selectedRecordingIds: { [recording.id]: true },
      },
    }));

    await store.getState().recordingStorage.deleteRecording(recording.path);

    expect(getUsage).toHaveBeenCalledTimes(1);
    expect(listRecordingLibrary).toHaveBeenCalledTimes(1);
    expect(store.getState().recordingStorage.selectedRecordingIds).toEqual({});
    expect(store.getState().recordingStorage.error).toBe("unlink failed");
  });

  it("hydrates usage and recordings, opens and reveals recordings", async () => {
    const recording = createRecording();
    listRecordingLibrary.mockResolvedValue(createLibraryPage([recording]));
    const store = createTestStore();

    await store.getState().recordingStorage.hydrate();
    await store.getState().recordingStorage.openRecording(recording.path);
    await store.getState().recordingStorage.revealRecording(recording.path);

    expect(store.getState().recordingStorage).toMatchObject({
      error: null,
      isLoading: false,
      recordingLeagues: ["Standard"],
      recordings: [recording],
      usage: createUsage(),
    });
    expect(openRecording).toHaveBeenCalledWith(recording.path);
    expect(revealRecording).toHaveBeenCalledWith(recording.path);
  });

  it("uses previous recording query when refreshing without an input", async () => {
    const store = createTestStore();
    await store
      .getState()
      .recordingStorage.refreshRecordings({ game: "poe2", league: "Standard" });

    listRecordingLibrary.mockClear();
    await store.getState().recordingStorage.refreshRecordings();

    expect(listRecordingLibrary).toHaveBeenCalledWith({
      game: "poe2",
      league: "Standard",
    });
  });

  it("stores refresh fallback errors", async () => {
    const store = createTestStore();
    getUsage.mockRejectedValueOnce("usage failed");
    listRecordingLibrary.mockRejectedValueOnce("library failed");

    await store.getState().recordingStorage.refreshUsage();
    expect(store.getState().recordingStorage.error).toBe("Storage failed");

    await store.getState().recordingStorage.refreshRecordings();
    expect(store.getState().recordingStorage.error).toBe("Storage failed");

    getUsage.mockRejectedValueOnce(new Error("usage failed"));
    await store.getState().recordingStorage.refreshUsage();
    expect(store.getState().recordingStorage.error).toBe("usage failed");

    listRecordingLibrary.mockRejectedValueOnce(new Error("library failed"));
    await store.getState().recordingStorage.refreshRecordings();
    expect(store.getState().recordingStorage.error).toBe("library failed");
  });

  it("surfaces single recording delete failures and default cleanup state", async () => {
    deleteRecording
      .mockResolvedValueOnce({
        ok: false,
      })
      .mockResolvedValueOnce({
        ok: true,
      });
    const store = createTestStore();

    await store
      .getState()
      .recordingStorage.deleteRecording("C:\\missing\\recording.mp4");
    expect(store.getState().recordingStorage.error).toBe(
      "Recording delete failed",
    );

    await store
      .getState()
      .recordingStorage.deleteRecording("C:\\missing\\recording.mp4");
    expect(store.getState().recordingStorage.error).toBeNull();
  });

  it("surfaces batch recording cleanup warnings after clearing selection", async () => {
    const recording = createRecording();
    deleteManyRecordings.mockResolvedValue({
      ok: true,
      error: null,
      deletedPaths: [recording.path],
      failed: [],
      cleanupErrors: [{ path: recording.path, error: "unlink failed" }],
    });
    const store = createTestStore();
    store.setState((state) => ({
      recordingStorage: {
        ...state.recordingStorage,
        recordings: [recording],
        selectedRecordingIds: { [recording.id]: true },
      },
    }));

    await store.getState().recordingStorage.deleteSelectedRecordings();

    expect(deleteManyRecordings).toHaveBeenCalledWith([recording.path]);
    expect(store.getState().recordingStorage.selectedRecordingIds).toEqual({});
    expect(store.getState().recordingStorage.error).toBe("unlink failed");
  });

  it("skips empty batch deletes and reports batch failures", async () => {
    const recording = createRecording();
    const store = createTestStore();

    await store.getState().recordingStorage.deleteSelectedRecordings();
    expect(deleteManyRecordings).not.toHaveBeenCalled();

    deleteManyRecordings.mockResolvedValueOnce({
      ok: false,
      error: "Delete failed",
      deletedPaths: [],
      failed: [{ path: recording.path, error: "Delete failed" }],
    });
    store.setState((state) => ({
      recordingStorage: {
        ...state.recordingStorage,
        recordings: [recording],
        selectedRecordingIds: { [recording.id]: true },
      },
    }));

    await store.getState().recordingStorage.deleteSelectedRecordings();

    expect(store.getState().recordingStorage.selectedRecordingIds).toEqual({});
    expect(store.getState().recordingStorage.error).toBe("Delete failed");

    deleteManyRecordings.mockResolvedValueOnce({
      ok: true,
      deletedPaths: [recording.path],
      failed: [],
    });
    store.setState((state) => ({
      recordingStorage: {
        ...state.recordingStorage,
        recordings: [recording],
        selectedRecordingIds: { [recording.id]: true },
      },
    }));
    await store.getState().recordingStorage.deleteSelectedRecordings();
    expect(store.getState().recordingStorage.error).toBeNull();
  });

  it("sets and clears selected recordings", () => {
    const store = createTestStore();

    store.getState().recordingStorage.setSelectedRecordingIds({
      "recording-1": true,
    });
    store.getState().recordingStorage.clearSelectedRecordings();

    expect(store.getState().recordingStorage.selectedRecordingIds).toEqual({});
  });
});
