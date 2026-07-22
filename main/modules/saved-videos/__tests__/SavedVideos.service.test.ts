import {
  mkdir,
  opendir,
  rm as removePath,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
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
import { registerIpcWindowRole } from "~/main/utils/ipc-window-roles";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

import { type AppSettings, createDefaultSettings } from "~/types";
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
const settingsUnsubscribe = vi.fn();

beforeEach(async () => {
  root = join(tmpdir(), `hinekora-saved-videos-${crypto.randomUUID()}`);
  videosPath = join(root, "videos");
  recordingStorageRoot = join(root, "recordings");
  exportRoot = join(root, "exports");
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
  electronMocks.getPath.mockReset();
  electronMocks.getPath.mockReturnValue(videosPath);
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
    noteUsageDelta,
  } as unknown as RecordingStorageService);
});

afterEach(async () => {
  SavedVideosService.resetForTests();
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
    SavedVideosService.notifyLibraryChanged();
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
      totalCount: 3,
    });
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

    const items: Awaited<
      ReturnType<SavedVideosService["listLibrary"]>
    >["items"] = [];
    const pathsById = new Map<string, string>();
    const internals = service as unknown as {
      appendFiles: (
        targetItems: typeof items,
        targetPaths: Map<string, string>,
        paths: string[],
      ) => Promise<void>;
    };
    const duplicatePath = join(exportRoot, "A.mp4");
    await internals.appendFiles(items, pathsById, [
      duplicatePath,
      duplicatePath,
    ]);
    expect(items).toHaveLength(1);
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

    const invalidRoot = join(root, "not-a-directory");
    await writeFile(invalidRoot, "file");
    settings = { ...settings, editorExportStoragePath: invalidRoot };
    await expect(new SavedVideosService().listLibrary()).rejects.toThrow();
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
    expect(noteUsageDelta).toHaveBeenCalledWith("saved-edits", -5);
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
      error: "Saved edit video is not available",
      ok: false,
    });

    settings = { ...settings, editorExportStoragePath: exportRoot };
    internals.cache.rootsKey = internals
      .resolveLibraryRoots()
      .map(createStoragePathKey)
      .join("\0");
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
