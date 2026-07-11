import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createReplayClip } from "~/main/test/factories/replayClip";

import { createDefaultSettings } from "~/types";
import { ReplayClipsChannel } from "../ReplayClips.channels";
import type { ReplayClip, ReplayClipDetail } from "../ReplayClips.dto";
import { ReplayClipPreviewService } from "../ReplayClips.preview";
import { ReplayClipsRepository } from "../ReplayClips.repository";
import { ReplayClipsService } from "../ReplayClips.service";
import {
  openPath,
  outsideRoot,
  repository,
  root,
  send,
  service,
  setupReplayClipsServiceTestHarness,
  showItemInFolder,
} from "./ReplayClips.service.test-harness";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
  getPath: vi.fn(),
  openPath: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: electronMocks.getPath },
  BrowserWindow: { getAllWindows: electronMocks.getAllWindows },
  shell: {
    openPath: electronMocks.openPath,
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

setupReplayClipsServiceTestHarness(electronMocks);

describe("ReplayClipsService file actions", () => {
  it("creates and reuses the singleton instance", () => {
    ReplayClipsService.resetForTests();

    const first = ReplayClipsService.getInstance();
    const second = ReplayClipsService.getInstance();

    expect(first).toBe(second);
    ReplayClipsService.resetForTests();
  });

  it("lists stored clip file sizes", async () => {
    const path = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    writeFileSync(path, "clip-data");
    repository.upsert(
      createReplayClip({ originalObsPath: path, processedClipPath: path }),
    );

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        processedClipPath: resolve(path),
        sizeBytes: 9,
      }),
    ]);
  });

  it("returns clip details with app media URLs", () => {
    const path = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    writeFileSync(path, "clip-data");
    repository.upsert(
      createReplayClip({
        id: "clip-1",
        originalObsPath: path,
        processedClipPath: path,
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "missing-media",
        originalObsPath: join(root, "missing.mp4"),
        processedClipPath: null,
      }),
    );

    expect(service.getClip("clip-1")).toEqual({
      clip: expect.objectContaining({ id: "clip-1", sizeBytes: 0 }),
      durationSeconds: null,
      mediaUrl: expect.stringMatching(
        /^hinekora-media:\/\/replay-clip\/clip-1\?v=/,
      ),
    });
    expect(service.getClip("missing-media")).toEqual({
      clip: expect.objectContaining({ id: "missing-media", sizeBytes: 0 }),
      durationSeconds: null,
      mediaUrl: null,
    });
    expect(service.getClip("missing")).toBeNull();
    expect(service.getPreviewMediaPath("missing")).toBeNull();
  });

  it("uses the original clip directly for 1080p previews", async () => {
    vi.mocked(SettingsStoreService.getInstance).mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        replayClipPreviewResolution: "1080p",
      }),
    } as unknown as SettingsStoreService);
    const preparePreview = vi.spyOn(
      ReplayClipPreviewService.prototype,
      "prepare",
    );
    const removePreview = vi.spyOn(
      ReplayClipPreviewService.prototype,
      "remove",
    );
    const clip = createReplayClip({ id: "original-preview" });
    const internals = service as unknown as {
      getClipView(id: string): ReplayClipDetail | null;
      prepareClipPreview(
        clip: ReplayClip,
        sourcePath: string,
        durationSeconds: number,
      ): Promise<void>;
    };

    repository.upsert(clip);
    expect(service.getPreviewMediaPath(clip.id)).toBeNull();
    expect(internals.getClipView(clip.id)?.previewMediaUrl).toBeNull();
    await internals.prepareClipPreview(clip, "unused.mp4", 10);

    expect(removePreview).toHaveBeenCalledWith(clip.id);
    expect(preparePreview).not.toHaveBeenCalled();
  });

  it("publishes bounded preview encoding progress", async () => {
    vi.spyOn(ReplayClipPreviewService.prototype, "prepare").mockImplementation(
      async (input) => {
        input.onProgress?.(-1);
        input.onProgress?.(0.42);
        input.onProgress?.(2);
        return "preview.mp4";
      },
    );
    const clip = createReplayClip({ id: "progress-preview" });
    const internals = service as unknown as {
      prepareClipPreview(
        clip: ReplayClip,
        sourcePath: string,
        durationSeconds: number,
      ): Promise<void>;
    };
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => true, webContents: { send: vi.fn() } },
      { isDestroyed: () => false, webContents: { id: 100, send } },
    ]);
    send.mockClear();

    await internals.prepareClipPreview(clip, "source.mp4", 10);

    expect(send.mock.calls).toEqual([
      [ReplayClipsChannel.PreviewProgress, { clipId: clip.id, progress: 0 }],
      [ReplayClipsChannel.PreviewProgress, { clipId: clip.id, progress: 0 }],
      [ReplayClipsChannel.PreviewProgress, { clipId: clip.id, progress: 0.42 }],
      [ReplayClipsChannel.PreviewProgress, { clipId: clip.id, progress: 1 }],
      [ReplayClipsChannel.PreviewProgress, { clipId: clip.id, progress: 1 }],
    ]);
  });

  it("renames replay clip files and publishes refreshed metadata", async () => {
    const directory = join(root, "Death Clips");
    mkdirSync(directory);
    const path = join(directory, "clip-1.mp4");
    writeFileSync(path, "clip-data");
    repository.upsert(
      createReplayClip({
        id: "clip-1",
        originalObsPath: path,
        processedClipPath: path,
      }),
    );

    await expect(
      service.updateClipFile({ id: "clip-1", name: "Boss: kill" }),
    ).resolves.toEqual({
      detail: {
        clip: expect.objectContaining({
          fileName: "Boss kill.mp4",
          hasMediaFile: true,
          id: "clip-1",
          sizeBytes: 9,
        }),
        durationSeconds: null,
        mediaUrl: expect.stringMatching(
          /^hinekora-media:\/\/replay-clip\/clip-1\?v=/,
        ),
        previewMediaUrl: null,
      },
      error: null,
      ok: true,
    });
    expect(existsSync(path)).toBe(false);
    expect(existsSync(join(directory, "Boss kill.mp4"))).toBe(true);
    expect(send).toHaveBeenCalledWith(
      ReplayClipsChannel.StatusChanged,
      expect.objectContaining({
        fileName: "Boss kill.mp4",
        hasMediaFile: true,
        id: "clip-1",
      }),
    );
    expect(repository.get("clip-1")).toEqual(
      expect.objectContaining({
        originalObsPath: resolve(join(directory, "Boss kill.mp4")),
        processedClipPath: resolve(join(directory, "Boss kill.mp4")),
      }),
    );
  });

  it("restores the original file when clip persistence fails", async () => {
    const directory = join(root, "Death Clips");
    mkdirSync(directory);
    const sourcePath = join(directory, "clip-1.mp4");
    const targetPath = join(directory, "Boss kill.mp4");
    writeFileSync(sourcePath, "clip-data");
    repository.upsert(
      createReplayClip({
        id: "clip-1",
        originalObsPath: sourcePath,
        processedClipPath: sourcePath,
      }),
    );
    vi.spyOn(ReplayClipsRepository.prototype, "upsert").mockImplementation(
      () => {
        throw new Error("database failed");
      },
    );

    await expect(
      service.updateClipFile({ id: "clip-1", name: "Boss kill" }),
    ).resolves.toEqual({
      detail: null,
      error: "database failed",
      ok: false,
    });

    expect(readFileSync(sourcePath, "utf8")).toBe("clip-data");
    expect(existsSync(targetPath)).toBe(false);
    expect(repository.get("clip-1")).toMatchObject({
      originalObsPath: resolve(sourcePath),
      processedClipPath: resolve(sourcePath),
    });
  });

  it("serializes rename target allocation across clips", async () => {
    const directory = join(root, "Death Clips");
    mkdirSync(directory);
    const firstPath = join(directory, "clip-1.mp4");
    const secondPath = join(directory, "clip-2.mp4");
    writeFileSync(firstPath, "first");
    writeFileSync(secondPath, "second");
    repository.upsert(
      createReplayClip({
        id: "clip-1",
        originalObsPath: firstPath,
        processedClipPath: firstPath,
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "clip-2",
        originalObsPath: secondPath,
        processedClipPath: secondPath,
      }),
    );

    const [first, second] = await Promise.all([
      service.updateClipFile({ id: "clip-1", name: "Boss" }),
      service.updateClipFile({ id: "clip-2", name: "Boss" }),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.detail?.clip.fileName).toBe("Boss.mp4");
    expect(second.detail?.clip.fileName).toBe("Boss (2).mp4");
    expect(readFileSync(join(directory, "Boss.mp4"), "utf8")).toBe("first");
    expect(readFileSync(join(directory, "Boss (2).mp4"), "utf8")).toBe(
      "second",
    );
  });

  it("returns a safe error when a clip is missing", async () => {
    await expect(service.openClip("missing")).resolves.toEqual({
      ok: false,
      error: "Clip file path is not available",
    });
    expect(service.revealClip("missing")).toEqual({
      ok: false,
      error: "Clip file path is not available",
    });
    await expect(service.deleteClip("missing")).resolves.toEqual({
      ok: false,
      error: "Clip was not found",
    });
  });

  it("opens only existing managed clip files", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(service.openClip("clip-1")).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(openPath).toHaveBeenCalledWith(resolve(path));
  });

  it("returns shell open failures without throwing", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    openPath.mockResolvedValue("No application is associated with this file");

    await expect(service.openClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "No application is associated with this file",
    });
  });

  it("blocks shell open for imported paths outside managed storage", async () => {
    const path = join(outsideRoot, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(service.openClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "Clip file path is not available",
    });
    expect(openPath).not.toHaveBeenCalled();
  });

  it("reveals only existing managed clip files", () => {
    const directory = join(root, "Hinekora-2026-06-12_10-30-00");
    const path = join(directory, "recording.mkv");
    mkdirSync(directory);
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    expect(service.revealClip("clip-1")).toEqual({ ok: true, error: null });
    expect(showItemInFolder).toHaveBeenCalledWith(resolve(path));
  });

  it("deletes the row but never unlinks unsafe imported paths", async () => {
    const path = join(outsideRoot, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(service.deleteClip("clip-1")).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(existsSync(path)).toBe(true);
    expect(repository.get("clip-1")).toBeNull();
  });

  it("deletes managed clip files and their database rows", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(service.deleteClip("clip-1")).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(existsSync(path)).toBe(false);
    expect(repository.get("clip-1")).toBeNull();
  });

  it("retains files still referenced by another clip", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: path }),
    );
    repository.upsert(
      createReplayClip({ id: "clip-2", processedClipPath: path }),
    );

    await expect(service.deleteClip("clip-1")).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(existsSync(path)).toBe(true);
    expect(repository.get("clip-1")).toBeNull();
    expect(repository.get("clip-2")).not.toBeNull();

    await (
      service as unknown as {
        storageService: {
          deleteStoredPathIfUnreferenced(path: string): Promise<void>;
        };
      }
    ).storageService.deleteStoredPathIfUnreferenced(path);
    expect(existsSync(path)).toBe(true);
  });

  it("loads shared path references once for a batch delete", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: path }),
    );
    repository.upsert(
      createReplayClip({ id: "clip-2", processedClipPath: path }),
    );
    const listStoragePaths = vi.spyOn(
      ReplayClipsRepository.prototype,
      "listStoragePaths",
    );

    await expect(service.deleteManyClips(["clip-1"])).resolves.toMatchObject({
      deletedIds: ["clip-1"],
      ok: true,
    });

    expect(listStoragePaths).toHaveBeenCalledTimes(1);
    expect(existsSync(path)).toBe(true);
    expect(repository.get("clip-2")).not.toBeNull();
  });

  it("logs obsolete replay cleanup failures without rejecting updates", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>();

      return {
        ...actual,
        rm: vi.fn(async () => {
          throw new Error("remove failed");
        }),
      };
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const { ReplayClipStorageService } = await import(
        "../ReplayClips.storage"
      );
      const storageService = new ReplayClipStorageService({
        listStoragePaths: () => [],
      } as unknown as ReplayClipsRepository);

      await expect(
        storageService.deleteStoredPathIfUnreferenced(
          join(root, "obsolete-replay.mp4"),
        ),
      ).resolves.toBeUndefined();
      expect(
        warn.mock.calls.some(([message]) =>
          String(message).includes("Obsolete replay file cleanup failed"),
        ),
      ).toBe(true);
    } finally {
      vi.doUnmock("node:fs/promises");
      vi.resetModules();
    }
  });

  it("reports clip file cleanup failures after deleting database rows", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>();

      return {
        ...actual,
        unlink: vi.fn(async () => {
          throw new Error("unlink failed");
        }),
      };
    });

    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
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
      const { ReplayClipsRepository: MockedReplayClipsRepository } =
        await import("../ReplayClips.repository");
      const { ReplayClipsService: MockedReplayClipsService } = await import(
        "../ReplayClips.service"
      );
      mockDynamicIpcMainHandlers();
      const mockedDatabase = MockedDatabaseService.getInstance(":memory:");
      const mockedRepository = new MockedReplayClipsRepository(mockedDatabase);
      vi.spyOn(MockedSettingsStoreService, "getInstance").mockReturnValue({
        get: () => ({
          ...createDefaultSettings(),
          recordingStoragePath: root,
        }),
      } as unknown as typeof MockedSettingsStoreService.prototype);
      mockedRepository.upsert(createReplayClip({ processedClipPath: path }));
      const mockedService = new MockedReplayClipsService();

      await expect(mockedService.deleteClip("clip-1")).resolves.toEqual({
        ok: true,
        error: null,
        cleanupError: "unlink failed",
      });
      expect(existsSync(path)).toBe(true);
      expect(mockedRepository.get("clip-1")).toBeNull();

      mockedRepository.upsert(createReplayClip({ processedClipPath: path }));
      await expect(mockedService.deleteManyClips(["clip-1"])).resolves.toEqual({
        ok: true,
        error: null,
        deletedIds: ["clip-1"],
        failed: [],
        cleanupErrors: [{ id: "clip-1", error: "unlink failed" }],
      });
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("node:fs/promises");
      vi.resetModules();
    }
  });

  it("deletes many clips with per-id failures", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(
      service.deleteManyClips(["clip-1", "missing"]),
    ).resolves.toEqual({
      ok: false,
      error: "Some clips could not be deleted",
      deletedIds: ["clip-1"],
      failed: [{ id: "missing", error: "Clip was not found" }],
    });
    expect(existsSync(path)).toBe(false);
  });

  it("deletes many clips without failures", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(service.deleteManyClips(["clip-1"])).resolves.toEqual({
      ok: true,
      error: null,
      deletedIds: ["clip-1"],
      failed: [],
    });
    expect(existsSync(path)).toBe(false);
  });

  it("uses a generic message when a bulk clip delete failure has no error", async () => {
    const internals = (
      service as unknown as {
        fileActionsService: {
          deleteClipQueued: () => Promise<{
            ok: boolean;
            error: string | null;
          }>;
        };
      }
    ).fileActionsService;
    vi.spyOn(internals, "deleteClipQueued").mockResolvedValue({
      ok: false,
      error: null,
    });

    await expect(service.deleteManyClips(["clip-1"])).resolves.toEqual({
      ok: false,
      error: "Some clips could not be deleted",
      deletedIds: [],
      failed: [{ id: "clip-1", error: "Clip delete failed" }],
    });
  });

  it("sanitizes bulk-imported replay clips before persistence", () => {
    const safePath = join(root, "2026-06-12_10-30-00.mp4");
    const unsafePath = join(outsideRoot, "2026-06-12_10-30-00.mp4");
    const missingPath = join(root, "missing.mp4");
    const directoryPath = join(root, "directory.mp4");
    writeFileSync(safePath, "safe");
    mkdirSync(directoryPath);

    service.replaceAll([
      createReplayClip({
        originalObsPath: unsafePath,
        processedClipPath: safePath,
      }),
    ]);

    expect(repository.get("clip-1")).toMatchObject({
      originalObsPath: null,
      processedClipPath: resolve(safePath),
      sizeBytes: 4,
      status: "ready",
    });

    service.upsertMany([
      createReplayClip({
        id: "clip-2",
        originalObsPath: unsafePath,
        processedClipPath: safePath,
      }),
      createReplayClip({
        id: "clip-3",
        processedClipPath: missingPath,
      }),
      createReplayClip({
        id: "clip-4",
        processedClipPath: directoryPath,
      }),
      createReplayClip({
        id: "clip-5",
        originalObsPath: safePath,
        processedClipPath: safePath,
      }),
    ]);
    expect(repository.get("clip-2")).toMatchObject({
      originalObsPath: null,
      processedClipPath: resolve(safePath),
      sizeBytes: 4,
    });
    expect(repository.get("clip-3")?.sizeBytes).toBe(0);
    expect(repository.get("clip-4")?.sizeBytes).toBe(0);
    expect(repository.get("clip-5")?.sizeBytes).toBe(4);
  });

  it("recalculates imported sizes for files and ignores unavailable paths", () => {
    const filePath = join(root, "2026-06-12_10-30-01.mp4");
    const missingPath = join(root, "2026-06-12_10-30-02.mp4");
    const directoryPath = join(root, "2026-06-12_10-30-03.mp4");
    writeFileSync(filePath, "video");
    mkdirSync(directoryPath);
    const storageService = (
      service as unknown as {
        storageService: {
          sanitizeClips(clips: ReplayClip[], storageRoot: string): ReplayClip[];
        };
      }
    ).storageService;

    const sanitizedClips = storageService.sanitizeClips(
      [
        createReplayClip({ id: "file", processedClipPath: filePath }),
        createReplayClip({
          id: "missing",
          processedClipPath: missingPath,
        }),
        createReplayClip({
          id: "directory",
          processedClipPath: directoryPath,
        }),
      ],
      root,
    );
    expect(
      sanitizedClips.map(({ id, processedClipPath }) => ({
        id,
        processedClipPath,
      })),
    ).toEqual([
      { id: "file", processedClipPath: resolve(filePath) },
      { id: "missing", processedClipPath: resolve(missingPath) },
      { id: "directory", processedClipPath: resolve(directoryPath) },
    ]);
    expect(
      sanitizedClips.map(({ id, sizeBytes }) => ({ id, sizeBytes })),
    ).toEqual([
      { id: "file", sizeBytes: 5 },
      { id: "missing", sizeBytes: 0 },
      { id: "directory", sizeBytes: 0 },
    ]);
  });

  it("returns safe errors when shell or repository actions throw", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    openPath.mockImplementation(() => {
      throw new Error("open failed");
    });
    showItemInFolder.mockImplementation(() => {
      throw new Error("reveal failed");
    });

    await expect(service.openClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "open failed",
    });
    expect(service.revealClip("clip-1")).toEqual({
      ok: false,
      error: "reveal failed",
    });

    vi.spyOn(ReplayClipsRepository.prototype, "delete").mockImplementation(
      () => {
        throw new Error("delete failed");
      },
    );
    const failingService = new ReplayClipsService();
    await expect(failingService.deleteClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "delete failed",
    });
    expect(existsSync(path)).toBe(true);
    expect(repository.get("clip-1")).not.toBeNull();
  });

  it("continues when ready clip storage cleanup fails", async () => {
    const replayPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(replayPath, "video");
    const cleanup = vi.fn(() => {
      throw new Error("cleanup failed");
    });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: true,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay: vi.fn().mockResolvedValue({
        ok: true,
        path: replayPath,
        error: null,
      }),
    } as unknown as ManagedRecorderService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup,
    } as unknown as RecordingStorageService);
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      showClipPreviewOverlay: vi.fn(),
    } as unknown as OverlayWindowsService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "cleanup-failure",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      processedClipPath: resolve(replayPath),
    });
    expect(cleanup).toHaveBeenCalledWith({
      protectedPaths: [resolve(replayPath), resolve(replayPath)],
    });
  });

  it("opens pending previews for failed clips and skips destroyed window broadcasts", async () => {
    const showClipPreviewOverlay = vi.fn();
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      showClipPreviewOverlay,
    } as unknown as OverlayWindowsService);
    const destroyedSend = vi.fn();
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => true, webContents: { send: destroyedSend } },
    ]);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: true,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay: vi.fn().mockResolvedValue({
        ok: false,
        path: null,
        error: "save failed",
      }),
    } as unknown as ManagedRecorderService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "failed-preview",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({ status: "failed" });
    expect(showClipPreviewOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ status: "saving_replay" }),
    );
    expect(destroyedSend).not.toHaveBeenCalled();
  });

  it("resolves the default storage root from settings", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const defaultStorageService = new ReplayClipsService();

    await expect(defaultStorageService.openClip("missing")).resolves.toEqual({
      ok: false,
      error: "Clip file path is not available",
    });
    const originalOnlyPath = join(root, "2026-06-12_10-31-00.mp4");
    writeFileSync(originalOnlyPath, "video");
    repository.upsert(
      createReplayClip({
        id: "original-only",
        originalObsPath: originalOnlyPath,
        processedClipPath: null,
      }),
    );
    await expect(
      defaultStorageService.openClip("original-only"),
    ).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(openPath).toHaveBeenCalledWith(resolve(originalOnlyPath));
  });
});
