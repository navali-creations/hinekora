import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import * as AppLog from "~/main/utils/app-log";
import * as FileClipboard from "~/main/utils/file-clipboard";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";
import {
  markStagedFileDeletionsCommitted,
  resetStagedFileDeletionStateForTests,
  stageFilesForDeletion,
} from "~/main/utils/staged-file-deletion";
import * as StorageFiles from "~/main/utils/storage-files";

import { createDefaultSettings } from "~/types";
import { BookmarksService } from "../../bookmarks";
import { DatabaseService } from "../../database";
import { WindowName } from "../../main-window/MainWindow.types";
import { ReplayClipsRepository } from "../../replay-clips/ReplayClips.repository";
import { SettingsStoreService } from "../../settings-store";
import { StorageFileDeletionService } from "../../storage/StorageFileDeletion.service";
import { RecordingStorageChannel } from "../RecordingStorage.channels";
import { RecordingStorageRepository } from "../RecordingStorage.repository";
import { RecordingStorageService } from "../RecordingStorage.service";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn<() => Electron.BrowserWindow[]>(() => []),
  getPath: vi.fn(),
  openPath: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
  app: {
    getPath: electronMocks.getPath,
  },
  shell: {
    openPath: electronMocks.openPath,
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

let database: DatabaseService;
let root: string;
let replayClipsRepository: ReplayClipsRepository;
let repository: RecordingStorageRepository;
let service: RecordingStorageService;
let openPath: Mock<(path: string) => Promise<string>>;
let showItemInFolder: Mock<(path: string) => void>;

function listServiceRecordings(target: RecordingStorageService) {
  target.listRecordingLibrary({ pageSize: 1 });
  return listRepositoryRecordings(repository);
}

function listRepositoryRecordings(target: RecordingStorageRepository) {
  return target.listLibraryPage({
    pageIndex: 0,
    pageSize: 100,
    sortBy: "createdAt",
    sortDirection: "desc",
  }).items;
}

beforeEach(() => {
  resetStagedFileDeletionStateForTests();
  root = mkdtempSync(join(tmpdir(), "hinekora-recording-storage-"));
  database = DatabaseService.getInstance(join(root, "hinekora.sqlite"));
  replayClipsRepository = new ReplayClipsRepository(database);
  repository = new RecordingStorageRepository(database);
  openPath = vi.fn<(path: string) => Promise<string>>().mockResolvedValue("");
  showItemInFolder = vi.fn<(path: string) => void>();
  electronMocks.getAllWindows.mockReturnValue([]);
  electronMocks.getPath.mockReturnValue(join(root, "videos"));
  electronMocks.openPath.mockImplementation(openPath);
  electronMocks.showItemInFolder.mockImplementation(showItemInFolder);
  vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
    get: () => ({
      ...createDefaultSettings(),
      recordingStoragePath: root,
      recordingMaxStorageGb: 1,
    }),
  } as unknown as SettingsStoreService);
  service = new RecordingStorageService();
});

afterEach(() => {
  vi.useRealTimers();
  electronMocks.getPath.mockReset();
  electronMocks.openPath.mockReset();
  electronMocks.showItemInFolder.mockReset();
  vi.restoreAllMocks();
  resetStagedFileDeletionStateForTests();
  clearIpcWindowRolesForTests();
  DatabaseService.resetForTests();
  rmSync(root, { force: true, recursive: true });
});

describe("RecordingStorageService", () => {
  it("creates and reuses the singleton instance", () => {
    RecordingStorageService.resetForTests();

    const first = RecordingStorageService.getInstance();
    const second = RecordingStorageService.getInstance();

    expect(first).toBe(second);
    RecordingStorageService.resetForTests();
  });

  it("separates replay clip size from run recording size", async () => {
    const runPath = join(root, "2026-06-12_10-30-00.mp4");
    const clipPath = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    writeFileSync(runPath, "run");
    writeFileSync(clipPath, "clip");
    replayClipsRepository.upsert(
      createReplayClip({ processedClipPath: clipPath, sizeBytes: 4 }),
    );
    service.refreshLibrary();

    await expect(service.getUsage()).resolves.toMatchObject({
      clipsSizeBytes: 4,
      recordingsSizeBytes: 3,
    });
  });

  it("does not reconcile recording files during a usage read", async () => {
    const runPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(runPath, "run");

    expect((await service.getUsage()).recordingsSizeBytes).toBe(0);

    service.refreshLibrary();

    expect((await service.getUsage()).recordingsSizeBytes).toBe(3);
  });

  it("shares an in-flight usage scan for concurrent readers", async () => {
    const first = service.getUsage();
    const second = service.getUsage();

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ clipsSizeBytes: 0, recordingsSizeBytes: 0 }),
      expect.objectContaining({ clipsSizeBytes: 0, recordingsSizeBytes: 0 }),
    ]);
  });

  it("restores pre-commit staged files regardless of storage metadata", async () => {
    vi.useFakeTimers();
    const recordingPath = join(root, "2026-06-12_10-30-00.mp4");
    const replayPath = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    const unindexedPath = join(root, "2026-06-12_10-31-00.mp4");
    writeFileSync(recordingPath, "recording");
    writeFileSync(replayPath, "replay");
    writeFileSync(unindexedPath, "unindexed");
    repository.upsertRunRecording({
      path: recordingPath,
      sourceGame: "poe1",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:00:00.000Z",
      stoppedAt: "2026-06-12T10:01:00.000Z",
      sizeBytes: 9,
    });
    replayClipsRepository.upsert(
      createReplayClip({ processedClipPath: replayPath, sizeBytes: 6 }),
    );
    await stageFilesForDeletion(root, [
      { path: recordingPath, size: 9 },
      { path: replayPath, size: 6 },
      { path: unindexedPath, size: 9 },
    ]);
    resetStagedFileDeletionStateForTests();

    const usage = service.getUsage();
    await vi.runAllTimersAsync();
    await usage;
    vi.useRealTimers();
    await vi.waitFor(() => expect(existsSync(recordingPath)).toBe(true));

    expect(existsSync(recordingPath)).toBe(true);
    expect(existsSync(replayPath)).toBe(true);
    expect(existsSync(unindexedPath)).toBe(true);
  });

  it("finalizes post-commit staged files without storage metadata", async () => {
    vi.useFakeTimers();
    const recordingPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(recordingPath, "recording");
    const staged = await stageFilesForDeletion(root, [
      { path: recordingPath, size: 9 },
    ]);
    await markStagedFileDeletionsCommitted(staged);
    resetStagedFileDeletionStateForTests();

    const usage = service.getUsage();
    await vi.runAllTimersAsync();
    await usage;
    vi.useRealTimers();
    await vi.waitFor(() => expect(existsSync(recordingPath)).toBe(false));

    expect(existsSync(recordingPath)).toBe(false);
  });

  it("continues bounded staged-deletion recovery until the root is drained", async () => {
    vi.useFakeTimers();
    const recover = vi
      .spyOn(StorageFileDeletionService.prototype, "recover")
      .mockResolvedValueOnce({
        failed: [],
        finalizedPaths: [],
        hasMore: true,
        restoredPaths: [],
      })
      .mockResolvedValueOnce({
        failed: [],
        finalizedPaths: [],
        hasMore: false,
        restoredPaths: [],
      });

    const usage = service.getUsage();
    await vi.runAllTimersAsync();
    await usage;
    await vi.runAllTimersAsync();

    expect(recover).toHaveBeenCalledTimes(2);
  });

  it("clears deferred recovery timers, guards empty work, and reports recovery failures", async () => {
    vi.useFakeTimers();
    const recover = vi
      .spyOn(StorageFileDeletionService.prototype, "recover")
      .mockRejectedValue(new Error("recovery failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const internals = service as unknown as {
      pendingStagedDeletionRecoveryRoots: Set<string>;
      runNextStagedDeletionRecovery(): void;
      scheduleStagedDeletionRecovery(storageRoot: string): void;
      stagedDeletionRecoveryRequest: {
        promise: Promise<unknown>;
        root: string;
      } | null;
    };

    internals.scheduleStagedDeletionRecovery(root);
    RecordingStorageService.setPerformanceSensitiveActivityActive(true);
    (
      service as unknown as {
        handlePerformanceSensitiveActivity(active: boolean): void;
      }
    ).handlePerformanceSensitiveActivity(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(recover).not.toHaveBeenCalled();
    internals.runNextStagedDeletionRecovery();
    expect(recover).not.toHaveBeenCalled();

    RecordingStorageService.setPerformanceSensitiveActivityActive(false);
    (
      service as unknown as {
        handlePerformanceSensitiveActivity(active: boolean): void;
      }
    ).handlePerformanceSensitiveActivity(false);
    await vi.runAllTimersAsync();
    expect(recover).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Storage deletion recovery failed"),
      expect.objectContaining({ error: "recovery failed" }),
    );

    internals.pendingStagedDeletionRecoveryRoots.clear();
    internals.runNextStagedDeletionRecovery();
    const heldRequest = { promise: Promise.resolve(), root };
    internals.stagedDeletionRecoveryRequest = heldRequest;
    internals.pendingStagedDeletionRecoveryRoots.add(root);
    internals.runNextStagedDeletionRecovery();
    expect(internals.stagedDeletionRecoveryRequest).toBe(heldRequest);
    internals.stagedDeletionRecoveryRequest = null;
  });

  it("paginates inventory repositories and creates usage from the result", async () => {
    const clips = Array.from({ length: 500 }, (_, index) => ({
      createdAt: "2026-07-17T00:00:00.000Z",
      id: `clip-${index}`,
      originalObsPath: null,
      processedClipPath: null,
      sizeBytes: 0,
    }));
    const recordings = Array.from({ length: 500 }, (_, index) => ({
      mtimeMs: index,
      path: join(root, `recording-${index}.mkv`),
      size: 1,
    }));
    vi.spyOn(ReplayClipsRepository.prototype, "listStorageEntriesPage")
      .mockReturnValueOnce(clips)
      .mockReturnValueOnce([]);
    vi.spyOn(RecordingStorageRepository.prototype, "listStorageEntriesPage")
      .mockReturnValueOnce(recordings)
      .mockReturnValueOnce([]);
    const internals = service as unknown as {
      createStorageInventory(storageRoot: string): Promise<{
        clipGroups: unknown[];
        clipsSizeBytes: number;
        recordingEntries: unknown[];
        recordingsSizeBytes: number;
        usageBytes: number;
      }>;
      createUsageFromInventory(
        inventory: {
          clipsSizeBytes: number;
          recordingsSizeBytes: number;
        },
        storageRoot: string,
      ): unknown;
    };

    const inventory = await internals.createStorageInventory(root);
    expect(inventory.recordingEntries).toHaveLength(500);
    expect(internals.createUsageFromInventory(inventory, root)).toEqual(
      expect.objectContaining({
        clipsSizeBytes: 0,
        recordingsSizeBytes: 500,
      }),
    );
  });

  it("retains recovery work for both roots when storage settings change", async () => {
    vi.useFakeTimers();
    const nextRoot = mkdtempSync(
      join(tmpdir(), "hinekora-recording-storage-next-"),
    );
    let settings = {
      ...createDefaultSettings(),
      recordingStoragePath: root,
      recordingMaxStorageGb: 1,
    };
    let handleSettingsChange:
      | ((next: ReturnType<SettingsStoreService["get"]>) => void)
      | null = null;
    vi.mocked(SettingsStoreService.getInstance).mockReturnValue({
      get: () => settings,
      onDidChange: (
        listener: (next: ReturnType<SettingsStoreService["get"]>) => void,
      ) => {
        handleSettingsChange = listener;
        return vi.fn();
      },
    } as unknown as SettingsStoreService);
    service = new RecordingStorageService();
    vi.spyOn(service, "cleanup").mockResolvedValue({
      deletedCount: 0,
      freedBytes: 0,
      limitBytes: 1024 ** 3,
      usageBytes: 0,
    });
    const recover = vi
      .spyOn(StorageFileDeletionService.prototype, "recover")
      .mockResolvedValue({
        failed: [],
        finalizedPaths: [],
        hasMore: false,
        restoredPaths: [],
      });

    settings = { ...settings, recordingStoragePath: nextRoot };
    expect(handleSettingsChange).not.toBeNull();
    handleSettingsChange!(settings);
    await vi.runAllTimersAsync();

    expect(recover.mock.calls.map(([storageRoot]) => storageRoot)).toEqual([
      resolve(root),
      resolve(nextRoot),
    ]);
    rmSync(nextRoot, { force: true, recursive: true });
  });

  it("schedules cleanup when the limit is reduced without changing roots", () => {
    let handleSettingsChange:
      | ((next: ReturnType<SettingsStoreService["get"]>) => void)
      | null = null;
    vi.mocked(SettingsStoreService.getInstance).mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 1,
      }),
      onDidChange: (
        listener: (next: ReturnType<SettingsStoreService["get"]>) => void,
      ) => {
        handleSettingsChange = listener;
        return vi.fn();
      },
    } as unknown as SettingsStoreService);
    service = new RecordingStorageService();
    const scheduleCleanup = vi.spyOn(service, "scheduleCleanup");

    handleSettingsChange!({
      ...createDefaultSettings(),
      recordingStoragePath: root,
      recordingMaxStorageGb: 0.5,
    });
    expect(scheduleCleanup).toHaveBeenCalledWith({ force: true });

    scheduleCleanup.mockClear();
    handleSettingsChange!({
      ...createDefaultSettings(),
      recordingStoragePath: root,
      recordingMaxStorageGb: 0.5,
    });
    expect(scheduleCleanup).not.toHaveBeenCalled();
  });

  it("coalesces scheduled cleanup requests and their protected paths", async () => {
    vi.useFakeTimers();
    const cleanup = vi.spyOn(service, "cleanup").mockResolvedValue({
      deletedCount: 0,
      freedBytes: 0,
      limitBytes: 1024 ** 3,
      usageBytes: 0,
    });

    service.scheduleCleanup({
      force: true,
      protectedDirectories: [join(root, "session-a")],
      protectedPaths: [join(root, "clip-a.mp4")],
    });
    service.scheduleCleanup({
      protectedDirectories: [join(root, "session-b")],
      protectedPaths: [join(root, "clip-b.mp4")],
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledWith({
      protectedDirectories: [join(root, "session-a"), join(root, "session-b")],
      protectedPaths: [join(root, "clip-a.mp4"), join(root, "clip-b.mp4")],
    });
  });

  it("reports rejected scheduled cleanups and releases rejected queue entries", async () => {
    vi.useFakeTimers();
    const error = new Error("scheduled cleanup failed");
    vi.spyOn(service, "cleanup").mockRejectedValueOnce(error);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    service.scheduleCleanup({ force: true });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Scheduled storage cleanup failed"),
      expect.objectContaining({ error: "scheduled cleanup failed" }),
    );

    const internals = service as unknown as {
      runCleanup: (options: object) => Promise<unknown>;
    };
    vi.spyOn(internals, "runCleanup")
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({
        deletedCount: 0,
        freedBytes: 0,
        limitBytes: 0,
        usageBytes: 0,
      });
    const rejected = service.cleanup({ protectedPaths: ["rejected"] });
    await expect(rejected).rejects.toBe(error);
    await Promise.resolve();
    const retried = service.cleanup({ protectedPaths: ["rejected"] });
    expect(retried).not.toBe(rejected);
    await expect(retried).resolves.toMatchObject({ deletedCount: 0 });
  });

  it("skips a scheduled scan when cached usage plus growth is under the limit", async () => {
    await service.getUsage();
    vi.useFakeTimers();
    const cleanup = vi.spyOn(service, "cleanup");

    service.scheduleCleanup({ estimatedAddedBytes: 1024 });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(cleanup).not.toHaveBeenCalled();
  });

  it("does not double-count growth already applied to the usage cache", async () => {
    await service.getUsage();
    service.noteUsageDelta("recordings", 1024 ** 3 - 5);
    vi.useFakeTimers();
    const cleanup = vi.spyOn(service, "cleanup").mockResolvedValue({
      deletedCount: 0,
      freedBytes: 0,
      limitBytes: 1024 ** 3,
      usageBytes: 1024 ** 3 - 5,
    });

    service.scheduleCleanup({
      estimatedAddedBytes: 10,
      usageAlreadyAccounted: true,
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(cleanup).not.toHaveBeenCalled();

    service.scheduleCleanup({ usageAlreadyAccounted: true });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("defers library scans while game or capture activity is active", () => {
    const recordingPath = join(root, "2026-07-17 10-00-00.mp4");
    writeFileSync(recordingPath, "recording");

    RecordingStorageService.setPerformanceSensitiveActivityActive(true);
    service.refreshLibrary({ publishUsage: false });
    expect(repository.getItemByPath(recordingPath)).toBeNull();

    RecordingStorageService.setPerformanceSensitiveActivityActive(false);
    service.refreshLibrary({ publishUsage: false });
    expect(repository.getItemByPath(recordingPath)).not.toBeNull();
  });

  it("publishes refreshed usage only to the main window", async () => {
    const send = vi.fn();
    const webContents = { id: 901, send };
    registerIpcWindowRole(webContents, WindowName.Main);
    electronMocks.getAllWindows.mockReturnValue([
      {
        isDestroyed: () => false,
        webContents,
      } as unknown as Electron.BrowserWindow,
    ]);
    replayClipsRepository.upsert(
      createReplayClip({
        processedClipPath: join(root, "clip.mp4"),
        sizeBytes: 4,
      }),
    );

    service.publishUsageChanged();

    await vi.waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        RecordingStorageChannel.UsageChanged,
        expect.objectContaining({ clipsSizeBytes: 4 }),
      );
    });

    const knownUsage = {
      clipsSizeBytes: 2,
      diskFreeBytes: 3,
      lowDiskSpace: false,
      recordingsSizeBytes: 4,
    };
    service.publishUsageChanged(knownUsage, root);
    service.publishRecordingsChanged(["recording-1"]);
    await vi.waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        RecordingStorageChannel.UsageChanged,
        knownUsage,
      );
      expect(send).toHaveBeenCalledWith(
        RecordingStorageChannel.RecordingsChanged,
        ["recording-1"],
      );
    });
  });

  it("refreshes mismatched usage snapshots and reports refresh failures", async () => {
    const send = vi.fn();
    const webContents = { id: 902, send };
    registerIpcWindowRole(webContents, WindowName.Main);
    electronMocks.getAllWindows.mockReturnValue([
      {
        isDestroyed: () => false,
        webContents,
      } as unknown as Electron.BrowserWindow,
    ]);
    const usage = {
      clipsSizeBytes: 0,
      diskFreeBytes: 0,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    };
    const getUsage = vi
      .spyOn(service, "getUsage")
      .mockResolvedValueOnce(usage)
      .mockRejectedValueOnce(new Error("refresh failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    service.publishUsageChanged(usage, join(root, "old-root"));
    await vi.waitFor(() => expect(getUsage).toHaveBeenCalledTimes(1));
    service.publishUsageChanged();
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Storage usage refresh failed"),
        expect.objectContaining({ error: "refresh failed" }),
      );
    });
  });

  it("skips windows destroyed between role lookup and event delivery", async () => {
    const send = vi.fn();
    const isDestroyed = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const webContents = { id: 903, send };
    registerIpcWindowRole(webContents, WindowName.Main);
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed, webContents } as unknown as Electron.BrowserWindow,
    ]);
    const usage = {
      clipsSizeBytes: 0,
      diskFreeBytes: 0,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    };

    service.publishUsageChanged(usage, root);
    await Promise.resolve();
    expect(send).not.toHaveBeenCalled();

    isDestroyed
      .mockReset()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    service.publishRecordingsChanged(["recording-1"]);
    expect(send).not.toHaveBeenCalled();
  });

  it("applies known usage deltas without rescanning storage", async () => {
    await service.getUsage();
    const calculateUsage = vi.spyOn(
      await import("../RecordingStorage.usage"),
      "calculateRecordingStorageUsage",
    );
    const calculateDiskUsage = vi
      .spyOn(StorageFiles, "calculateDiskUsage")
      .mockReturnValue({ freeBytes: 321, totalBytes: 1_000 });

    service.noteUsageDelta("clips", 12);
    service.noteUsageDelta("recordings", 7);

    await expect(service.getUsage()).resolves.toMatchObject({
      clipsSizeBytes: 12,
      diskFreeBytes: 321,
      recordingsSizeBytes: 7,
    });
    expect(calculateUsage).not.toHaveBeenCalled();
    expect(calculateDiskUsage).toHaveBeenCalledTimes(2);
  });

  it("distinguishes an unavailable disk probe from zero free space", async () => {
    const calculateDiskUsage = vi
      .spyOn(StorageFiles, "calculateDiskUsage")
      .mockReturnValueOnce({ freeBytes: 0, totalBytes: 0 })
      .mockReturnValueOnce({ freeBytes: 0, totalBytes: 1_000 });

    await expect(service.getUsage()).resolves.toMatchObject({
      diskFreeBytes: null,
      lowDiskSpace: false,
    });

    service.publishUsageChanged();
    await expect(service.getUsage()).resolves.toMatchObject({
      diskFreeBytes: 0,
      lowDiskSpace: true,
    });
    expect(calculateDiskUsage).toHaveBeenCalledTimes(2);
  });

  it("keeps shared clip paths and recording ownership counted once", async () => {
    const sharedClipPath = join(root, "shared-clip.mp4");
    const firstClip = createReplayClip({
      id: "shared-clip-1",
      processedClipPath: sharedClipPath,
      sizeBytes: 5,
    });
    replayClipsRepository.upsert(firstClip);
    await expect(service.getUsage()).resolves.toMatchObject({
      clipsSizeBytes: 5,
      recordingsSizeBytes: 0,
    });

    const secondClip = createReplayClip({
      id: "shared-clip-2",
      processedClipPath: sharedClipPath,
      sizeBytes: 5,
    });
    replayClipsRepository.upsert(secondClip);
    service.noteReplayClipUsageChange(null, secondClip);
    await expect(service.getUsage()).resolves.toMatchObject({
      clipsSizeBytes: 5,
      recordingsSizeBytes: 0,
    });

    const largerFirstClip = { ...firstClip, sizeBytes: 7 };
    replayClipsRepository.upsert(largerFirstClip);
    service.noteReplayClipUsageChange(firstClip, largerFirstClip);
    await expect(service.getUsage()).resolves.toMatchObject({
      clipsSizeBytes: 7,
      recordingsSizeBytes: 0,
    });

    const recordingPath = join(root, "shared-recording.mp4");
    repository.upsertRunRecording({
      id: "shared-recording",
      path: recordingPath,
      sourceGame: "poe1",
      sourceLeague: "Standard",
      startedAt: "2026-07-17T00:00:00.000Z",
      stoppedAt: "2026-07-17T00:01:00.000Z",
      mtimeMs: 1,
      sizeBytes: 11,
    });
    service.publishUsageChanged();
    await expect(service.getUsage()).resolves.toMatchObject({
      clipsSizeBytes: 7,
      recordingsSizeBytes: 11,
    });

    const recordingClip = createReplayClip({
      id: "recording-backed-clip",
      processedClipPath: recordingPath,
      sizeBytes: 11,
    });
    replayClipsRepository.upsert(recordingClip);
    service.noteReplayClipUsageChange(null, recordingClip);
    await expect(service.getUsage()).resolves.toMatchObject({
      clipsSizeBytes: 18,
      recordingsSizeBytes: 0,
    });
  });

  it("does not count a registered recording already owned by a clip", () => {
    const sharedPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(sharedPath, "shared");
    replayClipsRepository.upsert(
      createReplayClip({ processedClipPath: sharedPath, sizeBytes: 6 }),
    );
    const noteUsageDelta = vi.spyOn(service, "noteUsageDelta");

    service.registerRunRecording({
      path: sharedPath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-07-17T00:00:00.000Z",
      stoppedAt: "2026-07-17T00:01:00.000Z",
    });

    expect(noteUsageDelta).not.toHaveBeenCalled();
  });

  it("restarts an in-flight usage scan after a cacheless usage change", async () => {
    const usageModule = await import("../RecordingStorage.usage");
    let resolveFirstCalculation!: (value: {
      clipsSizeBytes: number;
      recordingsSizeBytes: number;
      usageBytes: number;
    }) => void;
    const firstCalculation = new Promise<{
      clipsSizeBytes: number;
      recordingsSizeBytes: number;
      usageBytes: number;
    }>((resolvePromise) => {
      resolveFirstCalculation = resolvePromise;
    });
    const calculateUsage = vi
      .spyOn(usageModule, "calculateRecordingStorageUsage")
      .mockImplementationOnce(() => firstCalculation);

    const usageRequest = service.getUsage();
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
    replayClipsRepository.upsert(
      createReplayClip({
        id: "created-during-scan",
        processedClipPath: join(root, "created-during-scan.mp4"),
        sizeBytes: 5,
      }),
    );
    service.noteUsageDelta("clips", 5);
    resolveFirstCalculation({
      clipsSizeBytes: 0,
      recordingsSizeBytes: 0,
      usageBytes: 0,
    });

    await expect(usageRequest).resolves.toMatchObject({ clipsSizeBytes: 5 });
    expect(calculateUsage).toHaveBeenCalledTimes(2);
  });

  it("updates cached usage when a run recording is finalized", async () => {
    await service.getUsage();
    const recordingPath = join(root, "finalized-recording.mp4");
    writeFileSync(recordingPath, "recording");

    service.registerRunRecording({
      path: recordingPath,
      sourceGame: "poe1",
      sourceLeague: "Standard",
      startedAt: "2026-07-17T10:00:00.000Z",
      stoppedAt: "2026-07-17T10:01:00.000Z",
    });

    await expect(service.getUsage()).resolves.toMatchObject({
      recordingsSizeBytes: 9,
    });
  });

  it("rebases replay clip rows when legacy manual clip folders migrate", async () => {
    const legacyDirectory = join(root, "Manual Clips");
    const canonicalDirectory = join(root, "Manual Replays");
    const legacyPath = join(legacyDirectory, "manual.mp4");
    const canonicalPath = join(canonicalDirectory, "manual.mp4");
    mkdirSync(legacyDirectory);
    writeFileSync(legacyPath, "manual");
    replayClipsRepository.upsert(
      createReplayClip({
        id: "manual",
        kind: "manual",
        originalObsPath: legacyPath,
        processedClipPath: legacyPath,
        sizeBytes: 6,
      }),
    );

    service.initializeStorageRoot();
    expect(await service.getUsage()).toEqual(
      expect.objectContaining({
        clipsSizeBytes: 6,
      }),
    );

    expect(existsSync(legacyDirectory)).toBe(false);
    expect(existsSync(canonicalPath)).toBe(true);
    expect(replayClipsRepository.get("manual")).toEqual(
      expect.objectContaining({
        originalObsPath: resolve(canonicalPath),
        processedClipPath: resolve(canonicalPath),
      }),
    );
  });

  it("initializes the storage root and migrates legacy manual replay folders", () => {
    const legacyDirectory = join(root, "Manual Clips");
    const canonicalDirectory = join(root, "Manual Replays");
    const legacyPath = join(legacyDirectory, "manual.mp4");
    const canonicalPath = join(canonicalDirectory, "manual.mp4");
    mkdirSync(legacyDirectory);
    writeFileSync(legacyPath, "manual");
    replayClipsRepository.upsert(
      createReplayClip({
        id: "manual",
        kind: "manual",
        originalObsPath: legacyPath,
        processedClipPath: null,
      }),
    );

    service.initializeStorageRoot();

    expect(existsSync(legacyDirectory)).toBe(false);
    expect(existsSync(canonicalPath)).toBe(true);
    expect(replayClipsRepository.get("manual")).toEqual(
      expect.objectContaining({
        originalObsPath: resolve(canonicalPath),
        processedClipPath: null,
      }),
    );
  });

  it("recovers pending manual replay migrations after files were already moved", () => {
    const legacyDirectory = join(root, "Manual Clips");
    const canonicalDirectory = join(root, "Manual Replays");
    const legacyPath = join(legacyDirectory, "manual.mp4");
    const canonicalPath = join(canonicalDirectory, "manual.mp4");
    mkdirSync(canonicalDirectory);
    writeFileSync(canonicalPath, "manual");
    repository.savePendingStoragePathMigrations([
      {
        from: legacyDirectory,
        to: canonicalDirectory,
      },
    ]);
    replayClipsRepository.upsert(
      createReplayClip({
        id: "manual",
        kind: "manual",
        originalObsPath: legacyPath,
        processedClipPath: legacyPath,
      }),
    );

    service.initializeStorageRoot();

    expect(replayClipsRepository.get("manual")).toEqual(
      expect.objectContaining({
        originalObsPath: resolve(canonicalPath),
        processedClipPath: resolve(canonicalPath),
      }),
    );
    expect(
      database.db
        .prepare(
          `
            SELECT status
            FROM recording_storage_path_migrations
            WHERE from_path = ?
          `,
        )
        .get(resolve(legacyDirectory)),
    ).toEqual({ status: "completed" });
  });

  it("keeps pending manual replay migrations when source and target are both missing", () => {
    const legacyDirectory = join(root, "Manual Clips");
    const canonicalDirectory = join(root, "Manual Replays");
    const legacyPath = join(legacyDirectory, "manual.mp4");
    const canonicalPath = join(canonicalDirectory, "manual.mp4");
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    repository.savePendingStoragePathMigrations([
      {
        from: legacyPath,
        to: canonicalPath,
      },
    ]);
    replayClipsRepository.upsert(
      createReplayClip({
        id: "manual",
        kind: "manual",
        originalObsPath: legacyPath,
        processedClipPath: legacyPath,
      }),
    );

    service.initializeStorageRoot();

    expect(replayClipsRepository.get("manual")).toEqual(
      expect.objectContaining({
        originalObsPath: resolve(legacyPath),
        processedClipPath: resolve(legacyPath),
      }),
    );
    expect(
      database.db
        .prepare(
          `
            SELECT status
            FROM recording_storage_path_migrations
            WHERE from_path = ?
          `,
        )
        .get(resolve(legacyPath)),
    ).toEqual({ status: "pending" });
    expect(logWarn).toHaveBeenCalledWith(
      "recording-storage",
      "Legacy recording media directory migration source and target are missing",
      expect.objectContaining({
        errorCode: "Error",
      }),
    );
  });

  it("keeps failed pending manual replay migrations pending without rebasing rows", () => {
    const legacyDirectory = join(root, "Manual Clips");
    const canonicalDirectory = join(root, "Manual Replays");
    const legacyPath = join(legacyDirectory, "manual.mp4");
    const canonicalPath = join(canonicalDirectory, "manual.mp4");
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    mkdirSync(legacyDirectory);
    mkdirSync(canonicalDirectory);
    writeFileSync(legacyPath, "legacy");
    writeFileSync(canonicalPath, "canonical");
    repository.savePendingStoragePathMigrations([
      {
        from: legacyPath,
        to: canonicalPath,
      },
    ]);
    replayClipsRepository.upsert(
      createReplayClip({
        id: "manual",
        kind: "manual",
        originalObsPath: legacyPath,
        processedClipPath: legacyPath,
      }),
    );

    service.initializeStorageRoot();

    expect(replayClipsRepository.get("manual")).toEqual(
      expect.objectContaining({
        originalObsPath: resolve(legacyPath),
        processedClipPath: resolve(legacyPath),
      }),
    );
    expect(
      database.db
        .prepare(
          `
            SELECT status
            FROM recording_storage_path_migrations
            WHERE from_path = ?
          `,
        )
        .get(resolve(legacyPath)),
    ).toEqual({ status: "pending" });
    expect(logWarn).toHaveBeenCalledWith(
      "recording-storage",
      "Legacy recording media directory migration failed",
      expect.objectContaining({
        errorCode: "Error",
      }),
    );
  });

  it("lists filesystem recordings and missing metadata rows", () => {
    const filePath = join(root, "2026-06-12_10-30-00.mp4");
    const missingPath = join(root, "2026-06-12_11-00-00.mp4");
    writeFileSync(filePath, "run");
    repository.upsertRunRecording({
      path: missingPath,
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T12:00:00.000Z",
    });

    expect(listServiceRecordings(service)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: resolve(filePath),
          fileName: basename(filePath),
          durationSeconds: null,
          exists: true,
          sizeBytes: 3,
        }),
        expect.objectContaining({
          path: resolve(missingPath),
          sourceGame: "poe2",
          durationSeconds: 3600,
          exists: false,
          sizeBytes: 0,
        }),
      ]),
    );
  });

  it("recovers imported recording durations from MP4 metadata", () => {
    const filePath = join(root, "2026-06-23 15-08-58.mp4");
    writeFileSync(filePath, createMp4WithDuration(78_250));

    const recording = listServiceRecordings(service).find(
      (item) => item.path === resolve(filePath),
    );

    expect(recording).toEqual(
      expect.objectContaining({
        durationSeconds: 78.25,
        exists: true,
        fileName: basename(filePath),
      }),
    );
    expect(repository.getItemById(recording?.id ?? "")).toEqual(
      expect.objectContaining({
        durationSeconds: 78.25,
      }),
    );
  });

  it("does not repeatedly probe unchanged exact-second recording durations", () => {
    const filePath = join(root, "2026-06-23 15-08-58.mp4");
    writeFileSync(filePath, createMp4WithDuration(16_000));
    const fileStats = statSync(filePath);
    repository.upsertRunRecording({
      path: filePath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-23T15:08:58.000Z",
      stoppedAt: "2026-06-23T15:09:14.000Z",
      exists: true,
      mtimeMs: fileStats.mtimeMs,
      sizeBytes: fileStats.size,
    });
    const durationProbe = vi.spyOn(
      service as unknown as {
        readRecordingFileDuration: (
          path: string,
          options?: { logFailure?: boolean; logSuccess?: boolean },
        ) => number | null;
      },
      "readRecordingFileDuration",
    );

    vi.useFakeTimers({ now: new Date("2026-06-23T16:00:00.000Z") });
    expect(listServiceRecordings(service)).toEqual([
      expect.objectContaining({
        durationSeconds: 16,
        path: resolve(filePath),
      }),
    ]);

    vi.setSystemTime(new Date("2026-06-23T16:00:03.000Z"));
    expect(listServiceRecordings(service)).toEqual([
      expect.objectContaining({
        durationSeconds: 16,
        path: resolve(filePath),
      }),
    ]);
    expect(durationProbe).toHaveBeenCalledTimes(1);
  });

  it("registers run recordings with MP4 duration metadata", () => {
    const filePath = join(root, "2026-06-23 15-08-58.mp4");
    writeFileSync(filePath, createMp4WithDuration(13_520));

    const recording = service.registerRunRecording({
      path: filePath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-23T15:08:58.000Z",
      stoppedAt: "2026-06-23T15:09:14.000Z",
    });

    expect(repository.getItemById(recording.id)).toEqual(
      expect.objectContaining({
        durationSeconds: 13.52,
        path: resolve(filePath),
      }),
    );
  });

  it("returns recording details with stable ids and app media URLs", () => {
    const filePath = join(root, "2026-06-12_10-30-00.mp4");
    const missingPath = join(root, "2026-06-12_11-00-00.mp4");
    writeFileSync(filePath, "run");
    repository.upsertRunRecording({
      path: missingPath,
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T12:00:00.000Z",
    });

    const recordings = listServiceRecordings(service);
    const fileRecording = recordings.find(
      (recording) => recording.path === resolve(filePath),
    );
    const missingRecording = recordings.find(
      (recording) => recording.path === resolve(missingPath),
    );
    expect(fileRecording?.id).toMatch(/^file-[a-f0-9]{32}$/);
    expect(service.getRecording(fileRecording?.id ?? "")).toEqual({
      mediaUrl: `hinekora-media://run-recording/${fileRecording?.id}`,
      recording: fileRecording,
    });
    expect(service.getRecordingMediaPath(fileRecording?.id ?? "")).toBe(
      resolve(filePath),
    );
    expect(service.getRecording(missingRecording?.id ?? "")).toEqual({
      mediaUrl: null,
      recording: missingRecording,
    });
    expect(service.getRecording("missing")).toBeNull();
    expect(service.getRecordingMediaPath("missing")).toBeNull();
  });

  it("lists paged recording details for the editor media rail", () => {
    const filePath = join(root, "2026-06-12_10-30-00.mp4");
    const missingPath = join(root, "2026-06-12_10-31-00.mp4");
    writeFileSync(filePath, "run");
    const presentRecording = repository.upsertRunRecording({
      path: filePath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:30:00.000Z",
      stoppedAt: "2026-06-12T10:31:00.000Z",
      createdAt: "2026-06-12T10:30:00.000Z",
    });
    const missingRecording = repository.upsertRunRecording({
      path: missingPath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:31:00.000Z",
      stoppedAt: "2026-06-12T10:32:00.000Z",
      createdAt: "2026-06-12T10:32:00.000Z",
    });

    const details = service.listEditorRecordingDetailPage({
      pageIndex: 0,
      pageSize: 10,
    }).items;

    expect(details).toEqual(
      expect.arrayContaining([
        {
          mediaUrl: null,
          recording: expect.objectContaining({
            path: resolve(missingPath),
          }),
        },
        {
          mediaUrl: expect.stringMatching(
            /^hinekora-media:\/\/run-recording\//,
          ),
          recording: expect.objectContaining({
            path: resolve(filePath),
            sizeBytes: 3,
          }),
        },
      ]),
    );
    expect(
      service.listEditorRecordingDetailPage({
        game: "poe2",
        league: "Standard",
        pageIndex: 0,
        pageSize: 10,
      }).items,
    ).toHaveLength(2);
    expect(
      service
        .listEditorRecordingDetailPage({
          createdAfter: "2026-06-12T10:31:00.000Z",
          excludeIds: [presentRecording.id],
          includeIds: [presentRecording.id, missingRecording.id],
          pageIndex: 0,
          pageSize: 10,
        })
        .items.map((detail) => detail.recording.id),
    ).toEqual([missingRecording.id]);
  });

  it("keeps matching recording metadata unchanged during library sync", () => {
    const filePath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(filePath, "run");
    const stats = statSync(filePath);
    repository.upsertRunRecording({
      path: filePath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:30:00.000Z",
      stoppedAt: "2026-06-12T10:31:00.000Z",
      exists: true,
      mtimeMs: stats.mtimeMs,
      sizeBytes: stats.size,
    });

    expect(listServiceRecordings(service)).toEqual([
      expect.objectContaining({
        path: resolve(filePath),
        sizeBytes: 3,
      }),
    ]);
  });

  it("fills missing durations for existing recording metadata", () => {
    const recordingsDirectory = join(root, "Full Recordings");
    mkdirSync(recordingsDirectory);
    const filePath = join(recordingsDirectory, "existing-import.mp4");
    writeFileSync(filePath, createMp4WithDuration(42_500));
    repository.upsertRunRecording({
      path: filePath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:30:00.000Z",
      stoppedAt: "2026-06-12T10:30:00.000Z",
    });

    expect(listServiceRecordings(service)).toEqual([
      expect.objectContaining({
        durationSeconds: 42.5,
        path: resolve(filePath),
      }),
    ]);
  });

  it("refreshes legacy rounded recording durations from MP4 metadata", () => {
    const filePath = join(root, "2026-06-23 15-08-58.mp4");
    writeFileSync(filePath, createMp4WithDuration(13_520));
    const stats = statSync(filePath);
    repository.upsertRunRecording({
      path: filePath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-23T15:08:58.000Z",
      stoppedAt: "2026-06-23T15:09:14.000Z",
      exists: true,
      mtimeMs: stats.mtimeMs,
      sizeBytes: stats.size,
    });
    expect(listRepositoryRecordings(repository)).toEqual([
      expect.objectContaining({
        durationSeconds: 16,
        path: resolve(filePath),
      }),
    ]);

    expect(listServiceRecordings(service)).toEqual([
      expect.objectContaining({
        durationSeconds: 13.52,
        path: resolve(filePath),
      }),
    ]);
    expect(listRepositoryRecordings(repository)).toEqual([
      expect.objectContaining({
        durationSeconds: 13.52,
        path: resolve(filePath),
      }),
    ]);
  });

  it("keeps missing durations when media metadata is unavailable", () => {
    vi.useFakeTimers({ now: new Date("2026-06-23T10:00:00.000Z") });
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    try {
      const recordingsDirectory = join(root, "Full Recordings");
      mkdirSync(recordingsDirectory);
      const filePath = join(recordingsDirectory, "invalid-import.mp4");
      writeFileSync(filePath, "not an mp4");
      const stats = statSync(filePath);
      repository.upsertRunRecording({
        path: filePath,
        sourceGame: "poe2",
        sourceLeague: "Standard",
        startedAt: "2026-06-12T10:30:00.000Z",
        stoppedAt: "2026-06-12T10:30:00.000Z",
        exists: true,
        mtimeMs: stats.mtimeMs,
        sizeBytes: stats.size,
      });

      expect(listServiceRecordings(service)).toEqual([
        expect.objectContaining({
          durationSeconds: null,
          path: resolve(filePath),
        }),
      ]);
      vi.setSystemTime(new Date("2026-06-23T10:00:03.000Z"));
      listServiceRecordings(service);

      expect(logWarn).toHaveBeenCalledTimes(1);
      expect(logWarn).toHaveBeenCalledWith(
        "recording-storage",
        "Run recording duration metadata unavailable",
        expect.objectContaining({
          recordingFile: basename(filePath),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears stale durations for changed recordings when media metadata is unavailable", () => {
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    const recordingsDirectory = join(root, "Full Recordings");
    mkdirSync(recordingsDirectory);
    const filePath = join(recordingsDirectory, "changed-import.mp4");
    writeFileSync(filePath, createMp4WithDuration(78_000));
    const originalStats = statSync(filePath);
    repository.upsertRunRecording({
      path: filePath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:30:00.000Z",
      stoppedAt: "2026-06-12T10:31:18.000Z",
      durationSeconds: 78,
      exists: true,
      mtimeMs: originalStats.mtimeMs,
      sizeBytes: originalStats.size,
    });
    writeFileSync(filePath, "not an mp4 anymore");

    expect(listServiceRecordings(service)).toEqual([
      expect.objectContaining({
        durationSeconds: null,
        path: resolve(filePath),
      }),
    ]);
    expect(listRepositoryRecordings(repository)).toEqual([
      expect.objectContaining({
        durationSeconds: null,
        path: resolve(filePath),
      }),
    ]);
    expect(logWarn).toHaveBeenCalledWith(
      "recording-storage",
      "Run recording duration metadata unavailable",
      expect.objectContaining({
        recordingFile: basename(filePath),
      }),
    );
  });

  it("registers directory and missing recording paths as unavailable files", () => {
    const filePath = join(root, "recording.mp4");
    const directoryPath = join(root, "folder.mp4");
    const missingPath = join(root, "missing.mp4");
    writeFileSync(filePath, "run");
    mkdirSync(directoryPath);

    const fileRecording = service.registerRunRecording({
      path: filePath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:29:00.000Z",
      stoppedAt: "2026-06-12T10:30:00.000Z",
    });
    expect(repository.getItemById(fileRecording.id)).toMatchObject({
      exists: true,
      sizeBytes: 3,
    });
    const directoryRecording = service.registerRunRecording({
      path: directoryPath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:30:00.000Z",
      stoppedAt: "2026-06-12T10:31:00.000Z",
    });
    expect(repository.getItemById(directoryRecording.id)).toMatchObject({
      exists: false,
      sizeBytes: 0,
    });
    const missingRecording = service.registerRunRecording({
      path: missingPath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:31:00.000Z",
      stoppedAt: "2026-06-12T10:32:00.000Z",
    });
    expect(repository.getItemById(missingRecording.id)).toMatchObject({
      exists: false,
      sizeBytes: 0,
    });
  });

  it("returns paged recording library data sorted in the main process", () => {
    const standardPath = join(root, "2026-06-12_10-30-00.mp4");
    const hardcorePath = join(root, "2026-06-12_11-00-00.mp4");
    writeFileSync(standardPath, "run");
    writeFileSync(hardcorePath, "larger-run");
    repository.upsertRunRecording({
      path: standardPath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:30:00.000Z",
      stoppedAt: "2026-06-12T10:45:00.000Z",
    });
    repository.upsertRunRecording({
      path: hardcorePath,
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T11:05:00.000Z",
    });

    expect(
      service.listRecordingLibrary({
        game: "poe2",
        pageIndex: 0,
        pageSize: 1,
        sortBy: "sizeBytes",
        sortDirection: "desc",
      }),
    ).toMatchObject({
      availableLeagues: ["Hardcore", "Standard"],
      pageCount: 2,
      pageIndex: 0,
      pageSize: 1,
      totalCount: 2,
      items: [expect.objectContaining({ path: resolve(hardcorePath) })],
    });
    expect(
      service.listRecordingLibrary({
        game: "poe2",
        league: "Standard",
      }).items,
    ).toEqual([expect.objectContaining({ path: resolve(standardPath) })]);
  });

  it("sorts recording library rows by metadata fields and applies query defaults", () => {
    const alphaPath = join(root, "2026-06-12_10-30-00.mp4");
    const betaPath = join(root, "2026-06-12_11-00-00.mp4");
    const gammaPath = join(root, "2026-06-12_12-00-00.mp4");
    const orphanPath = join(root, "2026-06-12_13-00-00.mp4");
    writeFileSync(alphaPath, createMp4WithDuration(300_000));
    writeFileSync(betaPath, createMp4WithDuration(60_000));
    writeFileSync(gammaPath, createMp4WithDuration(30_000));
    writeFileSync(orphanPath, createMp4WithDuration(15_000));
    const orphanTime = new Date("2026-06-12T10:45:00.000Z");
    utimesSync(orphanPath, orphanTime, orphanTime);
    repository.upsertRunRecording({
      path: alphaPath,
      sourceGame: "poe1",
      sourceLeague: "Alpha",
      startedAt: "2026-06-12T10:30:00.000Z",
      stoppedAt: "2026-06-12T10:35:00.000Z",
    });
    repository.upsertRunRecording({
      path: betaPath,
      sourceGame: "poe1",
      sourceLeague: "Beta",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T11:01:00.000Z",
    });
    repository.upsertRunRecording({
      path: gammaPath,
      sourceGame: "poe1",
      sourceLeague: "Beta",
      startedAt: "2026-06-12T12:00:00.000Z",
      stoppedAt: "2026-06-12T12:00:30.000Z",
    });
    const stampCreatedAt = (path: string, createdAt: string) => {
      database.db
        .prepare(
          "UPDATE run_recordings SET created_at = ?, updated_at = ? WHERE path = ?",
        )
        .run(createdAt, createdAt, resolve(path));
    };
    stampCreatedAt(alphaPath, "2026-06-12T10:35:00.000Z");
    stampCreatedAt(betaPath, "2026-06-12T11:01:00.000Z");
    stampCreatedAt(gammaPath, "2026-06-12T12:00:30.000Z");

    expect(service.listRecordingLibrary()).toMatchObject({
      pageIndex: 0,
      pageSize: 20,
      sortBy: "createdAt",
      sortDirection: "desc",
      totalCount: 4,
    });
    expect(
      service
        .listRecordingLibrary({
          sortBy: "durationSeconds",
          sortDirection: "asc",
        })
        .items.map((recording) => recording.path),
    ).toEqual([
      resolve(orphanPath),
      resolve(gammaPath),
      resolve(betaPath),
      resolve(alphaPath),
    ]);
    expect(
      service
        .listRecordingLibrary({ sortBy: "fileName", sortDirection: "asc" })
        .items.map((recording) => recording.path),
    ).toEqual([
      resolve(alphaPath),
      resolve(betaPath),
      resolve(gammaPath),
      resolve(orphanPath),
    ]);
    expect(
      service
        .listRecordingLibrary({
          sortBy: "sourceLeague",
          sortDirection: "asc",
        })
        .items.map((recording) => recording.path),
    ).toEqual([
      resolve(alphaPath),
      resolve(gammaPath),
      resolve(betaPath),
      resolve(orphanPath),
    ]);
    expect(
      service
        .listRecordingLibrary({ sortBy: "createdAt", sortDirection: "asc" })
        .items.map((recording) => recording.path),
    ).toEqual([
      resolve(alphaPath),
      resolve(orphanPath),
      resolve(betaPath),
      resolve(gammaPath),
    ]);
  });

  it("opens, reveals, and deletes only managed recording files", async () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    const invalidPath = join(root, "boss-fight.mp4");
    writeFileSync(validPath, "run");
    writeFileSync(invalidPath, "run");

    await expect(service.openRecording(validPath)).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(service.revealRecording(validPath)).toEqual({
      ok: true,
      error: null,
    });
    await expect(service.openRecording(invalidPath)).resolves.toEqual({
      ok: false,
      error: "Recording file is not available",
    });
    expect(service.revealRecording(invalidPath)).toEqual({
      ok: false,
      error: "Recording file is not available",
    });
    await expect(service.deleteRecording(validPath)).resolves.toEqual({
      ok: true,
      error: null,
    });
    await expect(service.deleteRecording(invalidPath)).resolves.toEqual({
      ok: false,
      error: "Recording file is not available",
    });
    await expect(
      service.deleteRecording(join(root, "2026-06-12_12-00-00.mp4")),
    ).resolves.toEqual({
      ok: false,
      error: "Recording file is not available",
    });
    expect(existsSync(validPath)).toBe(false);
    expect(existsSync(invalidPath)).toBe(true);
    expect(openPath).toHaveBeenCalledTimes(1);
    expect(openPath).toHaveBeenCalledWith(resolve(validPath));
    expect(showItemInFolder).toHaveBeenCalledWith(resolve(validPath));
  });

  it("deletes stale run recording metadata", async () => {
    const missingPath = join(root, "2026-06-12_11-00-00.mp4");
    repository.upsertRunRecording({
      path: missingPath,
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T12:00:00.000Z",
    });

    await expect(service.deleteRecording(missingPath)).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(repository.getByPath(missingPath)).toBeNull();
  });

  it("keeps a recording file that is still referenced by a replay clip", async () => {
    const sharedPath = join(root, "2026-06-12_11-00-00.mp4");
    writeFileSync(sharedPath, "shared");
    repository.upsertRunRecording({
      path: sharedPath,
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T12:00:00.000Z",
    });
    replayClipsRepository.upsert(
      createReplayClip({ id: "shared-clip", originalObsPath: sharedPath }),
    );

    await expect(service.deleteRecording(sharedPath)).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(existsSync(sharedPath)).toBe(true);
    expect(repository.getByPath(sharedPath)).toBeNull();
    expect(replayClipsRepository.get("shared-clip")).not.toBeNull();
  });

  it("reports recording file cleanup failures after deleting metadata", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>();

      return {
        ...actual,
        unlink: vi.fn(() => {
          throw new Error("unlink failed");
        }),
      };
    });

    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(validPath, "run");
    let resetDynamicDatabase: () => void = () => {};
    try {
      const { DatabaseService: MockedDatabaseService } = await import(
        "../../database"
      );
      resetDynamicDatabase = () => MockedDatabaseService.resetForTests();
      const { mockIpcMainHandlers: mockDynamicIpcMainHandlers } = await import(
        "~/main/test/ipc"
      );
      const { SettingsStoreService: MockedSettingsStoreService } = await import(
        "../../settings-store"
      );
      const { RecordingStorageRepository: MockedRecordingStorageRepository } =
        await import("../RecordingStorage.repository");
      const { RecordingStorageService: MockedRecordingStorageService } =
        await import("../RecordingStorage.service");
      const mockedDatabase = MockedDatabaseService.getInstance(
        join(root, "mocked-hinekora.sqlite"),
      );
      const mockedRepository = new MockedRecordingStorageRepository(
        mockedDatabase,
      );
      mockDynamicIpcMainHandlers();
      vi.spyOn(MockedSettingsStoreService, "getInstance").mockReturnValue({
        get: () => ({
          ...createDefaultSettings(),
          recordingStoragePath: root,
          recordingMaxStorageGb: 1,
        }),
      } as unknown as typeof MockedSettingsStoreService.prototype);
      mockedRepository.upsertRunRecording({
        path: validPath,
        sourceGame: "poe2",
        sourceLeague: "Hardcore",
        startedAt: "2026-06-12T10:30:00.000Z",
        stoppedAt: "2026-06-12T11:30:00.000Z",
      });
      const mockedService = new MockedRecordingStorageService();

      await expect(mockedService.deleteRecording(validPath)).resolves.toEqual({
        ok: true,
        error: null,
        cleanupError: "A staged recording file could not be removed",
      });
      expect(existsSync(validPath)).toBe(false);
      expect(mockedRepository.getByPath(validPath)).toBeNull();

      writeFileSync(validPath, "run");
      mockedRepository.upsertRunRecording({
        path: validPath,
        sourceGame: "poe2",
        sourceLeague: "Hardcore",
        startedAt: "2026-06-12T10:30:00.000Z",
        stoppedAt: "2026-06-12T11:30:00.000Z",
      });
      await expect(
        mockedService.deleteManyRecordings([validPath]),
      ).resolves.toEqual({
        ok: true,
        error: null,
        deletedPaths: [validPath],
        failed: [],
        cleanupErrors: [
          {
            path: validPath,
            error: "A staged recording file could not be removed",
          },
        ],
      });
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("node:fs/promises");
      vi.resetModules();
    }
  });

  it("deletes many recordings with per-path failures", async () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    const invalidPath = join(root, "boss-fight.mp4");
    writeFileSync(validPath, "run");
    writeFileSync(invalidPath, "run");

    await expect(
      service.deleteManyRecordings([validPath, invalidPath]),
    ).resolves.toEqual({
      ok: false,
      error: "Some recordings could not be deleted",
      deletedPaths: [validPath],
      failed: [{ path: invalidPath, error: "Recording file is not available" }],
    });
    expect(existsSync(validPath)).toBe(false);
    expect(existsSync(invalidPath)).toBe(true);
  });

  it("deletes many recordings without failures", async () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(validPath, "run");

    await expect(service.deleteManyRecordings([validPath])).resolves.toEqual({
      ok: true,
      error: null,
      deletedPaths: [validPath],
      failed: [],
    });
    expect(existsSync(validPath)).toBe(false);
  });

  it("uses a fallback error for batch delete failures without details", async () => {
    vi.spyOn(service, "deleteRecording").mockResolvedValue({
      ok: false,
      error: null,
    });

    await expect(
      service.deleteManyRecordings(["2026-06-12_10-30-00.mp4"]),
    ).resolves.toEqual({
      ok: false,
      error: "Some recordings could not be deleted",
      deletedPaths: [],
      failed: [
        {
          path: "2026-06-12_10-30-00.mp4",
          error: "Recording delete failed",
        },
      ],
    });
  });

  it("returns safe errors when delete throws", async () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(validPath, "run");
    repository.upsertRunRecording({
      path: validPath,
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T10:30:00.000Z",
      stoppedAt: "2026-06-12T11:30:00.000Z",
    });
    vi.spyOn(
      RecordingStorageRepository.prototype,
      "deleteRunRecordingByPath",
    ).mockImplementation(() => {
      throw new Error("delete failed");
    });
    const failingService = new RecordingStorageService();

    await expect(failingService.deleteRecording(validPath)).resolves.toEqual({
      ok: false,
      error: "delete failed",
    });
    expect(existsSync(validPath)).toBe(true);
    expect(repository.getByPath(validPath)).not.toBeNull();
  });

  it("reports shell action failures without exposing broader filesystem access", async () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(validPath, "run");
    openPath.mockResolvedValue("open denied");
    showItemInFolder.mockImplementation(() => {
      throw new Error("reveal denied");
    });

    await expect(service.openRecording(validPath)).resolves.toEqual({
      ok: false,
      error: "open denied",
    });
    expect(service.revealRecording(validPath)).toEqual({
      ok: false,
      error: "reveal denied",
    });
  });

  it("copies only existing managed recordings to the clipboard", async () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(validPath, "run");
    const copyFileToClipboard = vi
      .spyOn(FileClipboard, "copyFileToClipboard")
      .mockResolvedValue({ ok: true, error: null });

    await expect(service.copyRecordingToClipboard(validPath)).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(copyFileToClipboard).toHaveBeenCalledWith(resolve(validPath));
  });

  it("returns safe errors when recording clipboard copy throws", async () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(validPath, "run");
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockRejectedValue(
      new Error("clipboard exploded"),
    );

    await expect(service.copyRecordingToClipboard(validPath)).resolves.toEqual({
      ok: false,
      error: "clipboard exploded",
    });
  });

  it("blocks clipboard copy for unmanaged recording paths", async () => {
    const invalidPath = join(root, "boss-fight.mp4");
    writeFileSync(invalidPath, "run");
    const copyFileToClipboard = vi.spyOn(FileClipboard, "copyFileToClipboard");

    await expect(
      service.copyRecordingToClipboard(invalidPath),
    ).resolves.toEqual({
      ok: false,
      error: "Recording file is not available",
    });
    expect(copyFileToClipboard).not.toHaveBeenCalled();
  });

  it("returns safe errors when shell open throws", async () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(validPath, "run");
    openPath.mockImplementation(() => {
      throw new Error("cannot open C:\\Users\\seb\\Videos\\run.mp4");
    });

    await expect(service.openRecording(validPath)).resolves.toEqual({
      ok: false,
      error: "cannot open [path]",
    });
  });

  it("registers run recordings with resolved paths", () => {
    const relativePath = join(root, "2026-06-12_10-30-00.mp4");

    expect(
      service.registerRunRecording({
        path: relativePath,
        sourceGame: "poe1",
        sourceLeague: "Standard",
        startedAt: "2026-06-12T10:00:00.000Z",
        stoppedAt: "2026-06-12T11:00:00.000Z",
      }),
    ).toMatchObject({
      path: resolve(relativePath),
      sourceGame: "poe1",
      sourceLeague: "Standard",
    });
  });

  it("reports cleanup usage without deleting when storage limit is disabled", async () => {
    const clipPath = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    const sessionDirectory = join(root, "Hinekora-2026-06-12_10-30-00");
    const oldPath = join(sessionDirectory, "old.mkv");
    mkdirSync(sessionDirectory);
    writeFileSync(clipPath, "clip");
    writeFileSync(oldPath, "run");
    replayClipsRepository.upsert(
      createReplayClip({ processedClipPath: clipPath, sizeBytes: 4 }),
    );
    service.refreshLibrary({ publishUsage: false });

    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 0,
      }),
    } as unknown as SettingsStoreService);

    await expect(service.cleanup()).resolves.toEqual({
      deletedCount: 0,
      freedBytes: 0,
      limitBytes: 0,
      usageBytes: 7,
    });
  });

  it("reports over-limit usage when every cleanup candidate is protected", async () => {
    const protectedDirectory = join(root, "Hinekora-2026-06-12_10-30-00");
    const protectedPath = join(protectedDirectory, "protected.mkv");
    mkdirSync(protectedDirectory);
    writeFileSync(protectedPath, "protected");
    service.refreshLibrary({ publishUsage: false });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 1 / 1024 ** 3,
      }),
    } as unknown as SettingsStoreService);

    await expect(
      service.cleanup({ protectedDirectories: [protectedDirectory] }),
    ).resolves.toEqual({
      deletedCount: 0,
      freedBytes: 0,
      limitBytes: 1,
      usageBytes: 9,
    });
    expect(existsSync(protectedPath)).toBe(true);
  });

  it("coalesces equivalent cleanup requests while one is pending", async () => {
    const first = service.cleanup({ protectedPaths: ["b", "a"] });
    const second = service.cleanup({ protectedPaths: ["a", "b"] });

    expect(second).toBe(first);
    await first;
  });

  it("tries a backup candidate when the planned deletion fails", async () => {
    const firstPath = join(root, "2026-06-12_10-30-00.mkv");
    const secondPath = join(root, "2026-06-12_10-31-00.mkv");
    writeFileSync(firstPath, "run");
    writeFileSync(secondPath, "run");
    service.refreshLibrary({ publishUsage: false });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 4 / 1024 ** 3,
      }),
    } as unknown as SettingsStoreService);

    type RetentionFile = {
      kind: "recording";
      mtimeMs: number;
      path: string;
      size: number;
    };
    type RetentionResult = {
      deletedPaths: string[];
      freedBytes: number;
      recordingId: string | null;
      usageReductionBytes: number;
    };
    const internals = service as unknown as {
      deleteRecordingForRetention(
        file: RetentionFile,
        root: string,
      ): Promise<RetentionResult>;
    };
    const originalDelete = internals.deleteRecordingForRetention.bind(service);
    vi.spyOn(internals, "deleteRecordingForRetention")
      .mockResolvedValueOnce({
        deletedPaths: [],
        freedBytes: 0,
        recordingId: null,
        usageReductionBytes: 0,
      })
      .mockImplementation(originalDelete);

    await expect(service.cleanup()).resolves.toMatchObject({
      deletedCount: 1,
      freedBytes: 3,
      usageBytes: 6,
    });
    expect([existsSync(firstPath), existsSync(secondPath)].sort()).toEqual([
      false,
      true,
    ]);
  });

  it("continues cleanup when a bounded pass leaves more over-limit files", async () => {
    for (let index = 0; index < 102; index += 1) {
      const path = join(root, `recording-${index}.mkv`);
      writeFileSync(path, "x");
      repository.upsertRunRecording({
        id: `recording-${index}`,
        path,
        sourceGame: "poe2",
        sourceLeague: "Standard",
        startedAt: "2026-07-17T00:00:00.000Z",
        stoppedAt: "2026-07-17T00:01:00.000Z",
        mtimeMs: index,
        sizeBytes: 1,
      });
    }
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 2 / 1024 ** 3,
      }),
    } as unknown as SettingsStoreService);
    const cleanup = vi.spyOn(service, "cleanup");

    await service.cleanup();
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledTimes(2));
  });

  it("continues cleanup when rows are deleted without freeing physical bytes", async () => {
    const inventory = {
      clipGroups: Array.from({ length: 101 }, (_, index) => ({
        clipIds: [`clip-${index}`],
        mtimeMs: index,
        paths: [join(root, `clip-${index}.mp4`)],
        size: 1,
      })),
      clipsSizeBytes: 101,
      recordingEntries: [],
      recordingsSizeBytes: 0,
      usageBytes: 101,
    };
    vi.spyOn(service, "getUsage").mockResolvedValue({
      clipsSizeBytes: 101,
      diskFreeBytes: 0,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    const internals = service as unknown as {
      createStorageInventory: (
        storageRoot: string,
      ) => Promise<typeof inventory>;
    };
    vi.spyOn(internals, "createStorageInventory").mockResolvedValue(inventory);
    service.setReplayClipRetentionCleanupHandler(async (idGroups) => ({
      deletedIds: idGroups.flat(),
      deletedPaths: [],
      failed: [],
      freedBytes: 0,
    }));
    const setTimeoutSpy = vi
      .spyOn(global, "setTimeout")
      .mockImplementation(() => ({ unref: vi.fn() }) as never);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 2 / 1024 ** 3,
      }),
    } as unknown as SettingsStoreService);

    await expect(
      service.cleanup({ protectedPaths: ["zero-byte-finalization"] }),
    ).resolves.toMatchObject({ deletedCount: 0, freedBytes: 0 });
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
  });

  it("handles protected, invalid, orphaned, and missing retention recordings", async () => {
    type RetentionFile = {
      kind: "recording";
      mtimeMs: number;
      path: string;
      size: number;
    };
    type RetentionResult = {
      deletedPaths: string[];
      freedBytes: number;
      recordingId: string | null;
      usageReductionBytes: number;
    };
    const internals = service as unknown as {
      deleteRecordingForRetention(
        file: RetentionFile,
        storageRoot: string,
      ): Promise<RetentionResult>;
      deleteReplayClipsForRetention(
        idGroups: string[][],
        storageRoot: string,
      ): Promise<unknown>;
    };
    const sharedPath = join(root, "shared.mp4");
    writeFileSync(sharedPath, "shared");
    replayClipsRepository.upsert(
      createReplayClip({ processedClipPath: sharedPath, sizeBytes: 6 }),
    );

    await expect(
      internals.deleteRecordingForRetention(
        { kind: "recording", mtimeMs: 1, path: sharedPath, size: 6 },
        root,
      ),
    ).resolves.toEqual({
      deletedPaths: [],
      freedBytes: 0,
      recordingId: null,
      usageReductionBytes: 0,
    });

    const directoryPath = join(root, "directory.mkv");
    mkdirSync(directoryPath);
    await expect(
      internals.deleteRecordingForRetention(
        { kind: "recording", mtimeMs: 1, path: directoryPath, size: 0 },
        root,
      ),
    ).resolves.toEqual({
      deletedPaths: [],
      freedBytes: 0,
      recordingId: null,
      usageReductionBytes: 0,
    });

    const orphanedPath = join(root, "orphaned.mkv");
    writeFileSync(orphanedPath, "orphaned");
    await expect(
      internals.deleteRecordingForRetention(
        { kind: "recording", mtimeMs: 1, path: orphanedPath, size: 8 },
        root,
      ),
    ).resolves.toEqual({
      deletedPaths: [orphanedPath],
      freedBytes: 8,
      recordingId: null,
      usageReductionBytes: 8,
    });

    const missingPath = join(root, "missing.mkv");
    await expect(
      internals.deleteRecordingForRetention(
        { kind: "recording", mtimeMs: 1, path: missingPath, size: 5 },
        root,
      ),
    ).resolves.toEqual({
      deletedPaths: [],
      freedBytes: 0,
      recordingId: null,
      usageReductionBytes: 5,
    });

    await expect(
      internals.deleteReplayClipsForRetention([["clip-1", "clip-2"]], root),
    ).resolves.toEqual({
      deletedIds: [],
      deletedPaths: [],
      failed: [
        {
          id: "clip-1",
          error: "Replay clip retention handler is unavailable",
        },
        {
          id: "clip-2",
          error: "Replay clip retention handler is unavailable",
        },
      ],
      freedBytes: 0,
    });
  });

  it("deletes the oldest replay clip when combined usage exceeds the limit", async () => {
    const clipPath = join(root, "old-clip.mp4");
    const recordingDirectory = join(root, "Hinekora-2026-06-12_10-30-00");
    const recordingPath = join(recordingDirectory, "run.mkv");
    mkdirSync(recordingDirectory);
    writeFileSync(clipPath, "old-clip");
    writeFileSync(recordingPath, "run");
    replayClipsRepository.upsert(
      createReplayClip({
        createdAt: "2020-01-01T00:00:00.000Z",
        processedClipPath: clipPath,
        sizeBytes: 8,
      }),
    );
    service.refreshLibrary({ publishUsage: false });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 9 / 1024 ** 3,
      }),
    } as unknown as SettingsStoreService);
    service.setReplayClipRetentionCleanupHandler(async (idGroups) => {
      const ids = idGroups.flat();
      rmSync(clipPath);
      for (const id of ids) {
        replayClipsRepository.delete(id);
      }
      return {
        deletedIds: ids,
        deletedPaths: [clipPath],
        failed: [],
        freedBytes: 8,
      };
    });

    await expect(service.cleanup()).resolves.toEqual({
      deletedCount: 1,
      freedBytes: 8,
      limitBytes: 9,
      usageBytes: 11,
    });
    expect(existsSync(clipPath)).toBe(false);
    expect(replayClipsRepository.get("clip-1")).toBeNull();
    expect(existsSync(recordingPath)).toBe(true);
  });

  it("deletes unprotected managed recordings when usage exceeds the limit", async () => {
    const oldDirectory = join(root, "Hinekora-2026-06-12_10-30-00");
    const oldPath = join(oldDirectory, "2026-06-12_10-30-00.mkv");
    const clipPath = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    mkdirSync(oldDirectory);
    writeFileSync(oldPath, "old-run");
    writeFileSync(clipPath, "clip");
    replayClipsRepository.upsert(
      createReplayClip({ processedClipPath: clipPath, sizeBytes: 4 }),
    );
    service.refreshLibrary({ publishUsage: false });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 0.000000001,
      }),
    } as unknown as SettingsStoreService);

    await expect(
      service.cleanup({ protectedPaths: [clipPath] }),
    ).resolves.toMatchObject({ deletedCount: 1, freedBytes: 7 });
    expect(existsSync(oldPath)).toBe(false);
    expect(existsSync(clipPath)).toBe(true);
    expect(existsSync(oldDirectory)).toBe(false);
  });

  it("restores a staged recording when a replay reference appears before commit", async () => {
    const oldDirectory = join(root, "Hinekora-2026-06-12_10-30-00");
    const oldPath = join(oldDirectory, "2026-06-12_10-30-00.mkv");
    mkdirSync(oldDirectory);
    writeFileSync(oldPath, "old-run");
    service.refreshLibrary({ publishUsage: false });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 0.000000001,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ReplayClipsRepository.prototype, "hasStoragePath")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    await expect(service.cleanup()).resolves.toMatchObject({
      deletedCount: 0,
      freedBytes: 0,
    });

    expect(existsSync(oldPath)).toBe(true);
    expect(repository.getItemByPath(oldPath)).toEqual(
      expect.objectContaining({ exists: true, sizeBytes: 7 }),
    );
    expect(
      database.db
        .prepare(
          "SELECT COUNT(*) AS count FROM storage_file_deletion_operations",
        )
        .get(),
    ).toEqual({ count: 0 });
  });

  it("archives recording links when a retention candidate disappeared", async () => {
    const missingPath = join(root, "2026-06-12_10-30-00.mkv");
    repository.upsertRunRecording({
      id: "missing-recording",
      path: missingPath,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:00:00.000Z",
      stoppedAt: "2026-06-12T10:01:00.000Z",
      mtimeMs: 1,
      sizeBytes: 100,
    });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 0.000000001,
      }),
    } as unknown as SettingsStoreService);
    const archiveRecordingLinks = vi.spyOn(
      BookmarksService.prototype,
      "archiveRecordingLinks",
    );

    await service.cleanup();

    expect(archiveRecordingLinks).toHaveBeenCalledWith(
      expect.objectContaining({ id: "missing-recording" }),
    );
    expect(repository.getItemByPath(missingPath)).toEqual(
      expect.objectContaining({ exists: false, sizeBytes: 0 }),
    );
    service.refreshLibrary({ publishUsage: false });
  });

  it("keeps staged bytes counted when final deletion fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.resetModules();
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>();

      return {
        ...actual,
        unlink: vi.fn().mockRejectedValue(new Error("unlink failed")),
      };
    });

    const selectedPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(selectedPath, "run");
    let resetDynamicDatabase: () => void = () => {};
    try {
      const { DatabaseService: MockedDatabaseService } = await import(
        "../../database"
      );
      resetDynamicDatabase = () => MockedDatabaseService.resetForTests();
      const { mockIpcMainHandlers: mockDynamicIpcMainHandlers } = await import(
        "~/main/test/ipc"
      );
      const { SettingsStoreService: MockedSettingsStoreService } = await import(
        "../../settings-store"
      );
      const { RecordingStorageService: MockedRecordingStorageService } =
        await import("../RecordingStorage.service");
      MockedDatabaseService.getInstance(join(root, "mocked-hinekora.sqlite"));
      mockDynamicIpcMainHandlers();
      vi.spyOn(MockedSettingsStoreService, "getInstance").mockReturnValue({
        get: () => ({
          ...createDefaultSettings(),
          recordingStoragePath: root,
          recordingMaxStorageGb: 0.000000001,
        }),
      } as unknown as typeof MockedSettingsStoreService.prototype);
      const mockedService = new MockedRecordingStorageService();
      mockedService.refreshLibrary({ publishUsage: false });

      await expect(mockedService.cleanup()).resolves.toMatchObject({
        deletedCount: 0,
        freedBytes: 0,
        usageBytes: 3,
      });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "WARN [recording-storage] Failed to finalize staged recording deletion",
        ),
        expect.objectContaining({ recordingFile: "2026-06-12_10-30-00.mp4" }),
      );
      expect(existsSync(selectedPath)).toBe(false);
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("node:fs/promises");
      vi.resetModules();
    }
  });

  it("keeps recordings protected by directory during cleanup", async () => {
    const protectedDirectory = join(root, "Hinekora-2026-06-12_10-30-00");
    const protectedPath = join(protectedDirectory, "2026-06-12_10-30-00.mkv");
    mkdirSync(protectedDirectory);
    writeFileSync(protectedPath, "protected");
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 0,
      }),
    } as unknown as SettingsStoreService);
    service.refreshLibrary({ publishUsage: false });

    await expect(
      service.cleanup({ protectedDirectories: [protectedDirectory] }),
    ).resolves.toMatchObject({
      deletedCount: 0,
      freedBytes: 0,
      usageBytes: 9,
    });
    expect(existsSync(protectedPath)).toBe(true);
  });

  it("retains missing replay clip rows during cleanup", async () => {
    const nestedDirectory = join(root, "Hinekora-2026-06-12_10-30-00");
    const managedPath = join(nestedDirectory, "2026-06-12_10-30-00.mkv");
    mkdirSync(nestedDirectory, { recursive: true });
    writeFileSync(managedPath, "run");
    replayClipsRepository.upsert(
      createReplayClip({
        id: "missing-clip",
        originalObsPath: join(root, "missing-original.mp4"),
        processedClipPath: join(root, "missing-processed.mp4"),
      }),
    );
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 0.000000001,
      }),
    } as unknown as SettingsStoreService);
    service.refreshLibrary({ publishUsage: false });

    await expect(service.cleanup()).resolves.toMatchObject({ deletedCount: 1 });
    expect(await service.getUsage()).toEqual(
      expect.objectContaining({ clipsSizeBytes: 0 }),
    );
    expect(replayClipsRepository.get("missing-clip")).not.toBeNull();
  });

  it("registers IPC handlers with validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    const ipcService = new RecordingStorageService();
    const getUsage = vi.spyOn(ipcService, "getUsage").mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 0,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    vi.spyOn(ipcService, "listRecordingLibrary").mockReturnValue({
      availableLeagues: ["Standard"],
      items: [],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 20,
      sortBy: "createdAt",
      sortDirection: "desc",
      totalCount: 0,
    });
    vi.spyOn(ipcService, "getRecording").mockReturnValue({
      mediaUrl: "hinekora-media://run-recording/recording-1",
      recording: {
        id: "recording-1",
        path: resolve(root, "2026-06-12_10-30-00.mp4"),
        fileName: "2026-06-12_10-30-00.mp4",
        sourceGame: "poe2",
        sourceLeague: "Standard",
        startedAt: "2026-06-12T10:00:00.000Z",
        stoppedAt: "2026-06-12T10:05:00.000Z",
        createdAt: "2026-06-12T10:05:00.000Z",
        updatedAt: "2026-06-12T10:05:00.000Z",
        durationSeconds: 300,
        sizeBytes: 5,
        exists: true,
      },
    });
    vi.spyOn(ipcService, "openRecording").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "revealRecording").mockReturnValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "copyRecordingToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "deleteRecording").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "deleteManyRecordings").mockResolvedValue({
      ok: true,
      error: null,
      deletedPaths: ["clip.mp4"],
      failed: [],
    });

    expect(await handlers.get(RecordingStorageChannel.GetUsage)?.({})).toEqual({
      clipsSizeBytes: 0,
      diskFreeBytes: 0,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    getUsage.mockRejectedValueOnce(
      new Error(`Unable to scan ${join(root, "private", "recordings")}`),
    );
    expect(await handlers.get(RecordingStorageChannel.GetUsage)?.({})).toEqual({
      ok: false,
      error: "Recording storage usage is unavailable",
    });

    getUsage.mockRejectedValueOnce("native failure");
    expect(await handlers.get(RecordingStorageChannel.GetUsage)?.({})).toEqual({
      ok: false,
      error: "Recording storage usage is unavailable",
    });
    expect(
      await handlers.get(RecordingStorageChannel.GetRecording)?.(
        {},
        "recording-1",
      ),
    ).toEqual(
      expect.objectContaining({
        mediaUrl: "hinekora-media://run-recording/recording-1",
      }),
    );
    expect(
      await handlers.get(RecordingStorageChannel.ListRecordingLibrary)?.(
        {},
        { game: "poe1" },
      ),
    ).toEqual(expect.objectContaining({ items: [] }));
    expect(
      await handlers.get(RecordingStorageChannel.ListRecordingLibrary)?.(
        {},
        {
          pageIndex: 0,
          pageSize: 20,
          sortBy: "createdAt",
          sortDirection: "asc",
        },
      ),
    ).toEqual(expect.objectContaining({ items: [] }));
    expect(
      await handlers.get(RecordingStorageChannel.ListRecordingLibrary)?.({}),
    ).toEqual(expect.objectContaining({ items: [] }));
    expect(
      await handlers.get(RecordingStorageChannel.OpenRecording)?.(
        {},
        "clip.mp4",
      ),
    ).toEqual({ ok: true, error: null });
    expect(
      await handlers.get(RecordingStorageChannel.RevealRecording)?.(
        {},
        "clip.mp4",
      ),
    ).toEqual({ ok: true, error: null });
    expect(
      await handlers.get(RecordingStorageChannel.CopyRecording)?.(
        {},
        "clip.mp4",
      ),
    ).toEqual({ ok: true, error: null });
    expect(
      await handlers.get(RecordingStorageChannel.DeleteRecording)?.(
        {},
        "clip.mp4",
      ),
    ).toEqual({ ok: true, error: null });
    expect(
      await handlers.get(RecordingStorageChannel.DeleteManyRecordings)?.({}, [
        "clip.mp4",
      ]),
    ).toEqual({
      ok: true,
      error: null,
      deletedPaths: ["clip.mp4"],
      failed: [],
    });
    expect(
      await handlers.get(RecordingStorageChannel.ListRecordingLibrary)?.(
        {},
        { game: "poe3" },
      ),
    ).toEqual({
      ok: false,
      error: "game is invalid",
    });
    expect(
      await handlers.get(RecordingStorageChannel.ListRecordingLibrary)?.(
        {},
        { league: "" },
      ),
    ).toEqual({
      ok: false,
      error: "league is too short",
    });
    expect(
      await handlers.get(RecordingStorageChannel.ListRecordingLibrary)?.(
        {},
        { pageIndex: -1 },
      ),
    ).toEqual({
      ok: false,
      error: "page index is too small",
    });
    expect(
      await handlers.get(RecordingStorageChannel.ListRecordingLibrary)?.(
        {},
        { pageSize: 101 },
      ),
    ).toEqual({
      ok: false,
      error: "page size is too large",
    });
    expect(
      await handlers.get(RecordingStorageChannel.ListRecordingLibrary)?.(
        {},
        { sortDirection: "sideways" },
      ),
    ).toEqual({
      ok: false,
      error: "sort direction is invalid",
    });
    expect(
      await handlers.get(RecordingStorageChannel.ListRecordingLibrary)?.(
        {},
        { sortBy: "unknown" },
      ),
    ).toEqual({
      ok: false,
      error: "sort field is invalid",
    });
    expect(
      await handlers.get(RecordingStorageChannel.OpenRecording)?.({}, ""),
    ).toEqual({
      ok: false,
      error: "recording path is too short",
    });
    expect(
      await handlers.get(RecordingStorageChannel.GetRecording)?.({}, ""),
    ).toEqual({
      ok: false,
      error: "recording id is too short",
    });
    expect(
      await handlers.get(RecordingStorageChannel.RevealRecording)?.({}, ""),
    ).toEqual({
      ok: false,
      error: "recording path is too short",
    });
    expect(
      await handlers.get(RecordingStorageChannel.CopyRecording)?.({}, ""),
    ).toEqual({
      ok: false,
      error: "recording path is too short",
    });
    expect(
      await handlers.get(RecordingStorageChannel.DeleteRecording)?.({}, ""),
    ).toEqual({
      ok: false,
      error: "recording path is too short",
    });
    expect(
      await handlers.get(RecordingStorageChannel.DeleteManyRecordings)?.(
        {},
        "",
      ),
    ).toEqual({
      ok: false,
      error: "recording paths must be an array",
    });
    expect(
      await handlers.get(RecordingStorageChannel.DeleteManyRecordings)?.(
        {},
        Array.from({ length: 101 }, (_, index) => `clip-${index}.mp4`),
      ),
    ).toEqual({
      ok: false,
      error: "recording paths is too large",
    });
    expect(
      await handlers.get(RecordingStorageChannel.DeleteManyRecordings)?.({}, [
        "",
      ]),
    ).toEqual({
      ok: false,
      error: "recording path is too short",
    });
  });
});

function createMp4WithDuration(duration: number): Buffer {
  const movieHeader = Buffer.alloc(20);
  movieHeader.writeUInt32BE(1_000, 12);
  movieHeader.writeUInt32BE(duration, 16);

  return createMp4Box("moov", createMp4Box("mvhd", movieHeader));
}

function createMp4Box(type: string, payload: Buffer): Buffer {
  const box = Buffer.alloc(8 + payload.length);
  box.writeUInt32BE(box.length, 0);
  box.write(type, 4, 4, "ascii");
  payload.copy(box, 8);

  return box;
}
