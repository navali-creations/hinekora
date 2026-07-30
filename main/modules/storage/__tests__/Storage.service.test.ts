import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { BrowserWindow } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { EditorExportOwnershipRepository } from "~/main/modules/editor/EditorExportOwnership.repository";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { RecordingStorageRepository } from "~/main/modules/recording-storage/RecordingStorage.repository";
import { ReplayClipsRepository } from "~/main/modules/replay-clips/ReplayClips.repository";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createReplayClip } from "~/main/test/factories/replayClip";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import * as appLog from "~/main/utils/app-log";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import type { ManagedRecorderStatus } from "~/types";
import { createDefaultSettings } from "~/types";
import { StorageChannel } from "../Storage.channels";
import {
  addExportFileToStorageTotals,
  createExportStorageTotals,
  createExportStorageVolumes,
} from "../Storage.info";
import { StorageService } from "../Storage.service";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
  getAppPath: vi.fn(),
  getPath: vi.fn(),
  isPackaged: false,
}));

vi.mock("electron", () => ({
  app: {
    getAppPath: electronMocks.getAppPath,
    getPath: electronMocks.getPath,
    get isPackaged() {
      return electronMocks.isPackaged;
    },
  },
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
}));

let database: DatabaseService;
let replayClipsRepository: ReplayClipsRepository;
let recordingStorageRepository: RecordingStorageRepository;
let appInstallRoot: string;
let root: string;
let storageRoot: string;
let ipcHandlers: Map<string, (event: unknown, ...args: unknown[]) => unknown>;

function mockRecorderStatus(
  overrides: Partial<ManagedRecorderStatus> = {},
): ManagedRecorderStatus {
  return {
    available: true,
    gameRunning: true,
    initialized: true,
    bufferActive: false,
    recording: false,
    isStartingRecording: false,
    isStoppingRecording: false,
    runRecordingActive: false,
    runtime: "packaged_obs",
    runtimePath: null,
    outputDirectory: storageRoot,
    outputResolution: "native",
    fps: 30,
    encoder: "hardware_h264",
    lastRecordingPath: null,
    runRecordingPath: null,
    activeSessionDirectory: null,
    recordingStartedAt: null,
    runRecordingStartedAt: null,
    error: null,
    ...overrides,
  };
}

beforeEach(() => {
  ipcHandlers = mockIpcMainHandlers().handlers;
  root = mkdtempSync(join(tmpdir(), "hinekora-storage-"));
  appInstallRoot = join(root, "app-install");
  storageRoot = join(root, "recordings");
  mkdirSync(appInstallRoot, { recursive: true });
  mkdirSync(storageRoot, { recursive: true });
  writeFileSync(join(appInstallRoot, "hinekora.exe"), "install");
  database = DatabaseService.getInstance(join(root, "hinekora.sqlite"));
  replayClipsRepository = new ReplayClipsRepository(database);
  recordingStorageRepository = new RecordingStorageRepository(database);
  electronMocks.getAppPath.mockReturnValue(appInstallRoot);
  electronMocks.getPath.mockReturnValue(join(root, "videos"));
  electronMocks.getAllWindows.mockReturnValue([]);
  vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
    get: () => ({
      ...createDefaultSettings(),
      recordingStoragePath: storageRoot,
      activeGame: "poe1",
      activeLeague: "Keepers",
    }),
  } as unknown as SettingsStoreService);
  vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
    getStatus: () => mockRecorderStatus(),
  } as unknown as ManagedRecorderService);
});

afterEach(() => {
  StorageService.resetForTests();
  electronMocks.getAppPath.mockReset();
  electronMocks.getAllWindows.mockReset();
  electronMocks.getPath.mockReset();
  electronMocks.isPackaged = false;
  RecordingStorageService.resetForTests();
  clearIpcWindowRolesForTests();
  vi.restoreAllMocks();
  DatabaseService.resetForTests();
  rmSync(root, { force: true, recursive: true });
});

describe("StorageService", () => {
  it("creates and reuses the singleton instance", () => {
    StorageService.resetForTests();

    const first = StorageService.getInstance();
    const second = StorageService.getInstance();

    expect(first).toBe(second);
    StorageService.resetForTests();
  });

  it("reports and publishes authoritative analysis availability", () => {
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        id: 701,
        isDestroyed: vi.fn(() => false),
        send: vi.fn(),
      },
    };
    const destroyedMainWindow = {
      isDestroyed: vi.fn(() => true),
      webContents: {
        id: 702,
        isDestroyed: vi.fn(() => false),
        send: vi.fn(),
      },
    };
    const overlayWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        id: 703,
        isDestroyed: vi.fn(() => false),
        send: vi.fn(),
      },
    };
    const destroyedContentsWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        id: 704,
        isDestroyed: vi.fn(() => true),
        send: vi.fn(),
      },
    };
    const failedMainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        id: 705,
        isDestroyed: vi.fn(() => false),
        send: vi.fn(() => {
          throw new Error("renderer unavailable");
        }),
      },
    };
    const trailingMainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        id: 706,
        isDestroyed: vi.fn(() => false),
        send: vi.fn(),
      },
    };
    registerIpcWindowRole(mainWindow.webContents, WindowName.Main);
    registerIpcWindowRole(destroyedMainWindow.webContents, WindowName.Main);
    registerIpcWindowRole(
      overlayWindow.webContents,
      WindowName.RecorderOverlay,
    );
    registerIpcWindowRole(destroyedContentsWindow.webContents, WindowName.Main);
    registerIpcWindowRole(failedMainWindow.webContents, WindowName.Main);
    registerIpcWindowRole(trailingMainWindow.webContents, WindowName.Main);
    electronMocks.getAllWindows.mockReturnValue([
      mainWindow,
      destroyedMainWindow,
      overlayWindow,
      destroyedContentsWindow,
      failedMainWindow,
      trailingMainWindow,
    ]);
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});
    const service = StorageService.getInstance();

    expect(service.getAnalysisAvailability()).toBe("ready");
    expect(ipcHandlers.get(StorageChannel.GetAnalysisAvailability)?.({})).toBe(
      "ready",
    );

    RecordingStorageService.setPerformanceSensitiveActivityActive(true);
    expect(service.getAnalysisAvailability()).toBe("deferred");
    expect(mainWindow.webContents.send).toHaveBeenLastCalledWith(
      StorageChannel.AnalysisAvailabilityChanged,
      "deferred",
    );

    RecordingStorageService.setPerformanceSensitiveActivityActive(false);
    expect(mainWindow.webContents.send).toHaveBeenLastCalledWith(
      StorageChannel.AnalysisAvailabilityChanged,
      "ready",
    );
    expect(destroyedMainWindow.webContents.send).not.toHaveBeenCalled();
    expect(overlayWindow.webContents.send).not.toHaveBeenCalled();
    expect(destroyedContentsWindow.webContents.send).not.toHaveBeenCalled();
    expect(trailingMainWindow.webContents.send).toHaveBeenLastCalledWith(
      StorageChannel.AnalysisAvailabilityChanged,
      "ready",
    );
    expect(logWarn).toHaveBeenCalledWith(
      "storage",
      "Storage analysis availability notification failed",
      { error: "renderer unavailable" },
    );
  });

  it("tolerates unavailable Electron window enumeration", () => {
    StorageService.getInstance();
    electronMocks.getAllWindows.mockImplementationOnce(() => {
      throw new Error("window enumeration failed");
    });

    expect(() =>
      RecordingStorageService.setPerformanceSensitiveActivityActive(true),
    ).not.toThrow();

    const browserWindow = BrowserWindow as unknown as {
      getAllWindows: (() => Electron.BrowserWindow[]) | undefined;
    };
    const getAllWindows = browserWindow.getAllWindows;
    try {
      browserWindow.getAllWindows = undefined;
      expect(() =>
        RecordingStorageService.setPerformanceSensitiveActivityActive(false),
      ).not.toThrow();
    } finally {
      browserWindow.getAllWindows = getAllWindows;
    }
  });

  it("coalesces concurrent storage inventory requests", async () => {
    const service = new StorageService();

    const first = service.getInfo();
    const second = service.getInfo();

    expect(second).toBe(first);
    await first;
    const third = service.getInfo();
    expect(third).not.toBe(first);
    await third;
  });

  it("starts a new inventory when storage roots change during a scan", async () => {
    let settings = {
      ...createDefaultSettings(),
      recordingStoragePath: storageRoot,
    };
    vi.mocked(SettingsStoreService.getInstance).mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);
    let resolveFirstScan!: (value: null) => void;
    const firstScan = new Promise<null>((resolvePromise) => {
      resolveFirstScan = resolvePromise;
    });
    const scanExportFiles = vi
      .fn()
      .mockReturnValueOnce(firstScan)
      .mockResolvedValue({
        fileCount: 0,
        inspectedEntryCount: 0,
        isTruncated: false,
      });
    const service = new StorageService({ scanExportFiles });

    const initialRequest = service.getInfo();
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
    const nextStorageRoot = join(root, "next-recordings");
    settings = { ...settings, recordingStoragePath: nextStorageRoot };
    const changedRequest = service.getInfo();
    const changed = await changedRequest;
    resolveFirstScan(null);

    await expect(initialRequest).resolves.toBe(changed);
    expect(scanExportFiles).toHaveBeenCalledTimes(2);
    expect(changed.storagePath).toContain("next-recordings");
  });

  it("clears an aborted public inventory request before retrying", async () => {
    const scanExportFiles = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        fileCount: 0,
        inspectedEntryCount: 0,
        isTruncated: false,
      });
    const service = new StorageService({ scanExportFiles });

    await expect(service.getInfo()).resolves.toEqual(
      expect.objectContaining({
        exportVideosUsageTruncated: false,
      }),
    );
    expect(scanExportFiles).toHaveBeenCalledTimes(2);
  });

  it("reports exports on configured, recording, and legacy volumes", async () => {
    const configuredExports = join(root, "configured-exports");
    vi.mocked(SettingsStoreService.getInstance).mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        editorExportStoragePath: configuredExports,
        recordingStoragePath: storageRoot,
      }),
    } as unknown as SettingsStoreService);
    const videosPath = join(root, "videos");
    const legacyExports = join(videosPath, "Hinekora", "Exports");
    const previousExports = join(storageRoot, "Saved Edits");
    const getStorageDeviceId = vi.fn((path: string | null) => {
      if (!path) {
        return null;
      }
      if (resolve(path).startsWith(resolve(configuredExports))) {
        return 2;
      }
      if (resolve(path).startsWith(resolve(legacyExports))) {
        return 3;
      }
      return 1;
    });
    const calculateDiskUsage = vi.fn((path: string) => {
      const deviceId = getStorageDeviceId(path) ?? 0;
      return { freeBytes: deviceId * 100, totalBytes: deviceId * 1_000 };
    });
    const scanExportFiles = vi.fn(async (options) => {
      await options.onFiles([
        {
          deviceId: 2,
          inode: 2,
          modifiedAt: new Date(0),
          path: join(configuredExports, "configured.mp4"),
          sizeBytes: 10,
        },
        {
          deviceId: 3,
          inode: 3,
          modifiedAt: new Date(0),
          path: join(legacyExports, "legacy.mp4"),
          sizeBytes: 20,
        },
        {
          deviceId: 1,
          inode: 1,
          modifiedAt: new Date(0),
          path: join(previousExports, "previous.mp4"),
          sizeBytes: 30,
        },
        {
          deviceId: 2,
          inode: 22,
          modifiedAt: new Date("2100-01-01T00:00:00.000Z"),
          path: join(configuredExports, "external.mp4"),
          sizeBytes: 40,
        },
      ]);
      return {
        fileCount: 4,
        inspectedEntryCount: 4,
        isTruncated: false,
      };
    });
    new EditorExportOwnershipRepository(database).upsert({
      deviceId: 2,
      inode: 2,
      modifiedAtMs: 0,
      path: join(configuredExports, "configured.mp4"),
      projectId: null,
      sizeBytes: 10,
    });
    const service = new StorageService({
      calculateDiskUsage,
      getStorageDeviceId,
      scanExportFiles,
    });

    const info = await service.getInfo();

    expect(info.exportStorageVolumes).toEqual([
      expect.objectContaining({
        exportVideosSizeBytes: 30,
        isRecordingStorage: true,
      }),
      expect.objectContaining({
        exportVideosSizeBytes: 10,
      }),
      expect.objectContaining({
        exportVideosSizeBytes: 20,
        isRecordingStorage: false,
      }),
    ]);
    expect(info.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "export-videos",
          fileCount: 3,
          sizeBytes: 60,
        }),
      ]),
    );
  });

  it("cancels an inventory after asynchronous storage aggregation", async () => {
    let abortCheckCount = 0;
    const service = new StorageService({
      calculatePathSize: async () => 0,
      collectStorageRootInventory: async () => ({
        isTruncated: false,
        recordingFiles: [],
        temporaryFiles: [],
      }),
      scanExportFiles: async () => ({
        fileCount: 0,
        inspectedEntryCount: 0,
        isTruncated: false,
      }),
    });
    const internals = service as unknown as {
      calculateInfo: (
        roots: unknown,
        shouldAbort: () => boolean,
      ) => Promise<unknown>;
      resolveInfoRoots: () => unknown;
    };

    await expect(
      internals.calculateInfo(internals.resolveInfoRoots(), () => {
        abortCheckCount += 1;
        return abortCheckCount === 2;
      }),
    ).resolves.toBeNull();
  });

  it("retries an inventory after pruning stale export ownership records", async () => {
    const service = new StorageService({
      calculatePathSize: async () => 0,
      collectStorageRootInventory: async () => ({
        isTruncated: false,
        recordingFiles: [],
        temporaryFiles: [],
      }),
      scanExportFiles: async () => ({
        fileCount: 0,
        inspectedEntryCount: 0,
        isTruncated: false,
      }),
    });
    const internals = service as unknown as {
      exportOwnershipRepository: {
        pruneStale: (files: unknown[]) => number;
      };
    };
    const pruneStale = vi
      .spyOn(internals.exportOwnershipRepository, "pruneStale")
      .mockReturnValueOnce(1)
      .mockReturnValue(0);

    await expect(service.getInfo()).resolves.toBeTruthy();
    expect(pruneStale).toHaveBeenCalledTimes(2);
  });

  it("retries when sensitive activity starts during final inventory aggregation", async () => {
    let diskUsageCallCount = 0;
    const service = new StorageService({
      calculateDiskUsage: () => {
        diskUsageCallCount += 1;
        if (diskUsageCallCount === 1) {
          RecordingStorageService.setPerformanceSensitiveActivityActive(true);
        }
        return { freeBytes: 1, totalBytes: 2 };
      },
      calculatePathSize: async () => 0,
      collectStorageRootInventory: async () => ({
        isTruncated: false,
        recordingFiles: [],
        temporaryFiles: [],
      }),
      scanExportFiles: async () => ({
        fileCount: 0,
        inspectedEntryCount: 0,
        isTruncated: false,
      }),
    });

    const infoRequest = service.getInfo();
    await vi.waitFor(() => {
      expect(
        RecordingStorageService.isPerformanceSensitiveActivityActive(),
      ).toBe(true);
    });
    RecordingStorageService.setPerformanceSensitiveActivityActive(false);

    await expect(infoRequest).resolves.toBeTruthy();
    expect(diskUsageCallCount).toBeGreaterThan(1);
  });

  it("prefers the configured export path for roots on one volume", () => {
    const configuredExports = join(root, "configured-exports");
    const legacyExports = join(root, "legacy-exports");
    mkdirSync(configuredExports);
    mkdirSync(legacyExports);

    const totals = createExportStorageTotals(
      [legacyExports, configuredExports],
      configuredExports,
      null,
      () => 1,
    );

    expect([...totals.volumes.values()]).toEqual([
      expect.objectContaining({ path: configuredExports }),
    ]);
  });

  it("orders equivalent legacy export volumes by path", () => {
    const createVolume = (deviceId: number, path: string) => ({
      deviceId,
      exportVideosSizeBytes: 0,
      id: `storage-volume-${deviceId}`,
      isConfiguredExportStorage: false,
      isRecordingStorage: false,
      path,
    });

    const volumes = createExportStorageVolumes(
      {
        configuredRootKey: "",
        exportFileCount: 0,
        exportVideosSizeBytes: 0,
        storageDeviceId: null,
        volumes: new Map([
          [2, createVolume(2, join(root, "z-legacy"))],
          [3, createVolume(3, join(root, "a-legacy"))],
        ]),
      },
      () => ({ freeBytes: 1, totalBytes: 2 }),
    );

    expect(volumes.map((volume) => volume.path)).toEqual([
      expect.stringContaining("a-legacy"),
      expect.stringContaining("z-legacy"),
    ]);
  });

  it("tracks an export whose file device differs from its root", () => {
    const configuredExports = join(root, "configured-exports");
    const totals = createExportStorageTotals(
      [configuredExports],
      configuredExports,
      2,
      () => 1,
    );

    addExportFileToStorageTotals(totals, {
      deviceId: 2,
      path: join(configuredExports, "saved.mp4"),
      sizeBytes: 123,
    });

    expect(totals.exportFileCount).toBe(1);
    expect(totals.exportVideosSizeBytes).toBe(123);
    expect(totals.volumes.get(2)).toMatchObject({
      exportVideosSizeBytes: 123,
      isConfiguredExportStorage: true,
      isRecordingStorage: true,
      path: configuredExports,
    });
  });

  it("caches sequential inventories, bypasses changed roots, and bounds exports", async () => {
    let settings = {
      ...createDefaultSettings(),
      activeGame: "poe1" as const,
      activeLeague: "Keepers",
      recordingStoragePath: storageRoot,
    };
    vi.mocked(SettingsStoreService.getInstance).mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);
    const service = new StorageService({
      infoCacheMs: 5_000,
      maxExportFiles: 1,
    });

    const initial = await service.getInfo();
    await expect(service.getInfo()).resolves.toBe(initial);

    const nextExportRoot = join(root, "videos", "Hinekora", "Exports");
    mkdirSync(nextExportRoot, { recursive: true });
    writeFileSync(join(nextExportRoot, "one.mp4"), "one");
    writeFileSync(join(nextExportRoot, "two.mp4"), "two");
    settings = { ...settings, editorExportStoragePath: nextExportRoot };
    const changedRoot = await service.getInfo();
    expect(changedRoot).not.toBe(initial);
    expect(changedRoot.exportVideosUsageTruncated).toBe(true);
    expect(changedRoot.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "export-videos",
          fileCount: 1,
          sizeBytes: 3,
        }),
      ]),
    );

    const expiredAt = Date.now() + 5_001;
    vi.spyOn(Date, "now").mockReturnValue(expiredAt);
    await expect(service.getInfo()).resolves.not.toBe(changedRoot);
  });

  it("reports disk usage and game league usage from managed media", async () => {
    const deathClipDirectory = join(storageRoot, "Death Clips");
    const fullRecordingDirectory = join(storageRoot, "Full Recordings");
    const manualReplayDirectory = join(storageRoot, "Manual Replays");
    const savedEditsDirectory = join(storageRoot, "Saved Edits");
    const exportDirectory = join(root, "videos", "Hinekora Exports");
    mkdirSync(deathClipDirectory);
    mkdirSync(fullRecordingDirectory);
    mkdirSync(manualReplayDirectory);
    mkdirSync(savedEditsDirectory);
    mkdirSync(exportDirectory, { recursive: true });
    const clipPath = join(deathClipDirectory, "death.mp4");
    const recordingPath = join(fullRecordingDirectory, "recording.mp4");
    const manualReplayPath = join(manualReplayDirectory, "manual.mp4");
    const temporaryPath = join(storageRoot, "recording.tmp");
    const savedEditPath = join(savedEditsDirectory, "saved-edit.mp4");
    const nestedExportDirectory = join(exportDirectory, "nested");
    mkdirSync(nestedExportDirectory);
    writeFileSync(clipPath, "clip");
    writeFileSync(recordingPath, "recording");
    writeFileSync(manualReplayPath, "manual");
    writeFileSync(temporaryPath, "temporary");
    writeFileSync(savedEditPath, "saved");
    writeFileSync(join(exportDirectory, "notes.txt"), "not a video");
    writeFileSync(join(nestedExportDirectory, "nested.mp4"), "not managed");
    replayClipsRepository.upsert(
      createReplayClip({
        processedClipPath: clipPath,
        sizeBytes: 4,
        sourceGame: "poe1",
        sourceLeague: "Keepers",
      }),
    );
    replayClipsRepository.upsert(
      createReplayClip({
        id: "manual-clip",
        processedClipPath: manualReplayPath,
        sizeBytes: 6,
        sourceGame: "poe1",
        sourceLeague: "Keepers",
      }),
    );
    recordingStorageRepository.upsertRunRecording({
      path: recordingPath,
      sourceGame: "poe1",
      sourceLeague: "Keepers",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T12:00:00.000Z",
    });
    const service = new StorageService();

    await expect(service.getInfo()).resolves.toEqual(
      expect.objectContaining({
        appInstallationSizeBytes: 7,
        recordingsSizeBytes: 19,
        rewindBufferEstimateBytes: 90_000_000,
        temporarySizeBytes: 9,
        diskTotalBytes: expect.any(Number),
        diskFreeBytes: expect.any(Number),
        breakdown: expect.arrayContaining([
          expect.objectContaining({
            category: "rewind-buffer",
            estimated: true,
            fileCount: 1,
            sizeBytes: 90_000_000,
          }),
          expect.objectContaining({
            category: "app-installation",
            fileCount: 1,
            sizeBytes: 7,
          }),
          expect.objectContaining({
            category: "death-clips",
            fileCount: 1,
            sizeBytes: 4,
          }),
          expect.objectContaining({
            category: "full-recordings",
            fileCount: 1,
            sizeBytes: 9,
          }),
          expect.objectContaining({
            category: "manual-replays",
            label: "Manual replays",
            fileCount: 1,
            sizeBytes: 6,
          }),
          expect.objectContaining({
            category: "export-videos",
            label: "Hinekora export videos",
            fileCount: 1,
            sizeBytes: 5,
          }),
          expect.objectContaining({
            category: "temporary-files",
            fileCount: 1,
            sizeBytes: 9,
          }),
        ]),
      }),
    );
    await expect(service.getInfo()).resolves.toEqual(
      expect.objectContaining({
        appInstallationSizeBytes: 7,
      }),
    );
    expect(await service.getGameLeagueUsage()).toEqual([
      expect.objectContaining({
        game: "poe1",
        leagueName: "Keepers",
        clipCount: 2,
        recordingCount: 1,
        estimatedSizeBytes: 19,
      }),
    ]);
  });

  it("retries league usage when activity starts after inventory resolves", async () => {
    const service = new StorageService();
    const info = await service.getInfo();
    const listStorageUsage = vi.spyOn(
      ReplayClipsRepository.prototype,
      "listStorageUsage",
    );
    vi.spyOn(service, "getInfo")
      .mockImplementationOnce(async () => {
        RecordingStorageService.setPerformanceSensitiveActivityActive(true);
        return info;
      })
      .mockResolvedValue(info);

    const usageRequest = service.getGameLeagueUsage();
    await vi.waitFor(() => {
      expect(
        RecordingStorageService.isPerformanceSensitiveActivityActive(),
      ).toBe(true);
    });
    expect(listStorageUsage).not.toHaveBeenCalled();

    RecordingStorageService.setPerformanceSensitiveActivityActive(false);

    await expect(usageRequest).resolves.toEqual([]);
    expect(listStorageUsage).toHaveBeenCalledOnce();
  });

  it("retries league usage when activity starts during clip pagination", async () => {
    const service = new StorageService();
    const info = await service.getInfo();
    vi.spyOn(service, "getInfo").mockResolvedValue(info);
    const storagePage = Array.from({ length: 500 }, (_, index) => ({
      createdAt: "2026-06-12T10:00:00.000Z",
      id: `clip-${index}`,
      originalObsPath: null,
      processedClipPath: null,
      sizeBytes: 0,
    }));
    const listStorageEntriesPage = vi
      .spyOn(ReplayClipsRepository.prototype, "listStorageEntriesPage")
      .mockImplementationOnce(() => {
        RecordingStorageService.setPerformanceSensitiveActivityActive(true);
        return storagePage;
      })
      .mockReturnValue([]);

    const usageRequest = service.getGameLeagueUsage();
    await vi.waitFor(() => {
      expect(listStorageEntriesPage).toHaveBeenCalledOnce();
      expect(
        RecordingStorageService.isPerformanceSensitiveActivityActive(),
      ).toBe(true);
    });

    RecordingStorageService.setPerformanceSensitiveActivityActive(false);

    await expect(usageRequest).resolves.toEqual([]);
    expect(listStorageEntriesPage).toHaveBeenCalledTimes(2);
  });

  it("rebases replay clip rows before reporting migrated manual replay storage", async () => {
    const legacyDirectory = join(storageRoot, "Manual Clips");
    const canonicalDirectory = join(storageRoot, "Manual Replays");
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
    const service = new StorageService();

    await expect(service.getInfo()).resolves.toEqual(
      expect.objectContaining({
        recordingsSizeBytes: 6,
        breakdown: expect.arrayContaining([
          expect.objectContaining({
            category: "manual-replays",
            fileCount: 1,
            sizeBytes: 6,
          }),
        ]),
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

  it("uses the packaged executable directory for app installation size", async () => {
    electronMocks.isPackaged = true;
    const service = new StorageService();

    await expect(service.getInfo()).resolves.toEqual(
      expect.objectContaining({
        appInstallationSizeBytes: expect.any(Number),
      }),
    );
  });

  it("ignores missing clip files while collecting storage info", async () => {
    const deathClipDirectory = join(storageRoot, "Death Clips");
    mkdirSync(deathClipDirectory);
    const emptyClipPath = join(deathClipDirectory, "empty.mp4");
    writeFileSync(emptyClipPath, "");
    replayClipsRepository.upsert(
      createReplayClip({
        processedClipPath: join(storageRoot, "missing.mp4"),
        sizeBytes: 0,
      }),
    );
    replayClipsRepository.upsert(
      createReplayClip({
        id: "empty-clip",
        processedClipPath: emptyClipPath,
        sizeBytes: 0,
      }),
    );
    const service = new StorageService();

    await expect(service.getInfo()).resolves.toMatchObject({
      recordingsSizeBytes: 0,
    });
  });

  it("ignores clip paths and cached inventories outside the current storage root", async () => {
    replayClipsRepository.upsert(
      createReplayClip({
        processedClipPath: join(root, "outside.mp4"),
        sizeBytes: 0,
      }),
    );
    const service = new StorageService();
    await service.getInfo();
    (
      service as unknown as {
        recordingInventoryCache: {
          files: [];
          root: string;
        };
      }
    ).recordingInventoryCache = {
      files: [],
      root: join(root, "previous-storage-root"),
    };

    await expect(service.getGameLeagueUsage()).resolves.toEqual([
      expect.objectContaining({
        clipCount: 1,
        estimatedSizeBytes: 0,
        recordingCount: 0,
      }),
    ]);
  });

  it("counts filesystem-only full recordings in the active game league", async () => {
    const deathClipDirectory = join(storageRoot, "Death Clips");
    const fullRecordingDirectory = join(storageRoot, "Full Recordings");
    const manualReplayDirectory = join(storageRoot, "Manual Replays");
    mkdirSync(deathClipDirectory);
    mkdirSync(fullRecordingDirectory);
    mkdirSync(manualReplayDirectory);
    writeFileSync(join(deathClipDirectory, "orphan-death.mp4"), "death");
    writeFileSync(join(fullRecordingDirectory, "orphan-run.mp4"), "run");
    writeFileSync(join(manualReplayDirectory, "orphan-manual.mp4"), "manual");
    const service = new StorageService();

    const storageInfo = await service.getInfo();
    expect(storageInfo.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "temporary-files",
          fileCount: 0,
          sizeBytes: 0,
        }),
      ]),
    );
    expect(await service.getGameLeagueUsage()).toEqual([
      expect.objectContaining({
        game: "poe1",
        leagueName: "Keepers",
        clipCount: 0,
        recordingCount: 1,
        estimatedSizeBytes: 3,
      }),
    ]);
  });

  it("counts duplicate clip paths once and sorts equal-size usage buckets", async () => {
    const clipPath = join(storageRoot, "2026-06-12_10-30-00-death-10s.mp4");
    writeFileSync(clipPath, "clip");
    replayClipsRepository.upsert(
      createReplayClip({
        id: "same-path-a",
        processedClipPath: clipPath,
        sizeBytes: 4,
        sourceGame: "poe1",
        sourceLeague: "Keepers",
      }),
    );
    replayClipsRepository.upsert(
      createReplayClip({
        id: "same-path-b",
        processedClipPath: clipPath,
        sizeBytes: 4,
        sourceGame: "poe1",
        sourceLeague: "Keepers",
      }),
    );
    replayClipsRepository.upsert(
      createReplayClip({
        id: "zero-alpha",
        processedClipPath: null,
        sourceGame: "poe1",
        sourceLeague: "Alpha",
      }),
    );
    replayClipsRepository.upsert(
      createReplayClip({
        id: "zero-beta",
        processedClipPath: null,
        sourceGame: "poe1",
        sourceLeague: "Beta",
      }),
    );
    replayClipsRepository.upsert(
      createReplayClip({
        id: "zero-poe2",
        processedClipPath: null,
        sourceGame: "poe2",
        sourceLeague: "Alpha",
      }),
    );

    expect(await serviceUsageSummary(new StorageService())).toEqual([
      ["poe1", "Keepers", 2, 4],
      ["poe1", "Alpha", 1, 0],
      ["poe1", "Beta", 1, 0],
      ["poe2", "Alpha", 1, 0],
    ]);
  });

  it("does not double-count run recordings already counted as clips", async () => {
    const sharedPath = resolve(
      join(storageRoot, "2026-06-12_10-30-00-death-10s.mp4"),
    );
    writeFileSync(sharedPath, "clip");
    replayClipsRepository.upsert(
      createReplayClip({
        processedClipPath: sharedPath,
        sizeBytes: 4,
        sourceGame: "poe1",
        sourceLeague: "Keepers",
      }),
    );
    recordingStorageRepository.upsertRunRecording({
      path: sharedPath,
      sourceGame: "poe1",
      sourceLeague: "Keepers",
      startedAt: "2026-06-12T10:30:00.000Z",
      stoppedAt: "2026-06-12T10:31:00.000Z",
    });
    const service = new StorageService();

    expect(await service.getGameLeagueUsage()).toEqual([
      expect.objectContaining({
        clipCount: 1,
        estimatedSizeBytes: 4,
        recordingCount: 0,
      }),
    ]);
  });

  it("counts metadata-only run recordings and active recording usage", async () => {
    const missingRunPath = join(storageRoot, "2026-06-12_11-00-00.mp4");
    recordingStorageRepository.upsertRunRecording({
      path: missingRunPath,
      sourceGame: "poe1",
      sourceLeague: "Keepers",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T12:00:00.000Z",
    });
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => mockRecorderStatus({ runRecordingActive: true }),
    } as unknown as ManagedRecorderService);

    expect(await new StorageService().getGameLeagueUsage()).toEqual([
      expect.objectContaining({
        game: "poe1",
        leagueName: "Keepers",
        clipCount: 0,
        recordingCount: 1,
        estimatedSizeBytes: 0,
        hasActiveRecording: true,
      }),
    ]);
  });

  it("reports zero app and database disk metadata for unavailable paths", async () => {
    DatabaseService.resetForTests();
    database = DatabaseService.getInstance(":memory:");
    electronMocks.getAppPath.mockImplementation(() => {
      throw new Error("app path unavailable");
    });
    const service = new StorageService();

    await expect(service.getInfo()).resolves.toEqual(
      expect.objectContaining({
        appInstallationSizeBytes: 0,
        databaseSizeBytes: 0,
      }),
    );
    await expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).resolves.toMatchObject({ success: true });
  });

  it("deletes selected game league rows and managed files", async () => {
    const clipPath = join(storageRoot, "2026-06-12_10-30-00-death-10s.mp4");
    const recordingPath = join(storageRoot, "2026-06-12_11-00-00.mp4");
    writeFileSync(clipPath, "clip");
    writeFileSync(recordingPath, "recording");
    replayClipsRepository.upsert(
      createReplayClip({
        processedClipPath: clipPath,
        sourceGame: "poe1",
        sourceLeague: "Keepers",
      }),
    );
    recordingStorageRepository.upsertRunRecording({
      path: recordingPath,
      sourceGame: "poe1",
      sourceLeague: "Keepers",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T12:00:00.000Z",
    });
    const service = new StorageService();

    await expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).resolves.toEqual({
      success: true,
      freedBytes: 13,
      deletedClipCount: 1,
      deletedRecordingCount: 1,
    });
    expect(existsSync(clipPath)).toBe(false);
    expect(existsSync(recordingPath)).toBe(false);
    expect(replayClipsRepository.listAll()).toEqual([]);
    expect(recordingStorageRepository.listRunRecordings()).toEqual([]);
  });

  it("preserves media paths referenced by a clip outside the deleted league", async () => {
    const sharedPath = join(storageRoot, "shared-clip.mp4");
    writeFileSync(sharedPath, "shared");
    replayClipsRepository.upsert(
      createReplayClip({
        id: "selected-clip",
        processedClipPath: sharedPath,
        sourceGame: "poe1",
        sourceLeague: "Keepers",
      }),
    );
    replayClipsRepository.upsert(
      createReplayClip({
        id: "remaining-clip",
        processedClipPath: sharedPath,
        sourceGame: "poe2",
        sourceLeague: "Standard",
      }),
    );

    await expect(
      new StorageService().deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).resolves.toMatchObject({
      success: true,
      deletedClipCount: 1,
      freedBytes: 0,
    });
    expect(existsSync(sharedPath)).toBe(true);
    expect(replayClipsRepository.get("selected-clip")).toBeNull();
    expect(replayClipsRepository.get("remaining-clip")).not.toBeNull();
  });

  it("does not delete a new league clip added while existing files are staged", async () => {
    const selectedPath = join(storageRoot, "2026-06-12_10-30-00-death-10s.mp4");
    const newPath = join(storageRoot, "2026-06-12_10-31-00-death-10s.mp4");
    writeFileSync(selectedPath, "selected");
    replayClipsRepository.upsert(
      createReplayClip({
        id: "selected-clip",
        processedClipPath: selectedPath,
        sourceGame: "poe1",
        sourceLeague: "Keepers",
      }),
    );
    const service = new StorageService();
    const serviceRepository = (
      service as unknown as { replayClipsRepository: ReplayClipsRepository }
    ).replayClipsRepository;
    const listStoragePaths =
      serviceRepository.listStoragePaths.bind(serviceRepository);
    vi.spyOn(serviceRepository, "listStoragePaths").mockImplementationOnce(
      () => {
        const paths = listStoragePaths();
        writeFileSync(newPath, "new");
        replayClipsRepository.upsert(
          createReplayClip({
            id: "new-clip",
            processedClipPath: newPath,
            sourceGame: "poe1",
            sourceLeague: "Keepers",
          }),
        );
        return paths;
      },
    );

    await expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).resolves.toMatchObject({ success: true, deletedClipCount: 1 });

    expect(existsSync(selectedPath)).toBe(false);
    expect(existsSync(newPath)).toBe(true);
    expect(replayClipsRepository.get("selected-clip")).toBeNull();
    expect(replayClipsRepository.get("new-clip")).not.toBeNull();
  });

  it("deletes filesystem-only full recordings assigned to the active game league", async () => {
    const fullRecordingDirectory = join(storageRoot, "Full Recordings");
    mkdirSync(fullRecordingDirectory);
    const recordingPath = join(fullRecordingDirectory, "orphan-run.mp4");
    writeFileSync(recordingPath, "recording");
    const service = new StorageService();

    await expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).resolves.toEqual({
      success: true,
      freedBytes: 9,
      deletedClipCount: 0,
      deletedRecordingCount: 1,
    });
    expect(existsSync(recordingPath)).toBe(false);
  });

  it("blocks deleting the active recording league", async () => {
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => mockRecorderStatus({ runRecordingActive: true }),
    } as unknown as ManagedRecorderService);
    const service = new StorageService();

    await expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).resolves.toMatchObject({
      success: false,
      error: "Stop the active recording before deleting this league data",
    });
  });

  it("returns a cleanup warning when file deletion fails after row deletion", async () => {
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

    const clipPath = join(storageRoot, "2026-06-12_10-30-00-death-10s.mp4");
    writeFileSync(clipPath, "clip");
    let resetDynamicDatabase: () => void = () => {};
    try {
      const { DatabaseService: MockedDatabaseService } = await import(
        "~/main/modules/database"
      );
      resetDynamicDatabase = () => MockedDatabaseService.resetForTests();
      const { mockIpcMainHandlers: mockDynamicIpcMainHandlers } = await import(
        "~/main/test/ipc"
      );
      const { SettingsStoreService: MockedSettingsStoreService } = await import(
        "~/main/modules/settings-store"
      );
      const { ManagedRecorderService: MockedManagedRecorderService } =
        await import("~/main/modules/managed-recorder");
      const { ReplayClipsRepository: MockedReplayClipsRepository } =
        await import("~/main/modules/replay-clips/ReplayClips.repository");
      const { StorageService: MockedStorageService } = await import(
        "../Storage.service"
      );
      const mockedDatabase = MockedDatabaseService.getInstance(
        join(root, "mocked-hinekora.sqlite"),
      );
      const mockedReplayRepository = new MockedReplayClipsRepository(
        mockedDatabase,
      );
      mockDynamicIpcMainHandlers();
      vi.spyOn(MockedSettingsStoreService, "getInstance").mockReturnValue({
        get: () => ({
          ...createDefaultSettings(),
          recordingStoragePath: storageRoot,
          activeGame: "poe1",
          activeLeague: "Keepers",
        }),
      } as unknown as typeof MockedSettingsStoreService.prototype);
      vi.spyOn(MockedManagedRecorderService, "getInstance").mockReturnValue({
        getStatus: () => mockRecorderStatus(),
      } as unknown as typeof MockedManagedRecorderService.prototype);
      mockedReplayRepository.upsert(
        createReplayClip({
          processedClipPath: clipPath,
          sourceGame: "poe1",
          sourceLeague: "Keepers",
        }),
      );
      const service = new MockedStorageService();

      await expect(
        service.deleteGameLeagueData({
          game: "poe1",
          leagueName: "Keepers",
        }),
      ).resolves.toEqual({
        success: true,
        cleanupError: "Failed to delete one or more files",
        freedBytes: 0,
        failedFileCount: 1,
        deletedClipCount: 1,
        deletedRecordingCount: 0,
      });
      expect(existsSync(clipPath)).toBe(false);
      expect(mockedReplayRepository.listAll()).toEqual([]);
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("node:fs/promises");
      vi.resetModules();
    }
  });

  it("returns a safe delete result when repository access fails", async () => {
    vi.spyOn(ReplayClipsRepository.prototype, "listAll").mockImplementation(
      () => {
        throw new Error("repository failed");
      },
    );
    const service = new StorageService();

    await expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).resolves.toEqual({
      success: false,
      freedBytes: 0,
      deletedClipCount: 0,
      deletedRecordingCount: 0,
      error: "repository failed",
    });
  });

  it("leaves managed files and rows intact when league row deletion fails", async () => {
    const clipPath = join(storageRoot, "2026-06-12_10-30-00-death-10s.mp4");
    const recordingPath = join(storageRoot, "2026-06-12_11-00-00.mp4");
    writeFileSync(clipPath, "clip");
    writeFileSync(recordingPath, "recording");
    replayClipsRepository.upsert(
      createReplayClip({
        processedClipPath: clipPath,
        sourceGame: "poe1",
        sourceLeague: "Keepers",
      }),
    );
    recordingStorageRepository.upsertRunRecording({
      path: recordingPath,
      sourceGame: "poe1",
      sourceLeague: "Keepers",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T12:00:00.000Z",
    });
    vi.spyOn(database, "transaction").mockImplementation(() => {
      throw new Error("database delete failed");
    });
    const service = new StorageService();

    await expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).resolves.toEqual({
      success: false,
      freedBytes: 0,
      deletedClipCount: 0,
      deletedRecordingCount: 0,
      error: "database delete failed",
    });
    expect(existsSync(clipPath)).toBe(true);
    expect(existsSync(recordingPath)).toBe(true);
    expect(replayClipsRepository.listAll()).toHaveLength(1);
    expect(recordingStorageRepository.listRunRecordings()).toHaveLength(1);
  });

  it("reveals resolved storage paths", () => {
    const exportRoot = resolve(root, "videos", "Hinekora Exports");
    mkdirSync(exportRoot, { recursive: true });
    const service = new StorageService();

    expect(service.revealPaths()).toEqual({
      storagePath: resolve(storageRoot),
      exportStoragePath: exportRoot,
      exportStorageVolumes: [
        {
          id: expect.stringMatching(/^storage-volume-/),
          path: exportRoot,
        },
      ],
      databasePath: database.path,
    });
  });

  it("deletes zero-size clip rows without counting zero-byte media", async () => {
    const emptyClipPath = resolve(
      join(storageRoot, "2026-06-12_10-30-00-death-10s.mp4"),
    );
    writeFileSync(emptyClipPath, "");
    replayClipsRepository.upsert(
      createReplayClip({
        processedClipPath: emptyClipPath,
        sourceGame: "poe1",
        sourceLeague: "Keepers",
      }),
    );
    const service = new StorageService();

    await expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).resolves.toEqual({
      success: true,
      freedBytes: 0,
      deletedClipCount: 1,
      deletedRecordingCount: 0,
    });
    expect(existsSync(emptyClipPath)).toBe(false);
    expect(replayClipsRepository.listAll()).toEqual([]);
  });

  it("registers IPC handlers with bounded delete input", async () => {
    const service = new StorageService();
    vi.spyOn(service, "getInfo").mockResolvedValue({
      storagePath: "C:\\**\\Hinekora Recordings",
      appInstallationSizeBytes: 7,
      recordingsSizeBytes: 0,
      recordingUsageTruncated: false,
      exportStorageVolumes: [],
      exportVideosUsageTruncated: false,
      rewindBufferEstimateBytes: 60_000_000,
      temporarySizeBytes: 0,
      databaseSizeBytes: 0,
      totalTrackedSizeBytes: 0,
      diskTotalBytes: 0,
      diskFreeBytes: 0,
      appInstallationOnStorageDrive: false,
      databaseOnStorageDrive: false,
      breakdown: [],
      calculatedAt: "2026-06-12T10:00:00.000Z",
    });
    vi.spyOn(service, "getGameLeagueUsage").mockResolvedValue([]);
    vi.spyOn(service, "revealPaths").mockReturnValue({
      storagePath: resolve(storageRoot),
      exportStoragePath: resolve(root, "videos", "Hinekora Exports"),
      exportStorageVolumes: [],
      databasePath: database.path,
    });
    vi.spyOn(service, "deleteGameLeagueData").mockResolvedValue({
      success: true,
      freedBytes: 0,
      deletedClipCount: 0,
      deletedRecordingCount: 0,
    });

    expect(await ipcHandlers.get(StorageChannel.GetInfo)?.({})).toMatchObject({
      storagePath: "C:\\**\\Hinekora Recordings",
    });
    expect(
      await ipcHandlers.get(StorageChannel.GetGameLeagueUsage)?.({}),
    ).toEqual([]);
    expect(await ipcHandlers.get(StorageChannel.RevealPaths)?.({})).toEqual({
      storagePath: resolve(storageRoot),
      exportStoragePath: resolve(root, "videos", "Hinekora Exports"),
      exportStorageVolumes: [],
      databasePath: database.path,
    });
    expect(
      await ipcHandlers.get(StorageChannel.DeleteGameLeagueData)?.(
        {},
        { game: "poe1", leagueName: "Keepers" },
      ),
    ).toEqual({
      success: true,
      freedBytes: 0,
      deletedClipCount: 0,
      deletedRecordingCount: 0,
    });
    expect(
      await ipcHandlers.get(StorageChannel.DeleteGameLeagueData)?.(
        {},
        { game: "poe3", leagueName: "Keepers" },
      ),
    ).toMatchObject({
      success: false,
      error: "game must be poe1 or poe2",
    });
  });
});

async function serviceUsageSummary(service: StorageService) {
  return (await service.getGameLeagueUsage()).map((item) => [
    item.game,
    item.leagueName,
    item.clipCount,
    item.estimatedSizeBytes,
  ]);
}
