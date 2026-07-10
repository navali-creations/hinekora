import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import * as EditorFfmpeg from "~/main/modules/editor/Editor.ffmpeg";
import * as EditorFiles from "~/main/modules/editor/Editor.files";
import { createReplayClip } from "~/main/test/factories/replayClip";
import * as FileClipboard from "~/main/utils/file-clipboard";

import { createDefaultSettings } from "~/types";
import {
  createDeferred,
  outsideRoot,
  repository,
  root,
  service,
  setupReplayClipsServiceTestHarness,
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

interface ReplayClipQuickTrimRenderInput {
  onProgress?: (progress: number) => void;
  outputPath: string;
  sourcePath: string;
  trim: { inSeconds: number; outSeconds: number };
  muteAudio?: boolean;
}

type ReplayClipsServicePrivateTestHooks = {
  queueClipFileOperation: <T>(
    clipId: string,
    operation: () => Promise<T>,
  ) => Promise<T>;
  renderReplayClipQuickTrim: (
    input: ReplayClipQuickTrimRenderInput,
  ) => Promise<void>;
};

setupReplayClipsServiceTestHarness(electronMocks);

describe("Replay clip copy and update operations", () => {
  it("copies only existing managed clip files to the clipboard", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const copyFileToClipboard = vi
      .spyOn(FileClipboard, "copyFileToClipboard")
      .mockResolvedValue({ ok: true, error: null });

    await expect(service.copyClipToClipboard("clip-1")).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(copyFileToClipboard).toHaveBeenCalledWith(resolve(path));
  });

  it("renders selected trim ranges before copying clips to the clipboard", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 51.6,
        processedClipPath: path,
        targetDurationSeconds: 52,
      }),
    );
    const copyFileToClipboard = vi
      .spyOn(FileClipboard, "copyFileToClipboard")
      .mockResolvedValue({ ok: true, error: null });
    const renderReplayClipQuickTrim = vi
      .spyOn(
        service as unknown as {
          renderReplayClipQuickTrim: (
            input: ReplayClipQuickTrimRenderInput,
          ) => Promise<void>;
        },
        "renderReplayClipQuickTrim",
      )
      .mockImplementation(async (input) => {
        writeFileSync(input.outputPath, "trimmed");
      });

    await expect(
      service.copyClipToClipboard({
        id: "clip-1",
        trim: { inSeconds: 14.76, outSeconds: 36.46 },
      }),
    ).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(renderReplayClipQuickTrim).toHaveBeenCalledWith({
      outputPath: expect.stringContaining("2026-06-12_10-30-00-"),
      sourcePath: resolve(path),
      trim: { inSeconds: 14.76, outSeconds: 36.46 },
    });
    const copiedPath = copyFileToClipboard.mock.calls[0]?.[0];
    expect(copiedPath).not.toBe(resolve(path));
    expect(readFileSync(copiedPath ?? "", "utf8")).toBe("trimmed");
  });

  it("clamps quick trim ranges to the actual clip duration before rendering", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 10,
        processedClipPath: path,
        targetDurationSeconds: 10,
      }),
    );
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });
    const renderReplayClipQuickTrim = vi
      .spyOn(
        service as unknown as {
          renderReplayClipQuickTrim: (
            input: ReplayClipQuickTrimRenderInput,
          ) => Promise<void>;
        },
        "renderReplayClipQuickTrim",
      )
      .mockImplementation(async (input) => {
        writeFileSync(input.outputPath, "trimmed");
      });

    await expect(
      service.copyClipToClipboard({
        id: "clip-1",
        trim: { inSeconds: 10, outSeconds: 10.2 },
      }),
    ).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(renderReplayClipQuickTrim).toHaveBeenCalledWith({
      outputPath: expect.stringContaining("2026-06-12_10-30-00-"),
      sourcePath: resolve(path),
      trim: { inSeconds: 9.9, outSeconds: 10 },
    });
  });

  it("renders the entire clip silently when copy is muted without trim", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });
    const renderReplayClipQuickTrim = vi
      .spyOn(
        service as unknown as {
          renderReplayClipQuickTrim: (
            input: ReplayClipQuickTrimRenderInput,
          ) => Promise<void>;
        },
        "renderReplayClipQuickTrim",
      )
      .mockImplementation(async (input) => {
        writeFileSync(input.outputPath, "trimmed");
      });

    await expect(
      service.copyClipToClipboard({
        id: "clip-1",
        muteAudio: true,
      }),
    ).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(renderReplayClipQuickTrim).toHaveBeenCalledWith({
      outputPath: expect.any(String),
      muteAudio: true,
      sourcePath: resolve(path),
      trim: { inSeconds: 0, outSeconds: 20 },
    });
  });

  it("reports trimmed clipboard render progress with the operation request id", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(
      service as unknown as {
        renderReplayClipQuickTrim: (
          input: ReplayClipQuickTrimRenderInput,
        ) => Promise<void>;
      },
      "renderReplayClipQuickTrim",
    ).mockImplementation(async (input) => {
      input.onProgress?.(0.42);
      writeFileSync(input.outputPath, "trimmed");
    });
    const onProgress = vi.fn();

    await expect(
      service.copyClipToClipboard(
        {
          id: "clip-1",
          muteAudio: true,
          operationRequestId: "copy-request-1",
          trim: { inSeconds: 2, outSeconds: 8 },
        },
        { onProgress },
      ),
    ).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(onProgress).toHaveBeenCalledWith({
      operationRequestId: "copy-request-1",
      progress: 0.42,
    });
  });

  it("reports muted full-range clipboard render progress", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(
      service as unknown as {
        renderReplayClipQuickTrim: (
          input: ReplayClipQuickTrimRenderInput,
        ) => Promise<void>;
      },
      "renderReplayClipQuickTrim",
    ).mockImplementation(async (input) => {
      input.onProgress?.(0.75);
      writeFileSync(input.outputPath, "muted");
    });
    const onProgress = vi.fn();

    await expect(
      service.copyClipToClipboard(
        {
          id: "clip-1",
          muteAudio: true,
          operationRequestId: "muted-copy",
        },
        { onProgress },
      ),
    ).resolves.toEqual({ ok: true, error: null });
    expect(onProgress).toHaveBeenCalledWith({
      operationRequestId: "muted-copy",
      progress: 0.75,
    });
  });

  it("removes trimmed clipboard renders when clipboard copy fails", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    let outputPath = "";
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockResolvedValue({
      ok: false,
      error: "copy failed",
    });
    vi.spyOn(
      service as unknown as {
        renderReplayClipQuickTrim: (
          input: ReplayClipQuickTrimRenderInput,
        ) => Promise<void>;
      },
      "renderReplayClipQuickTrim",
    ).mockImplementation(async (input) => {
      outputPath = input.outputPath;
      writeFileSync(input.outputPath, "trimmed");
    });

    await expect(
      service.copyClipToClipboard({
        id: "clip-1",
        trim: { inSeconds: 2, outSeconds: 8 },
      }),
    ).resolves.toEqual({
      ok: false,
      error: "copy failed",
    });

    expect(outputPath).not.toBe("");
    expect(existsSync(outputPath)).toBe(false);
  });

  it("returns safe errors and removes trimmed clipboard renders when render fails", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    let outputPath = "";
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    vi.spyOn(FileClipboard, "copyFileToClipboard");
    vi.spyOn(
      service as unknown as {
        renderReplayClipQuickTrim: (
          input: ReplayClipQuickTrimRenderInput,
        ) => Promise<void>;
      },
      "renderReplayClipQuickTrim",
    ).mockImplementation(async (input) => {
      outputPath = input.outputPath;
      writeFileSync(input.outputPath, "partial");
      throw new Error("render failed");
    });

    await expect(
      service.copyClipToClipboard({
        id: "clip-1",
        trim: { inSeconds: 2, outSeconds: 8 },
      }),
    ).resolves.toEqual({
      ok: false,
      error: "render failed",
    });

    expect(outputPath).not.toBe("");
    expect(existsSync(outputPath)).toBe(false);
    expect(FileClipboard.copyFileToClipboard).not.toHaveBeenCalled();
  });

  it("renders with source and output being the same path for clipboard exports", async () => {
    const sourcePath = join(root, "same-output.mp4");
    writeFileSync(sourcePath, "source");
    const serviceWithPrivateHooks =
      service as unknown as ReplayClipsServicePrivateTestHooks;
    const renderEditorExportWithFfmpeg = vi
      .spyOn(EditorFfmpeg, "renderEditorExportWithFfmpeg")
      .mockImplementation(async ({ outputPath }) => {
        writeFileSync(outputPath, "trimmed");
      });

    await expect(
      serviceWithPrivateHooks.renderReplayClipQuickTrim({
        sourcePath,
        outputPath: sourcePath,
        trim: { inSeconds: 0, outSeconds: 5 },
      }),
    ).resolves.toBeUndefined();

    expect(renderEditorExportWithFfmpeg).toHaveBeenCalled();
    expect(readFileSync(sourcePath, "utf8")).toBe("trimmed");
  });

  it("renders trimmed clips without progress callback support", async () => {
    const sourcePath = join(root, "no-progress.mp4");
    const outputPath = join(root, "no-progress-output.mp4");
    writeFileSync(sourcePath, "source");
    const serviceWithPrivateHooks =
      service as unknown as ReplayClipsServicePrivateTestHooks;
    const renderEditorExportWithFfmpeg = vi
      .spyOn(EditorFfmpeg, "renderEditorExportWithFfmpeg")
      .mockImplementation(async ({ outputPath: tempOutputPath }) => {
        writeFileSync(tempOutputPath, "trimmed");
      });

    await expect(
      serviceWithPrivateHooks.renderReplayClipQuickTrim({
        sourcePath,
        outputPath,
        trim: { inSeconds: 0.5, outSeconds: 3.4 },
      }),
    ).resolves.toBeUndefined();

    expect(renderEditorExportWithFfmpeg).toHaveBeenCalled();
    expect(readFileSync(outputPath, "utf8")).toBe("trimmed");
  });

  it("handles trimmed clipboard cleanup failures through progress handlers", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    vi.spyOn(
      service as unknown as {
        renderReplayClipQuickTrim: (input: {
          outputPath: string;
          sourcePath: string;
          trim: { inSeconds: number; outSeconds: number };
        }) => Promise<void>;
      },
      "renderReplayClipQuickTrim",
    ).mockResolvedValue(undefined);

    vi.spyOn(
      EditorFiles,
      "cleanupEditorClipboardOutputDirectory",
    ).mockRejectedValue(new Error("cleanup failed"));
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      service.copyClipToClipboard({
        id: "clip-1",
        trim: { inSeconds: 2, outSeconds: 8 },
      }),
    ).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(
      warn.mock.calls.some(([message]) =>
        String(message).includes("Replay clip clipboard cleanup failed"),
      ),
    ).toBe(true);
  });

  it("forces the queue to continue when a queued operation rejects", async () => {
    const serviceWithPrivateHooks =
      service as unknown as ReplayClipsServicePrivateTestHooks;
    const first = serviceWithPrivateHooks.queueClipFileOperation(
      "clip-1",
      async () => {
        throw new Error("queued fail");
      },
    );
    const second = serviceWithPrivateHooks.queueClipFileOperation(
      "clip-1",
      async () => "next",
    );

    await expect(first).rejects.toThrow("queued fail");
    await expect(second).resolves.toBe("next");
  });

  it("recovers the global stored-file mutation queue after rejection", async () => {
    const internals = service as unknown as {
      queueStoredFileMutation<T>(operation: () => Promise<T>): Promise<T>;
      storedFileMutationQueue: Promise<unknown>;
    };
    const first = internals.queueStoredFileMutation(async () => {
      throw new Error("mutation failed");
    });
    await expect(first).rejects.toThrow("mutation failed");

    internals.storedFileMutationQueue = Promise.reject(
      new Error("stale queue failure"),
    );
    await expect(
      internals.queueStoredFileMutation(async () => "recovered"),
    ).resolves.toBe("recovered");
  });

  it("queues copy and update operations for the same clip", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    const updateRender = createDeferred();
    const renderOrder: string[] = [];
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(
      service as unknown as {
        renderReplayClipQuickTrim: (
          input: ReplayClipQuickTrimRenderInput,
        ) => Promise<void>;
      },
      "renderReplayClipQuickTrim",
    ).mockImplementation(async (input) => {
      renderOrder.push(input.trim.inSeconds === 1 ? "update" : "copy");
      if (input.trim.inSeconds === 1) {
        await updateRender.promise;
      }
      writeFileSync(input.outputPath, "trimmed");
    });

    const updatePromise = service.updateClipFile({
      id: "clip-1",
      trim: { inSeconds: 1, outSeconds: 10 },
    });
    await Promise.resolve();
    const copyPromise = service.copyClipToClipboard({
      id: "clip-1",
      trim: { inSeconds: 2, outSeconds: 6 },
    });
    await Promise.resolve();

    await vi.waitFor(() => expect(renderOrder).toEqual(["update"]));
    updateRender.resolve();
    await expect(updatePromise).resolves.toMatchObject({ ok: true });
    await expect(copyPromise).resolves.toEqual({ ok: true, error: null });
    expect(renderOrder).toEqual(["update", "copy"]);
  });

  it("queues delete operations behind updates for the same clip", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    const updateRender = createDeferred();
    const renderOrder: string[] = [];
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    vi.spyOn(
      service as unknown as {
        renderReplayClipQuickTrim: (
          input: ReplayClipQuickTrimRenderInput,
        ) => Promise<void>;
      },
      "renderReplayClipQuickTrim",
    ).mockImplementation(async (input) => {
      renderOrder.push("update");
      await updateRender.promise;
      writeFileSync(input.outputPath, "trimmed");
    });

    const updatePromise = service.updateClipFile({
      id: "clip-1",
      trim: { inSeconds: 1, outSeconds: 10 },
    });
    await Promise.resolve();
    const deletePromise = service.deleteClip("clip-1");
    await Promise.resolve();

    await vi.waitFor(() => expect(renderOrder).toEqual(["update"]));
    expect(repository.get("clip-1")).not.toBeNull();
    expect(existsSync(path)).toBe(true);
    updateRender.resolve();
    await expect(updatePromise).resolves.toMatchObject({ ok: true });
    await expect(deletePromise).resolves.toEqual({ ok: true, error: null });
    expect(repository.get("clip-1")).toBeNull();
    expect(existsSync(path)).toBe(false);
  });

  it("keeps in-place trim updates successful when backup cleanup fails", async () => {
    vi.resetModules();
    const path = join(root, "2026-06-12_10-30-00.mp4");
    let resetDynamicDatabase: () => void = () => {};
    let renderedTempOutputPath = "";
    writeFileSync(path, "video");
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>();

      return {
        ...actual,
        rm: vi.fn(
          async (
            targetPath: Parameters<typeof actual.rm>[0],
            options?: Parameters<typeof actual.rm>[1],
          ) => {
            if (
              renderedTempOutputPath &&
              resolve(String(targetPath)) !== resolve(renderedTempOutputPath) &&
              String(targetPath).includes(".hinekora-")
            ) {
              throw new Error("backup cleanup failed");
            }

            return actual.rm(targetPath, options);
          },
        ),
      };
    });
    vi.doMock("~/main/modules/editor/Editor.ffmpeg", () => ({
      renderEditorExportWithFfmpeg: vi.fn(
        async (input: { outputPath: string }) => {
          renderedTempOutputPath = input.outputPath;
          writeFileSync(input.outputPath, "trimmed");
        },
      ),
    }));

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
      mockedRepository.upsert(
        createReplayClip({
          durationSeconds: 20,
          processedClipPath: path,
          targetDurationSeconds: 20,
        }),
      );
      const mockedService = new MockedReplayClipsService();

      await expect(
        mockedService.updateClipFile({
          id: "clip-1",
          trim: { inSeconds: 1, outSeconds: 7 },
        }),
      ).resolves.toMatchObject({ error: null, ok: true });
      expect(readFileSync(path, "utf8")).toBe("trimmed");
      expect(renderedTempOutputPath).not.toBe("");
      expect(mockedRepository.get("clip-1")).toMatchObject({
        durationSeconds: 6,
      });
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("node:fs/promises");
      vi.doUnmock("~/main/modules/editor/Editor.ffmpeg");
      vi.resetModules();
    }
  });

  it("renders the entire clip silently when saving with mute enabled", async () => {
    const path = join(root, "2026-06-12_10-30-00-death-20s.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        id: "clip-1",
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    const renderReplayClipQuickTrim = vi
      .spyOn(
        service as unknown as {
          renderReplayClipQuickTrim: (
            input: ReplayClipQuickTrimRenderInput,
          ) => Promise<void>;
        },
        "renderReplayClipQuickTrim",
      )
      .mockImplementation(async (input) => {
        writeFileSync(input.outputPath, "muted");
      });

    await expect(
      service.updateClipFile({
        id: "clip-1",
        muteAudio: true,
      }),
    ).resolves.toMatchObject({
      ok: true,
    });

    expect(renderReplayClipQuickTrim).toHaveBeenCalledWith({
      outputPath: expect.stringContaining(".hinekora-"),
      muteAudio: true,
      sourcePath: resolve(path),
      trim: { inSeconds: 0, outSeconds: 20 },
    });
  });

  it("cleans up source when updating a trimmed renamed clip", async () => {
    const path = join(root, "2026-06-12_10-30-00-death-20s.mp4");
    const outputPath = join(root, "Renamed.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    vi.spyOn(
      service as unknown as {
        renderReplayClipQuickTrim: (input: {
          outputPath: string;
          sourcePath: string;
          trim: { inSeconds: number; outSeconds: number };
        }) => Promise<void>;
      },
      "renderReplayClipQuickTrim",
    ).mockImplementation(async (input) => {
      writeFileSync(input.outputPath, "trimmed");
    });

    await expect(
      service.updateClipFile({
        id: "clip-1",
        name: "Renamed",
        trim: { inSeconds: 1, outSeconds: 10 },
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(existsSync(path)).toBe(false);
    expect(existsSync(outputPath)).toBe(true);
  });

  it("returns failed update when trimmed output cannot be persisted", async () => {
    const path = join(root, "2026-06-12_10-30-00-death-15s.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 20,
        processedClipPath: path,
        targetDurationSeconds: 20,
      }),
    );
    vi.spyOn(
      service as unknown as {
        renderReplayClipQuickTrim: (input: {
          outputPath: string;
          sourcePath: string;
          trim: { inSeconds: number; outSeconds: number };
        }) => Promise<void>;
      },
      "renderReplayClipQuickTrim",
    ).mockResolvedValue(undefined);

    await expect(
      service.updateClipFile({
        id: "clip-1",
        name: "Renamed",
        trim: { inSeconds: 1, outSeconds: 10 },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining("ENOENT:"),
    });
  });

  it("returns safe errors when clip clipboard copy throws", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockRejectedValue(
      new Error("clipboard exploded"),
    );

    await expect(service.copyClipToClipboard("clip-1")).resolves.toEqual({
      ok: false,
      error: "clipboard exploded",
    });
  });

  it("blocks clipboard copy for imported paths outside managed storage", async () => {
    const path = join(outsideRoot, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const copyFileToClipboard = vi.spyOn(FileClipboard, "copyFileToClipboard");

    await expect(service.copyClipToClipboard("clip-1")).resolves.toEqual({
      ok: false,
      error: "Clip file path is not available",
    });
    expect(copyFileToClipboard).not.toHaveBeenCalled();
  });
});
