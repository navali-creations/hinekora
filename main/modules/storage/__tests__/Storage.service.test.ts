import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { RecordingStorageRepository } from "~/main/modules/recording-storage/RecordingStorage.repository";
import { ReplayClipsRepository } from "~/main/modules/replay-clips/ReplayClips.repository";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createReplayClip } from "~/main/test/factories/replayClip";
import { mockIpcMainHandlers } from "~/main/test/ipc";

import type { ManagedRecorderStatus } from "~/types";
import { createDefaultSettings } from "~/types";
import { StorageChannel } from "../Storage.channels";
import { StorageService } from "../Storage.service";

const electronMocks = vi.hoisted(() => ({
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
  electronMocks.getAppPath.mockReset();
  electronMocks.getPath.mockReset();
  electronMocks.isPackaged = false;
  RecordingStorageService.resetForTests();
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

  it("reports disk usage and game league usage from managed media", () => {
    const deathClipDirectory = join(storageRoot, "Death Clips");
    const fullRecordingDirectory = join(storageRoot, "Full Recordings");
    const manualReplayDirectory = join(storageRoot, "Manual Replays");
    mkdirSync(deathClipDirectory);
    mkdirSync(fullRecordingDirectory);
    mkdirSync(manualReplayDirectory);
    const clipPath = join(deathClipDirectory, "death.mp4");
    const recordingPath = join(fullRecordingDirectory, "recording.mp4");
    const manualReplayPath = join(manualReplayDirectory, "manual.mp4");
    const temporaryPath = join(storageRoot, "recording.tmp");
    writeFileSync(clipPath, "clip");
    writeFileSync(recordingPath, "recording");
    writeFileSync(manualReplayPath, "manual");
    writeFileSync(temporaryPath, "temporary");
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

    expect(service.getInfo()).toEqual(
      expect.objectContaining({
        appInstallationSizeBytes: 7,
        mediaSizeBytes: 19,
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
            category: "temporary-files",
            fileCount: 1,
            sizeBytes: 9,
          }),
        ]),
      }),
    );
    expect(service.getInfo()).toEqual(
      expect.objectContaining({
        appInstallationSizeBytes: 7,
      }),
    );
    expect(service.getGameLeagueUsage()).toEqual([
      expect.objectContaining({
        game: "poe1",
        leagueName: "Keepers",
        clipCount: 2,
        recordingCount: 1,
        estimatedSizeBytes: 19,
      }),
    ]);
  });

  it("rebases replay clip rows before reporting migrated manual replay storage", () => {
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

    expect(service.getInfo()).toEqual(
      expect.objectContaining({
        mediaSizeBytes: 6,
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

  it("uses the packaged executable directory for app installation size", () => {
    electronMocks.isPackaged = true;
    const service = new StorageService();

    expect(service.getInfo()).toEqual(
      expect.objectContaining({
        appInstallationSizeBytes: expect.any(Number),
      }),
    );
  });

  it("ignores missing clip files while collecting storage info", () => {
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

    expect(service.getInfo().mediaSizeBytes).toBe(0);
  });

  it("counts filesystem-only full recordings in the active game league", () => {
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

    expect(service.getInfo().breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "temporary-files",
          fileCount: 0,
          sizeBytes: 0,
        }),
      ]),
    );
    expect(service.getGameLeagueUsage()).toEqual([
      expect.objectContaining({
        game: "poe1",
        leagueName: "Keepers",
        clipCount: 0,
        recordingCount: 1,
        estimatedSizeBytes: 3,
      }),
    ]);
  });

  it("counts duplicate clip paths once and sorts equal-size usage buckets", () => {
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

    expect(serviceUsageSummary(new StorageService())).toEqual([
      ["poe1", "Keepers", 2, 4],
      ["poe1", "Alpha", 1, 0],
      ["poe1", "Beta", 1, 0],
      ["poe2", "Alpha", 1, 0],
    ]);
  });

  it("does not double-count run recordings already counted as clips", () => {
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

    expect(service.getGameLeagueUsage()).toEqual([
      expect.objectContaining({
        clipCount: 1,
        estimatedSizeBytes: 4,
        recordingCount: 0,
      }),
    ]);
  });

  it("counts metadata-only run recordings and active recording usage", () => {
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

    expect(new StorageService().getGameLeagueUsage()).toEqual([
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

  it("reports zero app and database disk metadata for unavailable paths", () => {
    DatabaseService.resetForTests();
    database = DatabaseService.getInstance(":memory:");
    electronMocks.getAppPath.mockImplementation(() => {
      throw new Error("app path unavailable");
    });
    const service = new StorageService();

    expect(service.getInfo()).toEqual(
      expect.objectContaining({
        appInstallationSizeBytes: 0,
        appInstallationDiskTotalBytes: 0,
        appInstallationDiskFreeBytes: 0,
        databaseSizeBytes: 0,
        databaseDiskTotalBytes: 0,
        databaseDiskFreeBytes: 0,
      }),
    );
    expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).toMatchObject({ success: true });
  });

  it("deletes selected game league rows and managed files", () => {
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

    expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).toEqual({
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

  it("deletes filesystem-only full recordings assigned to the active game league", () => {
    const fullRecordingDirectory = join(storageRoot, "Full Recordings");
    mkdirSync(fullRecordingDirectory);
    const recordingPath = join(fullRecordingDirectory, "orphan-run.mp4");
    writeFileSync(recordingPath, "recording");
    const service = new StorageService();

    expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).toEqual({
      success: true,
      freedBytes: 9,
      deletedClipCount: 0,
      deletedRecordingCount: 1,
    });
    expect(existsSync(recordingPath)).toBe(false);
  });

  it("blocks deleting the active recording league", () => {
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => mockRecorderStatus({ runRecordingActive: true }),
    } as unknown as ManagedRecorderService);
    const service = new StorageService();

    expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).toMatchObject({
      success: false,
      error: "Stop the active recording before deleting this league data",
    });
  });

  it("returns a cleanup warning when file deletion fails after row deletion", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.resetModules();
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();

      return {
        ...actual,
        unlinkSync: vi.fn(() => {
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

      expect(
        service.deleteGameLeagueData({
          game: "poe1",
          leagueName: "Keepers",
        }),
      ).toEqual({
        success: true,
        cleanupError: "Failed to delete one or more files",
        freedBytes: 0,
        failedFileCount: 1,
        deletedClipCount: 1,
        deletedRecordingCount: 0,
      });
      expect(existsSync(clipPath)).toBe(true);
      expect(mockedReplayRepository.listAll()).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("WARN [storage] Failed to delete storage file"),
        expect.objectContaining({ error: expect.any(String) }),
      );
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  });

  it("returns a safe delete result when repository access fails", () => {
    vi.spyOn(ReplayClipsRepository.prototype, "listAll").mockImplementation(
      () => {
        throw new Error("repository failed");
      },
    );
    const service = new StorageService();

    expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).toEqual({
      success: false,
      freedBytes: 0,
      deletedClipCount: 0,
      deletedRecordingCount: 0,
      error: "repository failed",
    });
  });

  it("leaves managed files and rows intact when league row deletion fails", () => {
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

    expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).toEqual({
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

  it("checks disk space and reveals resolved storage paths", async () => {
    vi.resetModules();
    vi.doMock("../Storage.files", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../Storage.files")>();

      return {
        ...actual,
        calculateDiskUsage: vi
          .fn()
          .mockReturnValueOnce({
            freeBytes: 512 * 1024 ** 2,
            totalBytes: 10,
          })
          .mockReturnValueOnce({ freeBytes: 0, totalBytes: 10 }),
      };
    });

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
      const { StorageService: MockedStorageService } = await import(
        "../Storage.service"
      );
      const mockedDatabase = MockedDatabaseService.getInstance(
        join(root, "mocked-hinekora.sqlite"),
      );
      mockDynamicIpcMainHandlers();
      vi.spyOn(MockedSettingsStoreService, "getInstance").mockReturnValue({
        get: () => ({
          ...createDefaultSettings(),
          recordingStoragePath: storageRoot,
        }),
      } as unknown as typeof MockedSettingsStoreService.prototype);
      const service = new MockedStorageService();

      expect(service.checkDiskSpace()).toEqual({
        diskFreeBytes: 512 * 1024 ** 2,
        isLow: true,
      });
      expect(service.checkDiskSpace()).toEqual({
        diskFreeBytes: 0,
        isLow: false,
      });
      expect(service.revealPaths()).toEqual({
        storagePath: resolve(storageRoot),
        databasePath: mockedDatabase.path,
      });
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("../Storage.files");
      vi.resetModules();
    }
  });

  it("deletes zero-size clip rows without counting zero-byte media", () => {
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

    expect(
      service.deleteGameLeagueData({
        game: "poe1",
        leagueName: "Keepers",
      }),
    ).toEqual({
      success: true,
      freedBytes: 0,
      deletedClipCount: 1,
      deletedRecordingCount: 0,
    });
    expect(existsSync(emptyClipPath)).toBe(true);
    expect(replayClipsRepository.listAll()).toEqual([]);
  });

  it("registers IPC handlers with bounded delete input", async () => {
    const service = new StorageService();
    vi.spyOn(service, "getInfo").mockReturnValue({
      storagePath: "C:\\**\\Hinekora Recordings",
      appInstallationSizeBytes: 7,
      mediaSizeBytes: 0,
      rewindBufferEstimateBytes: 60_000_000,
      temporarySizeBytes: 0,
      databaseSizeBytes: 0,
      totalTrackedSizeBytes: 0,
      diskTotalBytes: 0,
      diskFreeBytes: 0,
      appInstallationDiskTotalBytes: 0,
      appInstallationDiskFreeBytes: 0,
      databaseDiskTotalBytes: 0,
      databaseDiskFreeBytes: 0,
      breakdown: [],
      calculatedAt: "2026-06-12T10:00:00.000Z",
    });
    vi.spyOn(service, "getGameLeagueUsage").mockReturnValue([]);
    vi.spyOn(service, "checkDiskSpace").mockReturnValue({
      diskFreeBytes: 0,
      isLow: false,
    });
    vi.spyOn(service, "revealPaths").mockReturnValue({
      storagePath: resolve(storageRoot),
      databasePath: database.path,
    });
    vi.spyOn(service, "deleteGameLeagueData").mockReturnValue({
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
    expect(await ipcHandlers.get(StorageChannel.CheckDiskSpace)?.({})).toEqual({
      diskFreeBytes: 0,
      isLow: false,
    });
    expect(await ipcHandlers.get(StorageChannel.RevealPaths)?.({})).toEqual({
      storagePath: resolve(storageRoot),
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

function serviceUsageSummary(service: StorageService) {
  return service
    .getGameLeagueUsage()
    .map((item) => [
      item.game,
      item.leagueName,
      item.clipCount,
      item.estimatedSizeBytes,
    ]);
}
