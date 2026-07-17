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
    clipsSizeBytes: 0,
    diskFreeBytes: 50,
    lowDiskSpace: false,
    recordingsSizeBytes: 0,
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
  const onUsageChanged = vi.fn();
  const onRecordingsChanged = vi.fn();
  const revealRecording = vi.fn();
  const deleteRecording = vi.fn();
  const deleteManyRecordings = vi.fn();
  let recordingsChangedListener: ((ids: string[]) => void) | null;
  let usageChangedListener: ((usage: RecordingStorageUsage) => void) | null;

  beforeEach(() => {
    vi.clearAllMocks();
    recordingsChangedListener = null;
    usageChangedListener = null;
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
    onUsageChanged.mockImplementation(
      (listener: (usage: RecordingStorageUsage) => void) => {
        usageChangedListener = listener;

        return vi.fn();
      },
    );
    onRecordingsChanged.mockImplementation(
      (listener: (ids: string[]) => void) => {
        recordingsChangedListener = listener;

        return vi.fn();
      },
    );

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        recordingStorage: {
          getUsage,
          listRecordingLibrary,
          onUsageChanged,
          onRecordingsChanged,
          openRecording,
          revealRecording,
          deleteRecording,
          deleteManyRecordings,
        },
      },
    });
  });

  it("updates usage from storage events without refreshing", () => {
    const store = createTestStore();
    const stopListening = store.getState().recordingStorage.startListening();
    const usage = { ...createUsage(), recordingsSizeBytes: 25 };

    usageChangedListener?.(usage);

    expect(store.getState().recordingStorage.usage).toEqual(usage);
    expect(getUsage).not.toHaveBeenCalled();
    expect(onUsageChanged).toHaveBeenCalledTimes(1);
    stopListening();
  });

  it("refreshes a loaded recording library after retention changes", async () => {
    const store = createTestStore();
    const stopListening = store.getState().recordingStorage.startListening();

    recordingsChangedListener?.(["recording-1"]);
    expect(listRecordingLibrary).not.toHaveBeenCalled();

    await store.getState().recordingStorage.refreshRecordings({ game: "poe2" });
    listRecordingLibrary.mockClear();
    recordingsChangedListener?.(["recording-1"]);

    await vi.waitFor(() => {
      expect(listRecordingLibrary).toHaveBeenCalledWith({ game: "poe2" });
    });
    stopListening();
  });

  it("deduplicates concurrent usage refreshes", async () => {
    let resolveUsage: ((usage: RecordingStorageUsage) => void) | undefined;
    getUsage.mockReturnValueOnce(
      new Promise<RecordingStorageUsage>((resolve) => {
        resolveUsage = resolve;
      }),
    );
    const store = createTestStore();

    const firstRefresh = store.getState().recordingStorage.refreshUsage();
    const secondRefresh = store.getState().recordingStorage.refreshUsage();

    expect(getUsage).toHaveBeenCalledTimes(1);
    resolveUsage?.(createUsage());
    await Promise.all([firstRefresh, secondRefresh]);
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

    expect(getUsage).not.toHaveBeenCalled();
    expect(listRecordingLibrary).toHaveBeenCalledTimes(1);
    expect(store.getState().recordingStorage.selectedRecordingIds).toEqual({});
    expect(store.getState().recordingStorage.error).toBe("unlink failed");
  });

  it("hydrates usage and recordings, opens and reveals recordings", async () => {
    const recording = createRecording();
    listRecordingLibrary.mockResolvedValue(createLibraryPage([recording]));
    const store = createTestStore();

    await Promise.all([
      store.getState().recordingStorage.refreshUsage(),
      store.getState().recordingStorage.refreshRecordings(),
    ]);
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

  it("does not let an older library response replace a newer query", async () => {
    let resolveFirst: ((page: RunRecordingLibraryPage) => void) | undefined;
    let resolveSecond: ((page: RunRecordingLibraryPage) => void) | undefined;
    listRecordingLibrary
      .mockReturnValueOnce(
        new Promise<RunRecordingLibraryPage>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<RunRecordingLibraryPage>((resolve) => {
          resolveSecond = resolve;
        }),
      );
    const store = createTestStore();
    const firstRefresh = store
      .getState()
      .recordingStorage.refreshRecordings({ game: "poe1" });
    const secondRefresh = store
      .getState()
      .recordingStorage.refreshRecordings({ game: "poe2" });
    const newerRecording = createRecording({ id: "newer" });

    resolveSecond?.(createLibraryPage([newerRecording]));
    await secondRefresh;
    resolveFirst?.(createLibraryPage([createRecording({ id: "older" })]));
    await firstRefresh;

    expect(store.getState().recordingStorage.recordings).toEqual([
      newerRecording,
    ]);
    expect(store.getState().recordingStorage.recordingsQuery).toEqual({
      game: "poe2",
    });
  });

  it("stores refresh fallback errors", async () => {
    const store = createTestStore();
    getUsage.mockRejectedValueOnce("usage failed");
    listRecordingLibrary.mockRejectedValueOnce("library failed");

    await store.getState().recordingStorage.refreshUsage();
    expect(store.getState().recordingStorage.usageError).toBe("Storage failed");

    await store.getState().recordingStorage.refreshRecordings();
    expect(store.getState().recordingStorage.error).toBe("Storage failed");

    getUsage.mockRejectedValueOnce(new Error("usage failed"));
    await store.getState().recordingStorage.refreshUsage();
    expect(store.getState().recordingStorage.usageError).toBe("usage failed");

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
