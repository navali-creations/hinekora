import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
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
import * as FileClipboard from "~/main/utils/file-clipboard";

import { createDefaultSettings } from "~/types";
import { DatabaseService } from "../../database";
import { ReplayClipsRepository } from "../../replay-clips/ReplayClips.repository";
import { SettingsStoreService } from "../../settings-store";
import { RecordingStorageChannel } from "../RecordingStorage.channels";
import { RecordingStorageRepository } from "../RecordingStorage.repository";
import { RecordingStorageService } from "../RecordingStorage.service";

const electronMocks = vi.hoisted(() => ({
  getPath: vi.fn(),
  openPath: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
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

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hinekora-recording-storage-"));
  database = DatabaseService.getInstance(join(root, "hinekora.sqlite"));
  replayClipsRepository = new ReplayClipsRepository(database);
  repository = new RecordingStorageRepository(database);
  openPath = vi.fn<(path: string) => Promise<string>>().mockResolvedValue("");
  showItemInFolder = vi.fn<(path: string) => void>();
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
  electronMocks.getPath.mockReset();
  electronMocks.openPath.mockReset();
  electronMocks.showItemInFolder.mockReset();
  vi.restoreAllMocks();
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

  it("separates replay clip size from run recording size", () => {
    const runPath = join(root, "2026-06-12_10-30-00.mp4");
    const clipPath = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    writeFileSync(runPath, "run");
    writeFileSync(clipPath, "clip");
    replayClipsRepository.upsert(
      createReplayClip({ processedClipPath: clipPath, sizeBytes: 4 }),
    );

    expect(service.getUsage()).toMatchObject({
      storageDirectory: resolve(root),
      clipsSizeBytes: 4,
      recordingsSizeBytes: 3,
      diskWarningThresholdBytes: 1024 ** 3,
    });
    expect(service.getUsage().databaseSizeBytes).toBeGreaterThan(0);
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

    expect(service.listRecordings()).toEqual(
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

    const recordings = service.listRecordings();
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
    writeFileSync(alphaPath, "alpha");
    writeFileSync(betaPath, "beta-recording");
    writeFileSync(gammaPath, "gamma");
    writeFileSync(orphanPath, "orphan");
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
    expect(service.deleteRecording(validPath)).toEqual({
      ok: true,
      error: null,
    });
    expect(service.deleteRecording(invalidPath)).toEqual({
      ok: false,
      error: "Recording file is not available",
    });
    expect(
      service.deleteRecording(join(root, "2026-06-12_12-00-00.mp4")),
    ).toEqual({
      ok: false,
      error: "Recording file is not available",
    });
    expect(existsSync(validPath)).toBe(false);
    expect(existsSync(invalidPath)).toBe(true);
    expect(openPath).toHaveBeenCalledTimes(1);
    expect(openPath).toHaveBeenCalledWith(resolve(validPath));
    expect(showItemInFolder).toHaveBeenCalledWith(resolve(validPath));
  });

  it("deletes stale run recording metadata", () => {
    const missingPath = join(root, "2026-06-12_11-00-00.mp4");
    repository.upsertRunRecording({
      path: missingPath,
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T12:00:00.000Z",
    });

    expect(service.deleteRecording(missingPath)).toEqual({
      ok: true,
      error: null,
    });
    expect(repository.getByPath(missingPath)).toBeNull();
  });

  it("reports recording file cleanup failures after deleting metadata", async () => {
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

      expect(mockedService.deleteRecording(validPath)).toEqual({
        ok: true,
        error: null,
        cleanupError: "unlink failed",
      });
      expect(existsSync(validPath)).toBe(true);
      expect(mockedRepository.getByPath(validPath)).toBeNull();

      mockedRepository.upsertRunRecording({
        path: validPath,
        sourceGame: "poe2",
        sourceLeague: "Hardcore",
        startedAt: "2026-06-12T10:30:00.000Z",
        stoppedAt: "2026-06-12T11:30:00.000Z",
      });
      expect(mockedService.deleteManyRecordings([validPath])).toEqual({
        ok: true,
        error: null,
        deletedPaths: [validPath],
        failed: [],
        cleanupErrors: [{ path: validPath, error: "unlink failed" }],
      });
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  });

  it("deletes many recordings with per-path failures", () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    const invalidPath = join(root, "boss-fight.mp4");
    writeFileSync(validPath, "run");
    writeFileSync(invalidPath, "run");

    expect(service.deleteManyRecordings([validPath, invalidPath])).toEqual({
      ok: false,
      error: "Some recordings could not be deleted",
      deletedPaths: [validPath],
      failed: [{ path: invalidPath, error: "Recording file is not available" }],
    });
    expect(existsSync(validPath)).toBe(false);
    expect(existsSync(invalidPath)).toBe(true);
  });

  it("deletes many recordings without failures", () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(validPath, "run");

    expect(service.deleteManyRecordings([validPath])).toEqual({
      ok: true,
      error: null,
      deletedPaths: [validPath],
      failed: [],
    });
    expect(existsSync(validPath)).toBe(false);
  });

  it("uses a fallback error for batch delete failures without details", () => {
    vi.spyOn(service, "deleteRecording").mockReturnValue({
      ok: false,
      error: null,
    });

    expect(service.deleteManyRecordings(["2026-06-12_10-30-00.mp4"])).toEqual({
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

  it("returns safe errors when delete throws", () => {
    const validPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(validPath, "run");
    vi.spyOn(
      RecordingStorageRepository.prototype,
      "deleteRunRecordingByPath",
    ).mockImplementation(() => {
      throw new Error("delete failed");
    });
    const failingService = new RecordingStorageService();

    expect(failingService.deleteRecording(validPath)).toEqual({
      ok: false,
      error: "delete failed",
    });
    expect(existsSync(validPath)).toBe(true);
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

  it("reports cleanup usage without deleting when storage limit is disabled", () => {
    const clipPath = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    const sessionDirectory = join(root, "Hinekora-2026-06-12_10-30-00");
    const oldPath = join(sessionDirectory, "old.mkv");
    mkdirSync(sessionDirectory);
    writeFileSync(clipPath, "clip");
    writeFileSync(oldPath, "run");
    replayClipsRepository.upsert(
      createReplayClip({ processedClipPath: clipPath }),
    );

    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 0,
      }),
    } as unknown as SettingsStoreService);

    expect(service.cleanup()).toEqual({
      deletedCount: 0,
      freedBytes: 0,
      limitBytes: 0,
      usageBytes: 3,
    });
  });

  it("deletes unprotected managed recordings when usage exceeds the limit", () => {
    const oldDirectory = join(root, "Hinekora-2026-06-12_10-30-00");
    const oldPath = join(oldDirectory, "2026-06-12_10-30-00.mkv");
    const clipPath = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    mkdirSync(oldDirectory);
    writeFileSync(oldPath, "old-run");
    writeFileSync(clipPath, "clip");
    replayClipsRepository.upsert(
      createReplayClip({ processedClipPath: clipPath }),
    );
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
        recordingMaxStorageGb: 0.000000001,
      }),
    } as unknown as SettingsStoreService);

    expect(service.cleanup({ protectedPaths: [clipPath] })).toMatchObject({
      deletedCount: 1,
      freedBytes: 7,
    });
    expect(existsSync(oldPath)).toBe(false);
    expect(existsSync(clipPath)).toBe(true);
    expect(existsSync(oldDirectory)).toBe(false);
  });

  it("logs and continues when cleanup cannot delete a selected path", async () => {
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

      expect(mockedService.cleanup()).toMatchObject({
        deletedCount: 0,
        freedBytes: 0,
        usageBytes: 3,
      });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "WARN [recording-storage] Failed to delete recording file",
        ),
        expect.objectContaining({ recordingFile: "2026-06-12_10-30-00.mp4" }),
      );
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  });

  it("keeps recordings protected by directory during cleanup", () => {
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

    expect(
      service.cleanup({ protectedDirectories: [protectedDirectory] }),
    ).toMatchObject({
      deletedCount: 0,
      freedBytes: 0,
      usageBytes: 0,
    });
    expect(existsSync(protectedPath)).toBe(true);
  });

  it("deletes missing replay clip rows during cleanup", () => {
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

    expect(service.cleanup()).toMatchObject({ deletedCount: 1 });
    expect(service.getUsage()).toEqual(
      expect.objectContaining({ clipsSizeBytes: 0 }),
    );
    expect(replayClipsRepository.get("missing-clip")).toBeNull();
  });

  it("registers IPC handlers with validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    const ipcService = new RecordingStorageService();
    vi.spyOn(ipcService, "getUsage").mockReturnValue({
      storageDirectory: root,
      databasePath: ":memory:",
      clipsSizeBytes: 0,
      recordingsSizeBytes: 0,
      databaseSizeBytes: 0,
      totalTrackedSizeBytes: 0,
      diskTotalBytes: 0,
      diskFreeBytes: 0,
      diskWarningThresholdBytes: 1024 ** 3,
      lowDiskSpace: false,
      calculatedAt: "2026-06-12T10:00:00.000Z",
    });
    vi.spyOn(ipcService, "listRecordings").mockReturnValue([]);
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
    vi.spyOn(ipcService, "deleteRecording").mockReturnValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "deleteManyRecordings").mockReturnValue({
      ok: true,
      error: null,
      deletedPaths: ["clip.mp4"],
      failed: [],
    });

    expect(await handlers.get(RecordingStorageChannel.GetUsage)?.({})).toEqual(
      expect.objectContaining({ storageDirectory: root }),
    );
    expect(
      await handlers.get(RecordingStorageChannel.ListRecordings)?.({}),
    ).toEqual([]);
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
