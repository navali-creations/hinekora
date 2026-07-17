import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createReplayClip } from "~/main/test/factories/replayClip";
import { isWindowsOS } from "~/main/utils/platform";

import { createDefaultSettings } from "~/types";
import { ReplayClipsChannel } from "../ReplayClips.channels";
import type { ReplayClip, ReplayClipDetail } from "../ReplayClips.dto";
import type { ReplayClipFileActionsService } from "../ReplayClips.file-actions";
import { ReplayClipPreviewService } from "../ReplayClips.preview";
import { ReplayClipsRepository } from "../ReplayClips.repository";
import { ReplayClipsService } from "../ReplayClips.service";
import type { ReplayClipStorageService } from "../ReplayClips.storage";
import {
  database,
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

function getFileActionsService(
  replayClipsService: ReplayClipsService,
): ReplayClipFileActionsService {
  return (
    replayClipsService as unknown as {
      fileActionsService: ReplayClipFileActionsService;
    }
  ).fileActionsService;
}

describe("ReplayClipsService file actions", () => {
  it("creates and reuses the singleton instance", () => {
    ReplayClipsService.resetForTests();

    const first = ReplayClipsService.getInstance();
    const second = ReplayClipsService.getInstance();

    expect(first).toBe(second);
    ReplayClipsService.resetForTests();
  });

  it("bridges retention cleanup results back to recording storage", async () => {
    const deletedIds = Array.from(
      { length: 1_001 },
      (_, index) => `clip-${index}`,
    );
    const cleanupResult = {
      deletedIds,
      deletedPaths: [join(root, "clip.mp4")],
      failed: [],
      freedBytes: 12,
      ok: true,
      error: null,
    };
    vi.spyOn(
      getFileActionsService(service),
      "deleteClipGroupsForRetention",
    ).mockResolvedValue(cleanupResult);
    const publishToWindowRoles = vi.spyOn(
      service as unknown as {
        publishToWindowRoles: (...args: unknown[]) => void;
      },
      "publishToWindowRoles",
    );
    const recordingStorage =
      RecordingStorageService.getInstance() as unknown as {
        replayClipRetentionCleanupHandler: (
          idGroups: string[][],
          storageRoot: string,
        ) => Promise<unknown>;
      };

    await expect(
      recordingStorage.replayClipRetentionCleanupHandler([["clip-1"]], root),
    ).resolves.toEqual({
      deletedIds,
      deletedPaths: cleanupResult.deletedPaths,
      failed: [],
      freedBytes: 12,
    });
    expect(publishToWindowRoles).toHaveBeenCalledTimes(2);
    expect(publishToWindowRoles).toHaveBeenNthCalledWith(
      1,
      ReplayClipsChannel.Deleted,
      deletedIds.slice(0, 1_000),
      expect.any(Set),
    );
    expect(publishToWindowRoles).toHaveBeenNthCalledWith(
      2,
      ReplayClipsChannel.Deleted,
      deletedIds.slice(1_000),
      expect.any(Set),
    );

    vi.mocked(
      getFileActionsService(service).deleteClipGroupsForRetention,
    ).mockResolvedValueOnce({
      deletedIds: [],
      deletedPaths: [],
      failed: [],
      freedBytes: 0,
      ok: true,
      error: null,
    });
    await expect(
      recordingStorage.replayClipRetentionCleanupHandler([], root),
    ).resolves.toEqual({
      deletedIds: [],
      deletedPaths: [],
      failed: [],
      freedBytes: 0,
    });
    expect(publishToWindowRoles).toHaveBeenCalledTimes(2);
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

  it("stages files against the captured root after settings change", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    const clip = createReplayClip({ id: "clip-1", processedClipPath: path });
    const storageService = (
      service as unknown as { storageService: ReplayClipStorageService }
    ).storageService;
    vi.mocked(SettingsStoreService.getInstance).mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: outsideRoot,
      }),
    } as unknown as SettingsStoreService);

    const stagedFiles = await storageService.stageStoredClipFilesForDeletion(
      [clip],
      new Map(),
      root,
    );

    expect(existsSync(path)).toBe(false);
    await storageService.rollbackStoredClipFileDeletion(stagedFiles);
    expect(existsSync(path)).toBe(true);
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

  it("restores a staged clip when a new path reference appears before commit", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: path }),
    );
    const storageService = (
      service as unknown as { storageService: ReplayClipStorageService }
    ).storageService;
    const stageStoredClipFilesForDeletion =
      storageService.stageStoredClipFilesForDeletion.bind(storageService);
    vi.spyOn(
      storageService,
      "stageStoredClipFilesForDeletion",
    ).mockImplementation(async (clips, counts, storageRoot, options) => {
      const stagedFiles = await stageStoredClipFilesForDeletion(
        clips,
        counts,
        storageRoot,
        options,
      );
      repository.upsert(
        createReplayClip({ id: "clip-2", processedClipPath: path }),
      );
      return stagedFiles;
    });

    await expect(service.deleteClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "Replay clip storage references changed during deletion",
    });

    expect(existsSync(path)).toBe(true);
    expect(repository.get("clip-1")).not.toBeNull();
    expect(repository.get("clip-2")).not.toBeNull();
    expect(
      database.db
        .prepare(
          "SELECT COUNT(*) AS count FROM storage_file_deletion_operations",
        )
        .get(),
    ).toEqual({ count: 0 });
  });

  it("restores path references when clip staging fails", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: path }),
    );
    const storageService = (
      service as unknown as { storageService: ReplayClipStorageService }
    ).storageService;
    vi.spyOn(
      storageService,
      "stageStoredClipFilesForDeletion",
    ).mockRejectedValue(new Error("staging failed"));
    const addClipPathReferences = vi.spyOn(
      storageService,
      "addClipPathReferences",
    );

    await expect(service.deleteClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "staging failed",
    });
    expect(addClipPathReferences).toHaveBeenCalledOnce();
    expect(repository.get("clip-1")).not.toBeNull();
  });

  it("reports deletion rollback failures without hiding the transaction error", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: path }),
    );
    const storageService = (
      service as unknown as { storageService: ReplayClipStorageService }
    ).storageService;
    vi.spyOn(ReplayClipsRepository.prototype, "delete").mockImplementation(
      () => {
        throw new Error("database failed");
      },
    );
    vi.spyOn(
      storageService,
      "rollbackStoredClipFileDeletion",
    ).mockRejectedValue(new Error("rollback failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(service.deleteClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "database failed",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Replay clip deletion rollback failed"),
      expect.objectContaining({ clipId: "clip-1", error: "rollback failed" }),
    );
  });

  it("returns a safe result when reference snapshot creation throws", async () => {
    repository.upsert(createReplayClip({ id: "clip-1" }));
    const storageService = (
      service as unknown as { storageService: ReplayClipStorageService }
    ).storageService;
    vi.spyOn(
      storageService,
      "createStoredPathReferenceCounts",
    ).mockImplementation(() => {
      throw new Error("snapshot failed");
    });

    await expect(service.deleteClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "snapshot failed",
    });
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

  it("restores shared path references after a batch persistence failure", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: path }),
    );
    repository.upsert(
      createReplayClip({ id: "clip-2", processedClipPath: path }),
    );
    const deleteClip = ReplayClipsRepository.prototype.delete;
    vi.spyOn(ReplayClipsRepository.prototype, "delete").mockImplementation(
      function (this: ReplayClipsRepository, id) {
        if (id === "clip-1") {
          throw new Error("database failed");
        }
        deleteClip.call(this, id);
      },
    );

    await expect(
      service.deleteManyClips(["clip-1", "clip-2"]),
    ).resolves.toMatchObject({
      deletedIds: ["clip-2"],
      failed: [{ id: "clip-1", error: "database failed" }],
      ok: false,
    });

    expect(repository.get("clip-1")).not.toBeNull();
    expect(repository.get("clip-2")).toBeNull();
    expect(existsSync(path)).toBe(true);
  });

  it("retains an entire retention group when any file fails preflight", async () => {
    const existingPath = join(root, "2026-06-12_10-30-00.mp4");
    const missingPath = join(root, "2026-06-12_10-31-00.mp4");
    writeFileSync(existingPath, "video");
    repository.upsert(
      createReplayClip({
        id: "clip-1",
        originalObsPath: missingPath,
        processedClipPath: existingPath,
      }),
    );
    const fileActions = getFileActionsService(service);
    await expect(
      fileActions.deleteClipGroupsForRetention([["clip-1"]], root),
    ).resolves.toMatchObject({
      deletedIds: [],
      failed: [expect.objectContaining({ id: "clip-1" })],
      freedBytes: 0,
    });
    expect(existsSync(existingPath)).toBe(true);
    expect(repository.get("clip-1")).not.toBeNull();
    expect(ReplayClipPreviewService.prototype.remove).not.toHaveBeenCalled();
  });

  it("restores staged clip files when the database transaction fails", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: path }),
    );
    vi.spyOn(ReplayClipsRepository.prototype, "deleteMany").mockImplementation(
      () => {
        throw new Error("database failed");
      },
    );
    const fileActions = getFileActionsService(service);

    await expect(
      fileActions.deleteClipGroupsForRetention([["clip-1"]], root),
    ).resolves.toMatchObject({
      deletedIds: [],
      failed: [expect.objectContaining({ id: "clip-1" })],
      freedBytes: 0,
    });
    expect(existsSync(path)).toBe(true);
    expect(repository.get("clip-1")).not.toBeNull();
    expect(ReplayClipPreviewService.prototype.remove).not.toHaveBeenCalled();
  });

  it("reports retention rollback failures for every clip in the group", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: path }),
    );
    const storageService = (
      service as unknown as { storageService: ReplayClipStorageService }
    ).storageService;
    vi.spyOn(ReplayClipsRepository.prototype, "deleteMany").mockImplementation(
      () => {
        throw new Error("database failed");
      },
    );
    vi.spyOn(
      storageService,
      "rollbackStoredClipFileDeletion",
    ).mockRejectedValue(new Error("rollback failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      getFileActionsService(service).deleteClipGroupsForRetention(
        [["clip-1"]],
        root,
      ),
    ).resolves.toMatchObject({
      deletedIds: [],
      failed: [{ id: "clip-1", error: "database failed" }],
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Replay clip retention rollback failed"),
      expect.objectContaining({ error: "rollback failed" }),
    );
  });

  it("reports missing retention ids and post-commit cleanup failures", async () => {
    const fileActions = getFileActionsService(service);
    await expect(
      fileActions.deleteClipGroupsForRetention([["missing"]], root),
    ).resolves.toMatchObject({
      deletedIds: [],
      failed: [{ id: "missing", error: "Clip was not found" }],
    });

    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: path }),
    );
    const storageService = (
      service as unknown as { storageService: ReplayClipStorageService }
    ).storageService;
    vi.spyOn(
      storageService,
      "stageStoredClipFilesForDeletion",
    ).mockResolvedValue([]);
    vi.spyOn(
      storageService,
      "finalizeStoredClipFileDeletion",
    ).mockResolvedValue({
      deletedPaths: [],
      failedPaths: [path],
      freedBytes: 0,
    });
    vi.mocked(ReplayClipPreviewService.prototype.remove).mockRejectedValueOnce(
      new Error("preview failed"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      fileActions.deleteClipGroupsForRetention([["clip-1"]], root),
    ).resolves.toMatchObject({
      cleanupErrors: [
        { id: "clip-1", error: "A staged clip file could not be removed" },
      ],
      deletedIds: ["clip-1"],
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Replay clip preview cleanup failed"),
      expect.objectContaining({ clipId: "clip-1", error: "preview failed" }),
    );
  });

  it("handles missing and non-file storage paths during deletion staging", async () => {
    const storageService = (
      service as unknown as { storageService: ReplayClipStorageService }
    ).storageService;
    const missingPath = join(root, "2026-06-12_10-30-00.mp4");
    const missingClip = createReplayClip({ processedClipPath: missingPath });

    await expect(
      storageService.stageStoredClipFilesForDeletion(
        [missingClip],
        new Map(),
        root,
        { ignoreMissing: true },
      ),
    ).resolves.toEqual([]);

    const directoryPath = join(root, "2026-06-12_10-31-00.mp4");
    mkdirSync(directoryPath);
    await expect(
      storageService.stageStoredClipFilesForDeletion(
        [createReplayClip({ processedClipPath: directoryPath })],
        new Map(),
        root,
      ),
    ).rejects.toThrow("Replay clip storage path is not a file");
  });

  it("deletes shared clip paths once using host casing semantics during retention", async () => {
    const sharedPath = join(root, "2026-06-12_10-30-00.mp4");
    const sharedPathAlias = isWindowsOS()
      ? sharedPath.toUpperCase()
      : sharedPath;
    writeFileSync(sharedPath, "video");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: sharedPath }),
    );
    repository.upsert(
      createReplayClip({
        id: "clip-2",
        originalObsPath: sharedPathAlias,
        processedClipPath: null,
      }),
    );
    const fileActions = getFileActionsService(service);
    const storageService = (
      service as unknown as {
        storageService: {
          createStoredPathReferenceCounts(): Map<string, number>;
          removeClipPathReferences(
            clip: ReplayClip,
            counts: Map<string, number>,
          ): void;
          resolveClipFilePath(
            path: string,
            options: { requireExistingFile: boolean },
          ): string | null;
        };
      }
    ).storageService;
    const referenceCounts = storageService.createStoredPathReferenceCounts();
    storageService.removeClipPathReferences(
      repository.get("clip-1")!,
      referenceCounts,
    );
    storageService.removeClipPathReferences(
      repository.get("clip-2")!,
      referenceCounts,
    );

    expect(referenceCounts.size).toBe(0);
    expect(
      storageService.resolveClipFilePath(sharedPathAlias, {
        requireExistingFile: false,
      }),
    ).toBe(sharedPathAlias);

    await expect(
      fileActions.deleteClipGroupsForRetention([["clip-1", "clip-2"]], root),
    ).resolves.toMatchObject({
      deletedIds: ["clip-1", "clip-2"],
      deletedPaths: [resolve(sharedPath)],
      freedBytes: 5,
    });
    expect(existsSync(sharedPath)).toBe(false);
    expect(repository.get("clip-1")).toBeNull();
    expect(repository.get("clip-2")).toBeNull();
    expect(ReplayClipPreviewService.prototype.remove).toHaveBeenCalledTimes(2);
  });

  it("shares one path snapshot while isolating retention group failures", async () => {
    const existingPath = join(root, "2026-06-12_10-30-00.mp4");
    const missingPath = join(root, "2026-06-12_10-31-00.mp4");
    writeFileSync(existingPath, "video");
    repository.upsert(
      createReplayClip({ id: "clip-1", processedClipPath: existingPath }),
    );
    repository.upsert(
      createReplayClip({ id: "clip-2", processedClipPath: missingPath }),
    );
    const listStoragePaths = vi.spyOn(
      ReplayClipsRepository.prototype,
      "listStoragePaths",
    );
    const fileActions = getFileActionsService(service);

    await expect(
      fileActions.deleteClipGroupsForRetention([["clip-1"], ["clip-2"]], root),
    ).resolves.toMatchObject({
      deletedIds: ["clip-1"],
      failed: [expect.objectContaining({ id: "clip-2" })],
    });
    expect(listStoragePaths).toHaveBeenCalledTimes(1);
    expect(repository.get("clip-1")).toBeNull();
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
        cleanupError: "A staged clip file could not be removed",
      });
      expect(existsSync(path)).toBe(false);
      expect(mockedRepository.get("clip-1")).toBeNull();

      writeFileSync(path, "video");
      mockedRepository.upsert(createReplayClip({ processedClipPath: path }));
      await expect(mockedService.deleteManyClips(["clip-1"])).resolves.toEqual({
        ok: true,
        error: null,
        deletedIds: ["clip-1"],
        failed: [],
        cleanupErrors: [
          {
            id: "clip-1",
            error: "A staged clip file could not be removed",
          },
        ],
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
      noteReplayClipUsageChange: vi.fn(),
      scheduleCleanup: cleanup,
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
      estimatedAddedBytes: 5,
      force: false,
      usageAlreadyAccounted: true,
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
