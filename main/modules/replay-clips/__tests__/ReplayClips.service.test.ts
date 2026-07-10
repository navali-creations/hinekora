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
import { ReplayClipsRepository } from "../ReplayClips.repository";
import { ReplayClipsService } from "../ReplayClips.service";
import {
  getReplayMediaProtocolHandler,
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
  isProtocolHandled: vi.fn(),
  netFetch: vi.fn(),
  openPath: vi.fn(),
  protocolHandle: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: electronMocks.getPath },
  BrowserWindow: { getAllWindows: electronMocks.getAllWindows },
  net: { fetch: electronMocks.netFetch },
  protocol: {
    handle: electronMocks.protocolHandle,
    isProtocolHandled: electronMocks.isProtocolHandled,
  },
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

  it("skips existing media protocol handlers and logs setup failures", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    electronMocks.protocolHandle.mockClear();
    electronMocks.isProtocolHandled.mockReturnValue(true);
    new ReplayClipsService();
    expect(electronMocks.protocolHandle).not.toHaveBeenCalled();

    electronMocks.isProtocolHandled.mockImplementation(() => {
      throw new Error("protocol unavailable");
    });
    new ReplayClipsService();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "WARN [replay-clips] Replay media protocol setup failed",
      ),
      { error: "protocol unavailable" },
    );
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
        deleteStoredPathIfUnreferenced(path: string): Promise<void>;
      }
    ).deleteStoredPathIfUnreferenced(path);
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
      const { ReplayClipsService: MockedReplayClipsService } = await import(
        "../ReplayClips.service"
      );
      const internals = Object.create(MockedReplayClipsService.prototype) as {
        deleteStoredPathIfUnreferenced(path: string): Promise<void>;
        isStoredPathReferenced(path: string): boolean;
      };
      internals.isStoredPathReferenced = () => false;

      await expect(
        internals.deleteStoredPathIfUnreferenced(
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
    const internals = service as unknown as {
      deleteClipQueued: () => Promise<{ ok: boolean; error: string | null }>;
    };
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

    service.replaceAll([
      createReplayClip({
        originalObsPath: unsafePath,
        processedClipPath: safePath,
      }),
    ]);

    expect(repository.get("clip-1")).toMatchObject({
      originalObsPath: null,
      processedClipPath: resolve(safePath),
      status: "ready",
    });

    service.upsertMany([
      createReplayClip({
        id: "clip-2",
        originalObsPath: unsafePath,
        processedClipPath: safePath,
      }),
    ]);
    expect(repository.get("clip-2")).toMatchObject({
      originalObsPath: null,
      processedClipPath: resolve(safePath),
    });
  });

  it("serves managed clip media ranges", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const protocolHandler = getReplayMediaProtocolHandler();

    const response = await protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=1-3" },
      }),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 1-3/5");
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "ide",
    );
    expect(
      (
        await protocolHandler(
          new Request("hinekora-media://replay-clip/clip-1", {
            headers: { range: "bytes=0-0" },
          }),
        )
      ).status,
    ).toBe(206);
  });

  it("serves run recording media ranges through the app media protocol", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      getRecordingMediaPath: () => path,
    } as unknown as RecordingStorageService);
    const protocolHandler = getReplayMediaProtocolHandler();

    const response = await protocolHandler(
      new Request("hinekora-media://run-recording/recording-1", {
        headers: { range: "bytes=0-1" },
      }),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-1/5");
    await expect(response.text()).resolves.toBe("vi");
  });

  it("rejects invalid replay media requests", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const protocolHandler = getReplayMediaProtocolHandler();

    expect(
      (await protocolHandler(new Request("hinekora-media://wrong-host/clip-1")))
        .status,
    ).toBe(404);
    expect(
      (
        await protocolHandler(
          new Request("hinekora-media://replay-clip/clip-1", {
            headers: { range: "bytes=10-12" },
          }),
        )
      ).status,
    ).toBe(416);
  });

  it("handles media helper branches for HEAD, suffix ranges, and content types", async () => {
    const path = join(root, "2026-06-12_10-30-00.mkv");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const protocolHandler = getReplayMediaProtocolHandler();

    const headResponse = await protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1", { method: "HEAD" }),
    );
    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get("Content-Length")).toBe("5");
    expect(headResponse.headers.get("Content-Type")).toBe("video/x-matroska");

    const fullResponse = await protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1"),
    );
    expect(fullResponse.status).toBe(200);
    expect(Buffer.from(await fullResponse.arrayBuffer()).toString()).toBe(
      "video",
    );

    const suffixResponse = await protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=-2" },
      }),
    );
    expect(suffixResponse.status).toBe(206);
    expect(suffixResponse.headers.get("Content-Range")).toBe("bytes 3-4/5");
    expect(Buffer.from(await suffixResponse.arrayBuffer()).toString()).toBe(
      "eo",
    );

    const openEndedRangeResponse = await protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=2-" },
      }),
    );
    expect(openEndedRangeResponse.status).toBe(206);
    expect(openEndedRangeResponse.headers.get("Content-Range")).toBe(
      "bytes 2-4/5",
    );

    const headRangeResponse = await protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1", {
        method: "HEAD",
        headers: { range: "bytes=1-2" },
      }),
    );
    expect(headRangeResponse.status).toBe(206);
    expect(await headRangeResponse.text()).toBe("");

    expect(
      (
        await protocolHandler(
          new Request("hinekora-media://replay-clip/clip-1", {
            headers: { range: "bytes=-0" },
          }),
        )
      ).status,
    ).toBe(416);
    expect(
      (
        await protocolHandler(
          new Request("hinekora-media://replay-clip/clip-1", {
            headers: { range: "bytes=-" },
          }),
        )
      ).status,
    ).toBe(416);
    expect(
      (
        await protocolHandler(
          new Request("hinekora-media://replay-clip/clip-1", {
            headers: { range: "not a range" },
          }),
        )
      ).status,
    ).toBe(416);
    expect(
      (
        await protocolHandler(
          new Request("hinekora-media://replay-clip/clip-1", {
            headers: { range: "bytes=3-2" },
          }),
        )
      ).status,
    ).toBe(416);

    const movPath = join(root, "2026-06-12_10-31-00.mov");
    const webmPath = join(root, "2026-06-12_10-32-00.webm");
    const flvPath = join(root, "2026-06-12_10-33-00.flv");
    writeFileSync(movPath, "video");
    writeFileSync(webmPath, "video");
    writeFileSync(flvPath, "video");
    repository.upsert(
      createReplayClip({ id: "clip-mov", processedClipPath: movPath }),
    );
    repository.upsert(
      createReplayClip({ id: "clip-webm", processedClipPath: webmPath }),
    );
    repository.upsert(
      createReplayClip({ id: "clip-flv", processedClipPath: flvPath }),
    );
    expect(
      (
        await protocolHandler(
          new Request("hinekora-media://replay-clip/clip-mov"),
        )
      ).headers.get("Content-Type"),
    ).toBe("video/quicktime");
    expect(
      (
        await protocolHandler(
          new Request("hinekora-media://replay-clip/clip-webm"),
        )
      ).headers.get("Content-Type"),
    ).toBe("video/webm");
    expect(
      (
        await protocolHandler(
          new Request("hinekora-media://replay-clip/clip-flv"),
        )
      ).headers.get("Content-Type"),
    ).toBe("application/octet-stream");
    expect(
      (await protocolHandler(new Request("https://example.test"))).status,
    ).toBe(404);
    expect(
      (
        await protocolHandler(
          new Request(`hinekora-media://replay-clip/${"x".repeat(129)}`),
        )
      ).status,
    ).toBe(404);
  });

  it("returns media misses as bounded responses", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const protocolHandler = getReplayMediaProtocolHandler();

    expect(
      (
        await protocolHandler(
          new Request("hinekora-media://replay-clip/missing"),
        )
      ).status,
    ).toBe(404);
  });

  it("returns media read failures as bounded protocol responses", async () => {
    vi.resetModules();
    vi.doMock("../ReplayClips.media", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../ReplayClips.media")>();

      return {
        ...actual,
        createReplayClipMediaFileResponse: vi.fn(() => {
          throw new Error("read failed");
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
      new MockedReplayClipsService();
      const protocolHandler = electronMocks.protocolHandle.mock.calls.at(
        -1,
      )?.[1] as ((request: Request) => Promise<Response>) | undefined;

      expect(protocolHandler).toBeDefined();
      const failureResponse = await protocolHandler?.(
        new Request("hinekora-media://replay-clip/clip-1"),
      );
      expect(failureResponse?.status).toBe(500);
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("../ReplayClips.media");
      vi.resetModules();
    }
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
