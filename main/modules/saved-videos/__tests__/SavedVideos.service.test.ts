import { type PathLike, type Stats, symlinkSync } from "node:fs";
import {
  mkdir,
  opendir,
  readFile,
  rm as removePath,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn<() => unknown[]>(() => []),
  getPath: vi.fn(),
  ipcMainHandle: vi.fn(),
  openPath: vi.fn(),
  showItemInFolder: vi.fn(),
}));
const fsMocks = vi.hoisted(() => ({
  rm: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: electronMocks.getPath },
  BrowserWindow: { getAllWindows: electronMocks.getAllWindows },
  ipcMain: { handle: electronMocks.ipcMainHandle },
  shell: {
    openPath: electronMocks.openPath,
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  fsMocks.rm.mockImplementation(actual.rm);
  return { ...actual, rm: fsMocks.rm };
});

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import * as appLog from "~/main/utils/app-log";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import { type AppSettings, createDefaultSettings } from "~/types";
import type { EditorExportOwnershipRepository } from "../../editor/EditorExportOwnership.repository";
import { SavedVideosChannel } from "../SavedVideos.channels";
import { SavedVideosService } from "../SavedVideos.service";
import {
  validateSavedVideoId,
  validateSavedVideosLibraryQuery,
} from "../SavedVideos.validation";

let root: string;
let videosPath: string;
let recordingStorageRoot: string;
let exportRoot: string;
let settings: AppSettings;
let settingsListener: ((settings: AppSettings) => void) | null;
const noteUsageDelta = vi.fn();
const getUsage = vi.fn();
const settingsUnsubscribe = vi.fn();
const GIGABYTE = 1024 ** 3;

beforeEach(async () => {
  root = join(tmpdir(), `hinekora-saved-videos-${crypto.randomUUID()}`);
  videosPath = join(root, "videos");
  recordingStorageRoot = join(root, "recordings");
  exportRoot = join(videosPath, "Hinekora Exports");
  await Promise.all([
    mkdir(exportRoot, { recursive: true }),
    mkdir(join(videosPath, "Hinekora", "Exports"), { recursive: true }),
    mkdir(join(recordingStorageRoot, "Saved Edits"), { recursive: true }),
  ]);
  settings = {
    ...createDefaultSettings(),
    editorExportStoragePath: exportRoot,
    recordingStoragePath: recordingStorageRoot,
  };
  settingsListener = null;
  settingsUnsubscribe.mockReset();
  noteUsageDelta.mockReset();
  getUsage.mockReset();
  getUsage.mockResolvedValue({
    clipsSizeBytes: 0,
    diskFreeBytes: 100 * GIGABYTE,
    exportVideosSizeBytes: 0,
    exportVideosUsageTruncated: false,
    lowDiskSpace: false,
    recordingsSizeBytes: 0,
  });
  electronMocks.getPath.mockReset();
  electronMocks.getPath.mockReturnValue(videosPath);
  electronMocks.getAllWindows.mockReset();
  electronMocks.getAllWindows.mockReturnValue([]);
  electronMocks.openPath.mockReset();
  electronMocks.openPath.mockResolvedValue("");
  electronMocks.showItemInFolder.mockReset();
  electronMocks.ipcMainHandle.mockReset();
  fsMocks.rm.mockClear();
  vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
    get: () => settings,
    onDidChange: (listener: (next: AppSettings) => void) => {
      settingsListener = listener;
      return settingsUnsubscribe;
    },
  } as unknown as SettingsStoreService);
  vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
    getUsage,
    noteUsageDelta,
  } as unknown as RecordingStorageService);
});

afterEach(async () => {
  SavedVideosService.resetForTests();
  clearIpcWindowRolesForTests();
  vi.restoreAllMocks();
  await removePath(root, { force: true, recursive: true });
});

describe("SavedVideosService", () => {
  it("creates and resets the singleton service", () => {
    mockIpcMainHandlers();

    const first = SavedVideosService.getInstance();
    expect(SavedVideosService.getInstance()).toBe(first);

    SavedVideosService.resetForTests();
    expect(settingsUnsubscribe).toHaveBeenCalledOnce();
    expect(SavedVideosService.getInstance()).not.toBe(first);
  });

  it("supports settings stores without change subscriptions", () => {
    vi.mocked(SettingsStoreService.getInstance).mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);

    expect(() => new SavedVideosService()).not.toThrow();
  });

  it("lists current and legacy export videos with cached bounded paging", async () => {
    const activePath = join(exportRoot, "Zulu.mp4");
    const legacyPath = join(videosPath, "Hinekora", "Exports", "Alpha.mp4");
    const previousPath = join(
      recordingStorageRoot,
      "Saved Edits",
      "Middle.mp4",
    );
    await Promise.all([
      writeFile(activePath, "123"),
      writeFile(legacyPath, "1"),
      writeFile(previousPath, "12"),
      writeFile(join(exportRoot, "ignored.txt"), "ignored"),
      mkdir(join(exportRoot, "nested")),
    ]);
    await utimes(activePath, new Date(1_000), new Date(1_000));
    await utimes(legacyPath, new Date(2_000), new Date(2_000));
    await utimes(previousPath, new Date(3_000), new Date(3_000));
    const service = SavedVideosService.getInstance();

    await expect(
      service.listLibrary({
        pageIndex: 0,
        pageSize: 2,
        sortBy: "fileName",
        sortDirection: "asc",
      }),
    ).resolves.toMatchObject({
      isTruncated: false,
      items: [{ fileName: "Alpha.mp4" }, { fileName: "Middle.mp4" }],
      pageCount: 2,
      pageIndex: 0,
      totalCount: 3,
    });
    await expect(
      service.listLibrary({
        pageIndex: 99,
        pageSize: 2,
        sortBy: "sizeBytes",
        sortDirection: "desc",
      }),
    ).resolves.toMatchObject({
      items: [{ fileName: "Alpha.mp4", sizeBytes: 1 }],
      pageIndex: 1,
    });

    await writeFile(join(exportRoot, "Cached.mp4"), "1234");
    await expect(service.listLibrary()).resolves.toMatchObject({
      totalCount: 3,
    });
    (
      service as unknown as { invalidateLibrary: () => void }
    ).invalidateLibrary();
    await expect(service.listLibrary()).resolves.toMatchObject({
      totalCount: 4,
    });

    settingsListener?.({ ...settings, activeLeague: "Standard" });
    await writeFile(join(exportRoot, "Still cached.mp4"), "12345");
    await expect(service.listLibrary()).resolves.toMatchObject({
      totalCount: 4,
    });

    const nextExportRoot = join(root, "next-exports");
    await mkdir(nextExportRoot);
    await writeFile(join(nextExportRoot, "Next.mp4"), "x");
    settings = { ...settings, editorExportStoragePath: nextExportRoot };
    settingsListener?.(settings);
    await expect(service.listLibrary()).resolves.toMatchObject({
      totalCount: 4,
    });
  });

  it("includes the source draft project for a registered export", async () => {
    const savedPath = join(exportRoot, "From draft.mp4");
    await writeFile(savedPath, "video");
    const stats = await stat(savedPath);
    const ownershipRepository = {
      list: vi.fn(() => [
        {
          deviceId: stats.dev,
          inode: stats.ino,
          modifiedAtMs: stats.mtimeMs,
          path: savedPath,
          projectId: "project-1",
          sizeBytes: stats.size,
        },
      ]),
      pruneStale: vi.fn(() => 0),
      remove: vi.fn(),
      upsert: vi.fn(),
    } as unknown as EditorExportOwnershipRepository;
    const service = new SavedVideosService({ ownershipRepository });

    await expect(service.listLibrary()).resolves.toMatchObject({
      items: [
        {
          fileName: "From draft.mp4",
          sourceProjectId: "project-1",
        },
      ],
      totalCount: 1,
    });
  });

  it("ignores unregistered custom-root videos and keeps registered exports visible", async () => {
    const customRoot = join(root, "custom-exports");
    const personalPath = join(customRoot, "Personal.mp4");
    const registeredPath = join(customRoot, "Registered.mp4");
    await mkdir(customRoot);
    await Promise.all([
      writeFile(personalPath, "personal"),
      writeFile(registeredPath, "registered"),
    ]);
    await Promise.all([
      utimes(personalPath, new Date(1_000), new Date(1_000)),
      utimes(registeredPath, new Date(2_000), new Date(2_000)),
    ]);
    settings = { ...settings, editorExportStoragePath: customRoot };
    const service = SavedVideosService.getInstance();

    await expect(service.listLibrary()).resolves.toMatchObject({
      totalCount: 0,
    });

    const newStats = await stat(registeredPath);
    SavedVideosService.noteExportCommitted({
      deviceId: newStats.dev,
      inode: newStats.ino,
      modifiedAtMs: newStats.mtimeMs,
      path: registeredPath,
      projectId: null,
      sizeDeltaBytes: newStats.size,
      sizeBytes: newStats.size,
    });
    await expect(service.listLibrary()).resolves.toMatchObject({
      items: [{ fileName: "Registered.mp4" }],
      totalCount: 1,
    });

    settings = {
      ...settings,
      editorExportStoragePath: join(root, "next-custom-exports"),
    };
    settingsListener?.(settings);
    await expect(service.listLibrary()).resolves.toMatchObject({
      items: [{ fileName: "Registered.mp4" }],
      totalCount: 1,
    });
  });

  it("does not delete unregistered videos from a custom export root", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    const customRoot = join(root, "personal-videos");
    const personalPath = join(customRoot, "Vacation.mp4");
    await mkdir(customRoot);
    await writeFile(personalPath, "personal");
    await utimes(personalPath, new Date(1_000), new Date(1_000));
    settings = { ...settings, editorExportStoragePath: customRoot };
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 2 * GIGABYTE,
      exportVideosUsageTruncated: false,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    const service = new SavedVideosService({
      statFile: createSizedStatFile(new Map([[personalPath, 2 * GIGABYTE]])),
    });

    await expect(service.cleanup()).resolves.toMatchObject({
      deletedCount: 0,
      failedCount: 0,
    });
    await expect(readFile(personalPath, "utf8")).resolves.toBe("personal");
    expect(noteUsageDelta).not.toHaveBeenCalled();
  });

  it("does not reread ownership records from cleanup abort checks", async () => {
    settings = {
      ...settings,
      editorExportMaxStorageGb: 1,
      editorExportStoragePath: join(root, "personal-videos"),
    };
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 2 * GIGABYTE,
      exportVideosUsageTruncated: false,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    const ownershipRepository = {
      list: vi.fn(() => []),
      pruneStale: vi.fn(() => 0),
      remove: vi.fn(),
      upsert: vi.fn(),
    } as unknown as EditorExportOwnershipRepository;
    const service = new SavedVideosService({
      createRetentionPlan: async (options) => {
        options.shouldAbort?.();
        options.shouldAbort?.();
        options.shouldAbort?.();
        return {
          files: [],
          hasMoreCandidates: false,
          isTruncated: false,
          targetUsageBytes: 0.95 * GIGABYTE,
          usageBytes: 2 * GIGABYTE,
        };
      },
      ownershipRepository,
    });

    await expect(service.cleanup()).resolves.toMatchObject({
      deletedCount: 0,
      failedCount: 0,
    });

    expect(ownershipRepository.list).toHaveBeenCalledTimes(3);
  });

  it("keeps registered custom-root exports visible through root aliases", async () => {
    const physicalRoot = join(root, "physical-exports");
    const aliasedRoot = join(root, "aliased-exports");
    await mkdir(physicalRoot);
    symlinkSync(
      physicalRoot,
      aliasedRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    const aliasedPath = join(aliasedRoot, "Aliased.mp4");
    await writeFile(aliasedPath, "video");
    settings = { ...settings, editorExportStoragePath: aliasedRoot };
    const service = SavedVideosService.getInstance();
    const stats = await stat(aliasedPath);

    SavedVideosService.noteExportCommitted({
      deviceId: stats.dev,
      inode: stats.ino,
      modifiedAtMs: stats.mtimeMs,
      path: aliasedPath,
      projectId: null,
      sizeDeltaBytes: stats.size,
      sizeBytes: stats.size,
    });

    await expect(service.listLibrary()).resolves.toMatchObject({
      items: [{ fileName: "Aliased.mp4" }],
      totalCount: 1,
    });
  });

  it("deduplicates physical root aliases and permits actions on canonical files", async () => {
    const legacyRoot = join(videosPath, "Hinekora", "Exports");
    const path = join(legacyRoot, "Aliased.mp4");
    await writeFile(path, "video");
    await removePath(exportRoot, { recursive: true });
    symlinkSync(
      legacyRoot,
      exportRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    const service = SavedVideosService.getInstance();

    const page = await service.listLibrary();

    expect(page).toMatchObject({ totalCount: 1 });
    await expect(service.open(page.items[0]!.id)).resolves.toEqual({
      error: null,
      ok: true,
    });
    expect(electronMocks.openPath).toHaveBeenCalledWith(path);
  });

  it("bounds scans, batches stat work, and resolves stable sort ties", async () => {
    await Promise.all([
      writeFile(join(exportRoot, "A.mp4"), "x"),
      writeFile(join(exportRoot, "B.mp4"), "x"),
      writeFile(join(exportRoot, "C.mp4"), "x"),
    ]);
    const service = new SavedVideosService({
      maxLibraryFiles: 2,
      openDirectory: opendir,
      removeFile: fsMocks.rm,
      scanBatchSize: 1,
      statFile: stat,
    });

    await expect(
      service.listLibrary({ sortBy: "sizeBytes", sortDirection: "asc" }),
    ).resolves.toMatchObject({ isTruncated: true, totalCount: 2 });
  });

  it("coalesces concurrent library scans", async () => {
    const path = join(exportRoot, "Pending.mp4");
    await writeFile(path, "x");
    const stats = await stat(path);
    let resolveStat!: (value: typeof stats) => void;
    const openDirectory = vi.fn(opendir);
    const service = new SavedVideosService({
      openDirectory,
      statFile: () =>
        new Promise((resolvePromise) => {
          resolveStat = resolvePromise;
        }),
    });

    const first = service.listLibrary();
    const second = service.listLibrary();
    await vi.waitFor(() => expect(resolveStat).toBeTypeOf("function"));
    resolveStat(stats);
    await Promise.all([first, second]);

    expect(openDirectory).toHaveBeenCalledTimes(3);
  });

  it("does not cache a scan invalidated while it is in flight", async () => {
    const path = join(exportRoot, "Pending.mp4");
    await writeFile(path, "x");
    const stats = await stat(path);
    let resolveStat!: (value: typeof stats) => void;
    let statCallCount = 0;
    const openDirectory = vi.fn(opendir);
    const service = new SavedVideosService({
      openDirectory,
      statFile: (statPath) => {
        statCallCount += 1;
        return statCallCount === 1
          ? new Promise((resolvePromise) => {
              resolveStat = resolvePromise;
            })
          : stat(statPath);
      },
    });

    const pending = service.listLibrary();
    await vi.waitFor(() => expect(resolveStat).toBeTypeOf("function"));
    settings = {
      ...settings,
      recordingStoragePath: join(root, "next-recordings"),
    };
    settingsListener?.(settings);
    resolveStat(stats);
    await pending;

    await service.listLibrary();
    expect(openDirectory).toHaveBeenCalledTimes(4);
  });

  it("publishes invalidations only to active main windows", () => {
    const mainWebContents = { id: 101, send: vi.fn() };
    const overlayWebContents = { id: 102, send: vi.fn() };
    const closedWebContents = {
      id: 104,
      isDestroyed: () => true,
      send: vi.fn(),
    };
    const failingWebContents = {
      id: 105,
      isDestroyed: () => false,
      send: vi.fn(() => {
        throw new Error("closed");
      }),
    };
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: mainWebContents },
      { isDestroyed: () => false, webContents: overlayWebContents },
      { isDestroyed: () => true, webContents: { id: 103, send: vi.fn() } },
      { isDestroyed: () => false, webContents: closedWebContents },
      { isDestroyed: () => false, webContents: failingWebContents },
    ]);
    registerIpcWindowRole(mainWebContents, WindowName.Main);
    registerIpcWindowRole(overlayWebContents, WindowName.AuraOverlay);
    registerIpcWindowRole(closedWebContents, WindowName.Main);
    registerIpcWindowRole(failingWebContents, WindowName.Main);
    SavedVideosService.getInstance();

    (
      SavedVideosService.getInstance() as unknown as {
        invalidateLibrary: () => void;
      }
    ).invalidateLibrary();

    expect(mainWebContents.send).toHaveBeenCalledWith(
      SavedVideosChannel.LibraryChanged,
    );
    expect(overlayWebContents.send).not.toHaveBeenCalled();
    expect(closedWebContents.send).not.toHaveBeenCalled();
    expect(logWarn).toHaveBeenCalledWith(
      "saved-videos",
      "Saved edit video library notification failed",
      { error: "closed" },
    );
  });

  it("handles missing roots and files that change while they are scanned", async () => {
    settings = {
      ...settings,
      editorExportStoragePath: join(root, "missing"),
      recordingStoragePath: join(root, "missing-recordings"),
    };
    electronMocks.getPath.mockReturnValue(join(root, "missing-videos"));
    await expect(new SavedVideosService().listLibrary()).resolves.toMatchObject(
      {
        totalCount: 0,
      },
    );

    electronMocks.getPath.mockReturnValue(videosPath);
    settings = {
      ...settings,
      editorExportStoragePath: exportRoot,
      recordingStoragePath: recordingStorageRoot,
    };
    const racePath = join(exportRoot, "Race.mp4");
    const directoryStatPath = join(exportRoot, "replacement");
    await writeFile(racePath, "x");
    await mkdir(directoryStatPath);
    const missingError = Object.assign(new Error("gone"), { code: "ENOENT" });
    const raceService = new SavedVideosService({
      statFile: async (path) => {
        if (String(path).endsWith("Race.mp4")) {
          throw missingError;
        }
        return stat(path);
      },
    });
    await expect(raceService.listLibrary()).resolves.toMatchObject({
      totalCount: 0,
    });

    const nonFileService = new SavedVideosService({
      statFile: async () => stat(directoryStatPath),
    });
    await expect(nonFileService.listLibrary()).resolves.toMatchObject({
      totalCount: 0,
    });

    const failedStatService = new SavedVideosService({
      statFile: async () => {
        throw Object.assign(new Error("locked"), { code: "EACCES" });
      },
    });
    await expect(failedStatService.listLibrary()).rejects.toThrow("locked");

    await removePath(exportRoot, { force: true, recursive: true });
    await writeFile(exportRoot, "file");
    settings = { ...settings, editorExportStoragePath: null };
    await expect(new SavedVideosService().listLibrary()).rejects.toThrow();
  });

  it("rescans after pruning stale export ownership records", async () => {
    const ownershipRepository = {
      list: vi.fn(() => []),
      pruneStale: vi.fn().mockReturnValueOnce(1).mockReturnValue(0),
      remove: vi.fn(),
      upsert: vi.fn(),
    } as unknown as EditorExportOwnershipRepository;
    const service = new SavedVideosService({ ownershipRepository });

    await expect(service.listLibrary()).resolves.toMatchObject({
      totalCount: 0,
    });

    expect(ownershipRepository.pruneStale).toHaveBeenCalledTimes(2);
  });

  it("isolates failed export commit side effects", () => {
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});
    const service = new SavedVideosService();
    const internals = service as unknown as {
      runCommitSideEffect: (message: string, action: () => void) => void;
    };

    expect(() =>
      internals.runCommitSideEffect("Export accounting failed", () => {
        throw new Error("accounting unavailable");
      }),
    ).not.toThrow();
    expect(logWarn).toHaveBeenCalledWith(
      "saved-videos",
      "Export accounting failed",
      { error: "accounting unavailable" },
    );
  });

  it("opens, reveals, deletes, and rejects unavailable videos", async () => {
    const videoPath = join(exportRoot, "Saved.mp4");
    await writeFile(videoPath, "video");
    const service = new SavedVideosService();
    const page = await service.listLibrary();
    const id = page.items[0]!.id;

    await expect(service.open(id)).resolves.toEqual({ error: null, ok: true });
    expect(electronMocks.openPath).toHaveBeenCalledWith(videoPath);
    await expect(service.reveal(id)).resolves.toEqual({
      error: null,
      ok: true,
    });
    expect(electronMocks.showItemInFolder).toHaveBeenCalledWith(videoPath);

    electronMocks.openPath.mockResolvedValueOnce("failed");
    await expect(service.open(id)).resolves.toEqual({
      error: "Could not open saved edit video",
      ok: false,
    });
    fsMocks.rm.mockRejectedValueOnce(new Error("locked"));
    await expect(service.delete(id)).resolves.toEqual({
      error: "locked",
      ok: false,
    });
    await expect(service.delete(id)).resolves.toEqual({
      error: null,
      ok: true,
    });
    expect(noteUsageDelta).toHaveBeenCalledWith("export-videos", -5);
    await expect(service.open(id)).resolves.toEqual({
      error: "Saved edit video is not available",
      ok: false,
    });
    await expect(service.reveal("0".repeat(64))).resolves.toEqual({
      error: "Saved edit video is not available",
      ok: false,
    });
    await expect(service.delete("0".repeat(64))).resolves.toEqual({
      error: "Saved edit video is not available",
      ok: false,
    });
  });

  it("deletes the oldest exports until usage has cleanup buffer", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    const paths = await createSizedExportFiles([
      ["oldest.mp4", 600 * 1024 ** 2, 1_000],
      ["middle.mp4", 600 * 1024 ** 2, 2_000],
      ["newest.mp4", 600 * 1024 ** 2, 3_000],
    ]);
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 1.8 * GIGABYTE,
      exportVideosUsageTruncated: false,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    const service = new SavedVideosService({
      openDirectory: opendir,
      statFile: createSizedStatFile(
        new Map([
          [paths[0]!, 600 * 1024 ** 2],
          [paths[1]!, 600 * 1024 ** 2],
          [paths[2]!, 600 * 1024 ** 2],
        ]),
      ),
    });

    await expect(service.cleanup()).resolves.toMatchObject({
      deletedCount: 2,
      failedCount: 0,
      freedBytes: 1_200 * 1024 ** 2,
      limitBytes: GIGABYTE,
      usageBytes: 1_800 * 1024 ** 2,
    });
    await expect(stat(paths[0]!)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(paths[1]!)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(paths[2]!)).resolves.toMatchObject({ size: 1 });
    expect(noteUsageDelta).toHaveBeenCalledWith(
      "export-videos",
      -1_200 * 1024 ** 2,
    );
  });

  it("protects the newly committed export during automatic cleanup", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    const paths = await createSizedExportFiles([
      ["old.mp4", 700 * 1024 ** 2, 1_000],
      ["new.mp4", 700 * 1024 ** 2, 2_000],
    ]);
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 1.4 * GIGABYTE,
      exportVideosUsageTruncated: false,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    const service = new SavedVideosService({
      statFile: createSizedStatFile(
        new Map(paths.map((path) => [path, 700 * 1024 ** 2])),
      ),
    });

    await expect(
      service.cleanup({ protectedPaths: [paths[1]!] }),
    ).resolves.toMatchObject({ deletedCount: 1, failedCount: 0 });
    await expect(stat(paths[0]!)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(paths[1]!)).resolves.toMatchObject({ size: 1 });
  });

  it("skips protected and out-of-root retention candidates", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    const protectedPath = join(exportRoot, "protected.mp4");
    const deletablePath = join(exportRoot, "deletable.mp4");
    const outsidePath = join(root, "outside", "outside.mp4");
    await Promise.all([
      writeFile(protectedPath, "protected"),
      writeFile(deletablePath, "deletable"),
    ]);
    const [protectedStats, deletableStats] = await Promise.all([
      stat(protectedPath),
      stat(deletablePath),
    ]);
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 2 * GIGABYTE,
      exportVideosUsageTruncated: false,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    const service = new SavedVideosService({
      createRetentionPlan: vi.fn().mockResolvedValue({
        files: [
          {
            deviceId: protectedStats.dev,
            inode: protectedStats.ino,
            modifiedAt: protectedStats.mtime,
            path: protectedPath,
            sizeBytes: GIGABYTE,
          },
          {
            deviceId: 1,
            inode: 1,
            modifiedAt: new Date(1),
            path: outsidePath,
            sizeBytes: GIGABYTE,
          },
          {
            deviceId: deletableStats.dev,
            inode: deletableStats.ino,
            modifiedAt: deletableStats.mtime,
            path: deletablePath,
            sizeBytes: deletableStats.size,
          },
        ],
        hasMoreCandidates: false,
        isTruncated: false,
        targetUsageBytes: 0.95 * GIGABYTE,
        usageBytes: 2 * GIGABYTE,
      }),
      statFile: stat,
    });

    await expect(
      service.cleanup({ protectedPaths: [protectedPath] }),
    ).resolves.toMatchObject({ deletedCount: 1 });

    await expect(stat(protectedPath)).resolves.toBeDefined();
    await expect(stat(deletablePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("skips cleanup for unlimited and under-limit export storage", async () => {
    const createRetentionPlan = vi.fn().mockResolvedValue({
      files: [],
      hasMoreCandidates: false,
      isTruncated: true,
      targetUsageBytes: 0.95 * GIGABYTE,
      usageBytes: 500 * 1024 ** 2,
    });
    const service = new SavedVideosService({ createRetentionPlan });
    getUsage
      .mockResolvedValueOnce({
        clipsSizeBytes: 0,
        diskFreeBytes: 100 * GIGABYTE,
        exportVideosSizeBytes: 2 * GIGABYTE,
        exportVideosUsageTruncated: false,
        lowDiskSpace: false,
        recordingsSizeBytes: 0,
      })
      .mockResolvedValueOnce({
        clipsSizeBytes: 0,
        diskFreeBytes: 100 * GIGABYTE,
        exportVideosSizeBytes: 500 * 1024 ** 2,
        exportVideosUsageTruncated: false,
        lowDiskSpace: false,
        recordingsSizeBytes: 0,
      })
      .mockResolvedValueOnce({
        clipsSizeBytes: 0,
        diskFreeBytes: 100 * GIGABYTE,
        exportVideosSizeBytes: 500 * 1024 ** 2,
        exportVideosUsageTruncated: true,
        lowDiskSpace: false,
        recordingsSizeBytes: 0,
      });

    settings = { ...settings, editorExportMaxStorageGb: 0 };
    await expect(service.cleanup()).resolves.toMatchObject({
      deletedCount: 0,
      limitBytes: 0,
      usageBytes: 2 * GIGABYTE,
    });
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    await expect(service.cleanup()).resolves.toMatchObject({
      deletedCount: 0,
      usageBytes: 500 * 1024 ** 2,
    });
    await expect(service.cleanup()).resolves.toMatchObject({
      deletedCount: 0,
      usageBytes: 500 * 1024 ** 2,
    });
    expect(createRetentionPlan).toHaveBeenCalledOnce();
  });

  it("returns safely when a retention scan is invalidated", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 2 * GIGABYTE,
      exportVideosUsageTruncated: false,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    let invalidateScan = false;
    const service = new SavedVideosService({
      createRetentionPlan: vi.fn().mockImplementation(async () => {
        if (invalidateScan) {
          settings = {
            ...settings,
            recordingStoragePath: join(root, "changed-recordings"),
          };
          settingsListener?.(settings);
        }
        return null;
      }),
    });
    const internals = service as unknown as {
      scheduleCleanup: (options?: { protectedPaths?: string[] }) => void;
    };
    const scheduleCleanup = vi
      .spyOn(internals, "scheduleCleanup")
      .mockImplementation(() => {});

    await expect(service.cleanup()).resolves.toMatchObject({
      deletedCount: 0,
      usageBytes: 2 * GIGABYTE,
    });
    expect(scheduleCleanup).not.toHaveBeenCalled();

    invalidateScan = true;
    await service.cleanup();
    expect(scheduleCleanup).toHaveBeenCalledTimes(2);
  });

  it("handles non-file, missing, and failed deletion races", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    const videoPath = join(exportRoot, "race.mp4");
    await writeFile(videoPath, "video");
    const videoStats = await stat(videoPath);
    const candidate = {
      deviceId: videoStats.dev,
      inode: videoStats.ino,
      modifiedAt: videoStats.mtime,
      path: videoPath,
      sizeBytes: videoStats.size,
    };
    const plan = {
      files: [candidate],
      hasMoreCandidates: false,
      isTruncated: false,
      targetUsageBytes: 0.95 * GIGABYTE,
      usageBytes: 2 * GIGABYTE,
    };
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 2 * GIGABYTE,
      exportVideosUsageTruncated: false,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });

    const directoryStats = await stat(exportRoot);
    const nonFileService = new SavedVideosService({
      createRetentionPlan: vi.fn().mockResolvedValue(plan),
      statFile: vi.fn().mockResolvedValue(directoryStats),
    });
    await expect(nonFileService.cleanup()).resolves.toMatchObject({
      deletedCount: 0,
      failedCount: 0,
    });

    const missingError = Object.assign(new Error("gone"), { code: "ENOENT" });
    const missingService = new SavedVideosService({
      createRetentionPlan: vi.fn().mockResolvedValue(plan),
      statFile: vi.fn().mockRejectedValue(missingError),
    });
    await expect(missingService.cleanup()).resolves.toMatchObject({
      deletedCount: 0,
      failedCount: 0,
    });
    expect(noteUsageDelta).toHaveBeenCalledWith(
      "export-videos",
      -videoStats.size,
    );

    noteUsageDelta.mockClear();
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});
    const failedService = new SavedVideosService({
      createRetentionPlan: vi
        .fn()
        .mockResolvedValue({ ...plan, hasMoreCandidates: true }),
      removeFile: vi.fn(async () => {
        throw Object.assign(new Error("locked"), { code: "EACCES" });
      }),
      statFile: stat,
    });
    const failedInternals = failedService as unknown as {
      scheduleCleanup: (options?: {
        protectedPaths?: string[];
        retryCount?: number;
      }) => void;
    };
    const scheduleCleanup = vi
      .spyOn(failedInternals, "scheduleCleanup")
      .mockImplementation(() => {});
    await expect(failedService.cleanup()).resolves.toMatchObject({
      deletedCount: 0,
      failedCount: 1,
    });
    expect(scheduleCleanup).toHaveBeenCalledWith({ retryCount: 1 });
    scheduleCleanup.mockClear();
    await failedService.cleanup({ retryCount: 3 });
    expect(scheduleCleanup).not.toHaveBeenCalled();
    expect(noteUsageDelta).not.toHaveBeenCalled();
    expect(logWarn).toHaveBeenCalledWith(
      "saved-videos",
      "Failed to delete retained export video",
      expect.objectContaining({ error: "locked" }),
    );
  });

  it("schedules another bounded cleanup pass when usage remains high", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    const videoPath = join(exportRoot, "old.mp4");
    await writeFile(videoPath, "video");
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 2 * GIGABYTE,
      exportVideosUsageTruncated: false,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    const service = new SavedVideosService({
      createRetentionPlan: vi.fn().mockResolvedValue({
        files: [
          {
            deviceId: (await stat(videoPath)).dev,
            inode: (await stat(videoPath)).ino,
            modifiedAt: (await stat(videoPath)).mtime,
            path: videoPath,
            sizeBytes: (await stat(videoPath)).size,
          },
        ],
        hasMoreCandidates: true,
        isTruncated: false,
        targetUsageBytes: 0.95 * GIGABYTE,
        usageBytes: 2 * GIGABYTE,
      }),
      removeFile: vi.fn().mockResolvedValue(undefined),
      statFile: stat,
    });
    const internals = service as unknown as {
      scheduleCleanup: (options?: { protectedPaths?: string[] }) => void;
    };
    const scheduleCleanup = vi
      .spyOn(internals, "scheduleCleanup")
      .mockImplementation(() => {});

    await service.cleanup({ protectedPaths: [] });

    expect(scheduleCleanup).toHaveBeenCalledWith({ protectedPaths: [] });
  });

  it("does not delete candidates when a truncated measured subtotal is below the limit", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    const videoPath = join(exportRoot, "old.mp4");
    await writeFile(videoPath, "video");
    const videoStats = await stat(videoPath);
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 500 * 1024 ** 2,
      exportVideosUsageTruncated: true,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    const createRetentionPlan = vi.fn().mockResolvedValue({
      files: [
        {
          deviceId: videoStats.dev,
          inode: videoStats.ino,
          modifiedAt: videoStats.mtime,
          path: videoPath,
          sizeBytes: videoStats.size,
        },
      ],
      hasMoreCandidates: true,
      isTruncated: true,
      targetUsageBytes: 0.95 * GIGABYTE,
      usageBytes: 500 * 1024 ** 2,
    });
    const removeFile = vi.fn().mockResolvedValue(undefined);
    const service = new SavedVideosService({
      createRetentionPlan,
      removeFile,
    });
    const internals = service as unknown as {
      scheduleCleanup: (options?: {
        protectedPaths?: string[];
        retryCount?: number;
      }) => void;
    };
    const scheduleCleanup = vi
      .spyOn(internals, "scheduleCleanup")
      .mockImplementation(() => {});

    await expect(
      service.cleanup({ protectedPaths: [] }),
    ).resolves.toMatchObject({ deletedCount: 0 });

    expect(removeFile).not.toHaveBeenCalled();
    expect(scheduleCleanup).toHaveBeenCalledWith({
      protectedPaths: [],
      retryCount: 1,
    });
    expect(createRetentionPlan).toHaveBeenCalledWith(
      expect.not.objectContaining({
        openDirectory: expect.anything(),
        statFile: expect.anything(),
      }),
    );
  });

  it("bounds no-progress retries for an empty truncated cleanup pass", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 500 * 1024 ** 2,
      exportVideosUsageTruncated: true,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    const service = new SavedVideosService({
      createRetentionPlan: vi.fn().mockResolvedValue({
        files: [],
        hasMoreCandidates: true,
        isTruncated: true,
        targetUsageBytes: 0.95 * GIGABYTE,
        usageBytes: 500 * 1024 ** 2,
      }),
    });
    const internals = service as unknown as {
      scheduleCleanup: (options?: { retryCount?: number }) => void;
    };
    const scheduleCleanup = vi
      .spyOn(internals, "scheduleCleanup")
      .mockImplementation(() => {});

    await service.cleanup({ retryCount: 2 });
    expect(scheduleCleanup).toHaveBeenCalledWith({ retryCount: 3 });

    scheduleCleanup.mockClear();
    await service.cleanup({ retryCount: 3 });
    expect(scheduleCleanup).not.toHaveBeenCalled();
  });

  it("recovers the cleanup queue and logs scheduled failures", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    const service = new SavedVideosService();
    getUsage.mockRejectedValueOnce(new Error("scan failed"));

    await expect(service.cleanup()).rejects.toThrow("scan failed");
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 0,
      exportVideosUsageTruncated: false,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    await expect(service.cleanup()).resolves.toMatchObject({ deletedCount: 0 });

    vi.useFakeTimers();
    const logWarn = vi.spyOn(appLog, "logWarn").mockImplementation(() => {});
    vi.spyOn(service, "cleanup").mockRejectedValueOnce(
      new Error("scheduled failure"),
    );
    service.initializeRetention();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(logWarn).toHaveBeenCalledWith(
      "saved-videos",
      "Scheduled export cleanup failed",
      { error: "scheduled failure" },
    );
    vi.useRealTimers();
  });

  it("reschedules cleanup invalidated by a storage root change", async () => {
    settings = { ...settings, editorExportMaxStorageGb: 1 };
    getUsage.mockResolvedValue({
      clipsSizeBytes: 0,
      diskFreeBytes: 100 * GIGABYTE,
      exportVideosSizeBytes: 2 * GIGABYTE,
      exportVideosUsageTruncated: false,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
    });
    const service = new SavedVideosService({
      createRetentionPlan: vi.fn().mockImplementation(async () => {
        settings = {
          ...settings,
          recordingStoragePath: join(root, "changed-recordings"),
        };
        settingsListener?.(settings);
        return {
          files: [
            {
              deviceId: 0,
              inode: 0,
              modifiedAt: new Date(0),
              path: join(exportRoot, "old.mp4"),
              sizeBytes: GIGABYTE,
            },
          ],
          hasMoreCandidates: false,
          isTruncated: false,
          targetUsageBytes: 0.95 * GIGABYTE,
          usageBytes: 2 * GIGABYTE,
        };
      }),
    });
    const internals = service as unknown as {
      scheduleCleanup: (options?: { protectedPaths?: string[] }) => void;
    };
    const scheduleCleanup = vi
      .spyOn(internals, "scheduleCleanup")
      .mockImplementation(() => {});

    await expect(service.cleanup()).resolves.toMatchObject({ deletedCount: 0 });
    expect(scheduleCleanup).toHaveBeenCalledTimes(2);
  });

  it("clears a pending cleanup timer when reset", () => {
    vi.useFakeTimers();
    const service = SavedVideosService.getInstance();
    service.initializeRetention();

    SavedVideosService.resetForTests();

    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("schedules cleanup after startup, commits, and limit reductions", async () => {
    vi.useFakeTimers();
    const service = SavedVideosService.getInstance();
    const cleanup = vi.spyOn(service, "cleanup").mockResolvedValue({
      deletedCount: 0,
      failedCount: 0,
      freedBytes: 0,
      limitBytes: 50 * GIGABYTE,
      usageBytes: 0,
    });

    service.initializeRetention();
    SavedVideosService.noteExportCommitted({
      deviceId: 0,
      inode: 0,
      modifiedAtMs: 1_000,
      path: join(exportRoot, "new.mp4"),
      projectId: null,
      sizeDeltaBytes: 123,
      sizeBytes: 123,
    });
    settings = { ...settings, editorExportMaxStorageGb: 10 };
    settingsListener?.(settings);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(noteUsageDelta).toHaveBeenCalledWith("export-videos", 123);
    expect(cleanup).toHaveBeenCalledWith({
      protectedPaths: [join(exportRoot, "new.mp4")],
    });
    vi.useRealTimers();
  });

  it("schedules cleanup when the export root changes under a storage limit", async () => {
    vi.useFakeTimers();
    settings = { ...settings, editorExportMaxStorageGb: 10 };
    const service = SavedVideosService.getInstance();
    const cleanup = vi.spyOn(service, "cleanup").mockResolvedValue({
      deletedCount: 0,
      failedCount: 0,
      freedBytes: 0,
      limitBytes: 10 * GIGABYTE,
      usageBytes: 0,
    });

    try {
      settings = {
        ...settings,
        editorExportStoragePath: join(videosPath, "Hinekora", "Exports"),
      };
      settingsListener?.(settings);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(cleanup).toHaveBeenCalledWith({ protectedPaths: [] });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects stale action targets and filesystem races", async () => {
    const videoPath = join(exportRoot, "Saved.mp4");
    await writeFile(videoPath, "video");
    const service = new SavedVideosService();
    const id = (await service.listLibrary()).items[0]!.id;

    settings = {
      ...settings,
      editorExportStoragePath: join(root, "different-exports"),
    };
    const internals = service as unknown as {
      cache: { rootsKey: string };
      resolveLibraryRoots: () => string[];
    };
    internals.cache.rootsKey = internals
      .resolveLibraryRoots()
      .map(createStoragePathKey)
      .join("\0");
    await expect(service.open(id)).resolves.toEqual({
      error: null,
      ok: true,
    });

    settings = { ...settings, editorExportStoragePath: exportRoot };
    internals.cache.rootsKey = internals
      .resolveLibraryRoots()
      .map(createStoragePathKey)
      .join("\0");
    await writeFile(videoPath, "replacement");
    await expect(service.delete(id)).resolves.toEqual({
      error: "Saved edit video is not available",
      ok: false,
    });
    await expect(readFile(videoPath, "utf8")).resolves.toBe("replacement");

    await removePath(videoPath);
    await mkdir(videoPath);
    await expect(service.open(id)).resolves.toEqual({
      error: "Saved edit video is not available",
      ok: false,
    });
    await removePath(videoPath, { recursive: true });
    await expect(service.open(id)).resolves.toEqual({
      error: "Saved edit video is not available",
      ok: false,
    });
  });

  it("rejects a cached action target whose export ownership changed", async () => {
    const videoPath = join(exportRoot, "Saved.mp4");
    await writeFile(videoPath, "video");
    const service = new SavedVideosService();
    const id = (await service.listLibrary()).items[0]!.id;
    const internals = service as unknown as {
      createOwnershipPolicy: () => {
        isOwned: () => boolean;
      };
    };
    vi.spyOn(internals, "createOwnershipPolicy").mockReturnValue({
      isOwned: () => false,
    });

    await expect(service.open(id)).resolves.toEqual({
      error: "Saved edit video is not available",
      ok: false,
    });
  });

  it("registers guarded handlers and validates renderer input", async () => {
    await writeFile(join(exportRoot, "Saved.mp4"), "video");
    const { handlers } = mockIpcMainHandlers();
    new SavedVideosService();
    const sender = { id: 1 };
    registerIpcWindowRole(sender, WindowName.Main);
    const event = { sender };

    const page = (await handlers.get(SavedVideosChannel.ListLibrary)?.(event, {
      pageSize: 1,
    })) as Awaited<ReturnType<SavedVideosService["listLibrary"]>>;
    expect(page.totalCount).toBe(1);
    expect(
      await handlers.get(SavedVideosChannel.ListLibrary)?.(event, {
        pageSize: 0,
      }),
    ).toEqual({ ok: false, error: "page size is too small" });
    expect(
      await handlers.get(SavedVideosChannel.Open)?.(event, page.items[0]!.id),
    ).toEqual({ error: null, ok: true });
    expect(
      await handlers.get(SavedVideosChannel.Reveal)?.(event, page.items[0]!.id),
    ).toEqual({ error: null, ok: true });
    expect(
      await handlers.get(SavedVideosChannel.Delete)?.(event, page.items[0]!.id),
    ).toEqual({ error: null, ok: true });
    expect(
      await handlers.get(SavedVideosChannel.Open)?.(event, "short"),
    ).toEqual({ ok: false, error: "saved video id is too short" });
  });

  it("validates library queries and opaque ids", () => {
    expect(validateSavedVideosLibraryQuery(undefined)).toEqual({});
    expect(
      validateSavedVideosLibraryQuery({
        pageIndex: 2,
        pageSize: 50,
        sortBy: "sizeBytes",
        sortDirection: "asc",
      }),
    ).toEqual({
      pageIndex: 2,
      pageSize: 50,
      sortBy: "sizeBytes",
      sortDirection: "asc",
    });
    expect(() =>
      validateSavedVideosLibraryQuery({ sortBy: "duration" }),
    ).toThrow("sort field is invalid");
    expect(() =>
      validateSavedVideosLibraryQuery({ sortDirection: "sideways" }),
    ).toThrow("sort direction is invalid");
    expect(() =>
      validateSavedVideoId("x".repeat(64), SavedVideosChannel.Open),
    ).toThrow("saved video id is invalid");
    expect(validateSavedVideoId("a".repeat(64), SavedVideosChannel.Open)).toBe(
      "a".repeat(64),
    );
  });
});

async function createSizedExportFiles(
  files: Array<[name: string, sizeBytes: number, modifiedAtMs: number]>,
): Promise<string[]> {
  return Promise.all(
    files.map(async ([name, _sizeBytes, modifiedAtMs]) => {
      const path = join(exportRoot, name);
      await writeFile(path, "x");
      await utimes(path, new Date(modifiedAtMs), new Date(modifiedAtMs));
      return path;
    }),
  );
}

function createSizedStatFile(
  sizes: Map<string, number>,
): (path: PathLike) => Promise<Stats> {
  return async (path) => {
    const stats = await stat(path);
    const size = sizes.get(String(path)) ?? stats.size;
    return {
      ...stats,
      dev: stats.dev,
      isFile: () => stats.isFile(),
      mtime: stats.mtime,
      size,
    } as Stats;
  };
}
