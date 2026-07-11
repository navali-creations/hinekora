import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import * as EditorFfmpeg from "~/main/modules/editor/Editor.ffmpeg";
import { WindowName } from "~/main/modules/main-window";
import {
  createReplayClip,
  createReplayClipView,
} from "~/main/test/factories/replayClip";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import { registerIpcWindowRole } from "~/main/utils/ipc-window-roles";

import { ReplayClipsChannel } from "../ReplayClips.channels";
import {
  createUpdatedClipForStoredPath,
  resolveReplayClipQuickTrim,
} from "../ReplayClips.file-actions";
import { resolveReplayClipRenameTarget } from "../ReplayClips.file-operations";
import { ReplayClipsService } from "../ReplayClips.service";
import {
  validateReplayClipCopyInput,
  validateReplayClipUpdateInput,
} from "../ReplayClips.validation";
import {
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

setupReplayClipsServiceTestHarness(electronMocks);

function getFileActionsService(): unknown {
  return (
    service as unknown as {
      fileActionsService: unknown;
    }
  ).fileActionsService;
}

describe("ReplayClipsService boundaries", () => {
  it("registers media protocol setup defensively", () => {
    expect(new ReplayClipsService()).toBeInstanceOf(ReplayClipsService);
  });

  it("covers copy input validation and trim clamp edge cases", () => {
    const copiedTrim = resolveReplayClipQuickTrim(
      {
        inSeconds: Number.NaN,
        outSeconds: Number.NaN,
      },
      60,
    );

    expect(copiedTrim).toEqual({
      inSeconds: 0,
      outSeconds: 0.1,
    });

    expect(
      validateReplayClipCopyInput({
        id: "clip-1",
        operationRequestId: "op",
      }),
    ).toEqual({
      id: "clip-1",
      operationRequestId: "op",
    });
    expect(
      validateReplayClipCopyInput({
        id: "clip-1",
        muteAudio: true,
      }),
    ).toEqual({
      id: "clip-1",
      muteAudio: true,
    });
    expect(() =>
      validateReplayClipCopyInput({
        id: "clip-1",
        muteAudio: "yes",
      }),
    ).toThrow("mute clip audio must be a boolean");
  });

  it("covers replay clip service internals for edge branches", async () => {
    const internals = service as unknown as {
      getClipView(id: string): unknown;
      resolveReplayTriggerBatchQueued: (
        clipId: string,
        events: [],
      ) => Promise<unknown>;
      resolveReplayClipRenameTarget: (
        sourcePath: string,
        name: string | null,
      ) => string | null;
      storageService: {
        getStoredClipMediaPath(id: string): string | null;
      };
    };
    const fileActions = getFileActionsService() as {
      queueClipFileOperation: <T>(
        clipId: string,
        operation: () => Promise<T>,
      ) => Promise<T>;
    };

    await expect(
      fileActions
        .queueClipFileOperation("clip-1", () => {
          return Promise.reject(new Error("boom"));
        })
        .catch(() => undefined),
    ).resolves.toBeUndefined();
    await expect(
      fileActions.queueClipFileOperation("clip-1", () => Promise.resolve("ok")),
    ).resolves.toBe("ok");

    const originalOnlyPath = join(root, "2026-06-12_10-36-00.mp4");
    repository.upsert(
      createReplayClip({
        id: "original-only",
        originalObsPath: originalOnlyPath,
        processedClipPath: null,
      }),
    );
    expect(
      internals.storageService.getStoredClipMediaPath("original-only"),
    ).toBe(resolve(originalOnlyPath));
    expect(internals.getClipView("missing-view")).toBeNull();
    expect(service.getMediaPath("missing-view")).toBeNull();
    await expect(
      internals.resolveReplayTriggerBatchQueued("missing-view", []),
    ).resolves.toBeNull();

    const sourcePath = join(root, "renamed.mp4");
    const sourceConflict = join(root, "renamed (2).mp4");
    const secondConflict = join(root, "renamed (3).mp4");
    writeFileSync(sourcePath, "source");
    writeFileSync(sourceConflict, "conflict");
    writeFileSync(secondConflict, "conflict");
    await expect(
      resolveReplayClipRenameTarget(sourcePath, "Renamed"),
    ).resolves.toBeNull();
    await expect(
      resolveReplayClipRenameTarget(sourceConflict, "Renamed"),
    ).resolves.toBeNull();

    await expect(service.copyClipToClipboard("missing-clip")).resolves.toEqual({
      ok: false,
      error: "Clip was not found",
    });
    await expect(
      service.updateClipFile({ id: "missing-clip" }),
    ).resolves.toEqual({
      ok: false,
      detail: null,
      error: "Clip was not found",
    });
    repository.upsert(
      createReplayClip({
        id: "pathless-clip",
        originalObsPath: null,
        processedClipPath: null,
      }),
    );
    await expect(
      service.updateClipFile({ id: "pathless-clip" }),
    ).resolves.toEqual({
      ok: false,
      detail: null,
      error: "Clip file path is not available",
    });

    repository.upsert(
      createReplayClip({
        id: "renamed-clip",
        processedClipPath: join(root, "2026-07-09_10-00-00.mp4"),
      }),
    );
    writeFileSync(join(root, "2026-07-09_10-00-00.mp4"), "video");
    await expect(
      service.updateClipFile({ id: "renamed-clip" }),
    ).resolves.toMatchObject({
      ok: true,
      error: null,
      detail: expect.anything(),
    });
  });

  it("covers remaining helper branches in clip update and queue internals", async () => {
    const helperService = getFileActionsService() as {
      queueClipFileOperation: <T>(
        clipId: string,
        operation: () => Promise<T>,
      ) => Promise<T>;
      renderReplayClipQuickTrim: (input: {
        onProgress?: (progress: number) => void;
        outputPath: string;
        sourcePath: string;
        trim: { inSeconds: number; outSeconds: number };
      }) => Promise<void>;
    };

    const sourcePath = join(root, "2026-06-12_10-30-00.mp4");
    const sourceWithoutExt = join(root, "source-without-extension");
    writeFileSync(sourcePath, "video");
    writeFileSync(sourceWithoutExt, "video");
    const renameOutput = join(root, "renamed-output.mp4");
    vi.spyOn(EditorFfmpeg, "renderEditorExportWithFfmpeg").mockImplementation(
      async ({ outputPath }) => {
        writeFileSync(outputPath, "trimmed");
      },
    );

    repository.upsert(
      createReplayClip({
        id: "clip-helpers",
        durationSeconds: 20,
        processedClipPath: sourcePath,
        targetDurationSeconds: 20,
      }),
    );

    const onProgress = vi.fn();
    const renderEditorExportWithFfmpeg = vi.mocked(
      EditorFfmpeg.renderEditorExportWithFfmpeg,
    );

    const updateResult = await service.updateClipFile(
      {
        id: "clip-helpers",
        trim: { inSeconds: 1, outSeconds: 4 },
        operationRequestId: "op",
      },
      { onProgress },
    );
    expect(updateResult).toMatchObject({ ok: true });
    expect(renderEditorExportWithFfmpeg).toHaveBeenCalledWith(
      expect.objectContaining({
        onProgress: expect.any(Function),
      }),
    );

    await expect(
      helperService.queueClipFileOperation("clip-helpers", async () =>
        Promise.resolve("done"),
      ),
    ).resolves.toBe("done");

    await expect(
      resolveReplayClipRenameTarget(sourceWithoutExt, "Renamed"),
    ).resolves.toBe(resolve(join(root, "Renamed.mp4")));
    await expect(
      resolveReplayClipRenameTarget(sourceWithoutExt, "\n\t"),
    ).resolves.toBeNull();
    await expect(
      resolveReplayClipRenameTarget(sourceWithoutExt, "A\tB"),
    ).resolves.toBe(resolve(join(root, "A B.mp4")));
    await expect(
      resolveReplayClipRenameTarget(sourceWithoutExt, ".mp4"),
    ).resolves.toBe(resolve(join(root, ".mp4.mp4")));

    await expect(
      helperService.renderReplayClipQuickTrim({
        sourcePath,
        outputPath: renameOutput,
        trim: { inSeconds: 1, outSeconds: 5 },
        onProgress: vi.fn(),
      }),
    ).resolves.toBeUndefined();

    const clipWithNoProcessedPath = createReplayClip({
      id: "clip-no-processed",
      durationSeconds: 20,
      originalObsPath: sourcePath,
      processedClipPath: null,
    });
    const updatedClip = createUpdatedClipForStoredPath({
      clip: clipWithNoProcessedPath,
      durationSeconds: 10,
      path: sourcePath,
      sizeBytes: 12,
    });
    expect(updatedClip.processedClipPath).toBeNull();

    expect(
      resolveReplayClipQuickTrim({ inSeconds: 0, outSeconds: 20 }, Infinity),
    ).toEqual({ inSeconds: 0, outSeconds: 20 });

    await expect(
      service.updateClipFile({
        id: "clip-helpers",
        trim: { inSeconds: 0.0004, outSeconds: 20 },
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("resolves rename targets and validates update operation ids", async () => {
    const sourcePath = join(root, "clip-source.mp4");
    const existingBase = join(root, "renamed.mp4");
    writeFileSync(sourcePath, "video");
    writeFileSync(existingBase, "other");
    const renameTarget = await resolveReplayClipRenameTarget(
      sourcePath,
      "Renamed",
    );

    expect(renameTarget).toBe(resolve(root, "Renamed (2).mp4"));

    expect(
      validateReplayClipUpdateInput({
        id: "clip-1",
        operationRequestId: "op",
      }),
    ).toEqual({
      id: "clip-1",
      operationRequestId: "op",
    });
    expect(
      validateReplayClipUpdateInput({
        id: "clip-1",
        muteAudio: false,
      }),
    ).toEqual({
      id: "clip-1",
      muteAudio: false,
    });
    expect(() =>
      validateReplayClipUpdateInput({
        id: "clip-1",
        muteAudio: 1 as unknown as boolean,
      }),
    ).toThrow("mute clip audio must be a boolean");
  });

  it("registers IPC handlers with validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    const ipcService = new ReplayClipsService();
    const clip = createReplayClip();
    const clipView = createReplayClipView();
    const {
      originalObsPath: _originalObsPath,
      processedClipPath: _processedClipPath,
      ...clipWithoutPaths
    } = clip;
    void _originalObsPath;
    void _processedClipPath;
    const rendererClip = {
      ...clipWithoutPaths,
      fileName: null,
      hasMediaFile: false,
    };
    vi.spyOn(ipcService, "listLibrary").mockResolvedValue({
      availableLeagues: ["Standard"],
      items: [clipView],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 20,
      sortBy: "createdAt",
      sortDirection: "desc",
      totalCount: 1,
    });
    vi.spyOn(ipcService, "getClip").mockReturnValue({
      clip,
      durationSeconds: null,
      mediaUrl: "hinekora-media://replay-clip/clip-1",
    });
    vi.spyOn(ipcService, "saveManualReplay").mockResolvedValue(clip);
    vi.spyOn(ipcService, "updateClipFile").mockResolvedValue({
      detail: {
        clip: clipView,
        durationSeconds: null,
        mediaUrl: "hinekora-media://replay-clip/clip-1",
      },
      error: null,
      ok: true,
    });
    vi.spyOn(ipcService, "openClip").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "revealClip").mockReturnValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "copyClipToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "deleteClip").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "deleteManyClips").mockResolvedValue({
      ok: true,
      error: null,
      deletedIds: ["clip-1"],
      failed: [],
    });
    const sendProgress = vi.fn();
    vi.spyOn(ipcService, "updateClipFile").mockImplementation(
      (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _input: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options?: any,
      ) => {
        options?.onProgress?.({
          operationRequestId: "op",
          progress: 0.4,
        });

        return Promise.resolve({
          detail: {
            clip: clipView,
            durationSeconds: null,
            mediaUrl: "hinekora-media://replay-clip/clip-1",
          },
          error: null,
          ok: true,
        });
      },
    );
    vi.spyOn(ipcService, "copyClipToClipboard").mockImplementation(
      (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _input: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options?: any,
      ) => {
        options?.onProgress?.({
          operationRequestId: "op",
          progress: 0.6,
        });

        return Promise.resolve({ ok: true, error: null });
      },
    );
    const eventWithProgress = {
      sender: {
        id: 42,
        isDestroyed: () => false,
        send: sendProgress,
      },
    };
    registerIpcWindowRole({ id: 42 }, WindowName.Main);
    registerIpcWindowRole({ id: 42 }, WindowName.ClipPreviewOverlay);

    expect(await handlers.get(ReplayClipsChannel.Get)?.({}, "clip-1")).toEqual({
      clip: rendererClip,
      durationSeconds: null,
      mediaUrl: "hinekora-media://replay-clip/clip-1",
      previewMediaUrl: null,
    });
    expect(await handlers.get(ReplayClipsChannel.ListLibrary)?.({})).toEqual(
      expect.objectContaining({ items: [clipView] }),
    );
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { game: "poe1", kind: "death" },
      ),
    ).toEqual(expect.objectContaining({ items: [clipView] }));
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        {
          pageIndex: 0,
          pageSize: 20,
          sortBy: "createdAt",
          sortDirection: "asc",
        },
      ),
    ).toEqual(expect.objectContaining({ items: [clipView] }));
    expect(
      await handlers.get(ReplayClipsChannel.SaveManualReplay)?.({}),
    ).toEqual(rendererClip);
    vi.mocked(ipcService.saveManualReplay).mockResolvedValueOnce(null);
    expect(
      await handlers.get(ReplayClipsChannel.SaveManualReplay)?.({}),
    ).toBeNull();
    expect(
      await handlers.get(ReplayClipsChannel.Update)?.(eventWithProgress, {
        id: "clip-1",
        name: "Renamed clip",
        operationRequestId: "op",
        trim: { inSeconds: 1, outSeconds: 2 },
      }),
    ).toEqual({
      detail: {
        clip: clipView,
        durationSeconds: null,
        mediaUrl: "hinekora-media://replay-clip/clip-1",
      },
      error: null,
      ok: true,
    });
    expect(await handlers.get(ReplayClipsChannel.Open)?.({}, "clip-1")).toEqual(
      {
        ok: true,
        error: null,
      },
    );
    expect(
      await handlers.get(ReplayClipsChannel.Reveal)?.({}, "clip-1"),
    ).toEqual({
      ok: true,
      error: null,
    });
    registerIpcWindowRole({ id: 42 }, WindowName.ClipPreviewOverlay);
    const clipPreviewEvent = { sender: { id: 42 } };
    expect(
      await handlers.get(ReplayClipsChannel.Get)?.(clipPreviewEvent, "clip-1"),
    ).toEqual({
      clip: rendererClip,
      durationSeconds: null,
      mediaUrl: "hinekora-media://replay-clip/clip-1",
      previewMediaUrl: null,
    });
    expect(() =>
      handlers.get(ReplayClipsChannel.Open)?.(clipPreviewEvent, "clip-1"),
    ).toThrow(`${ReplayClipsChannel.Open} is not available from this window`);
    expect(
      await handlers.get(ReplayClipsChannel.Copy)?.(eventWithProgress, {
        id: "clip-1",
        operationRequestId: "op",
        trim: { inSeconds: 1, outSeconds: 2 },
      }),
    ).toEqual({
      ok: true,
      error: null,
    });
    expect(sendProgress).toHaveBeenCalledWith(
      ReplayClipsChannel.OperationProgress,
      {
        operationRequestId: "op",
        progress: 0.4,
      },
    );
    await expect(
      handlers.get(ReplayClipsChannel.Copy)?.({}, { id: "clip-1" }),
    ).resolves.toEqual({ ok: true, error: null });
    await expect(
      handlers.get(ReplayClipsChannel.Copy)?.(
        { sender: { id: 42, isDestroyed: () => true } },
        { id: "clip-1" },
      ),
    ).resolves.toEqual({ ok: true, error: null });
    await expect(
      handlers.get(ReplayClipsChannel.Copy)?.(
        {
          sender: {
            id: 42,
            isDestroyed: () => false,
            send: () => {
              throw new Error("send failed");
            },
          },
        },
        { id: "clip-1" },
      ),
    ).resolves.toEqual({ ok: true, error: null });
    expect(sendProgress).toHaveBeenCalledWith(
      ReplayClipsChannel.OperationProgress,
      {
        operationRequestId: "op",
        progress: 0.6,
      },
    );
    expect(
      await handlers.get(ReplayClipsChannel.Delete)?.({}, "clip-1"),
    ).toEqual({
      ok: true,
      error: null,
    });
    expect(
      await handlers.get(ReplayClipsChannel.DeleteMany)?.({}, ["clip-1"]),
    ).toEqual({
      ok: true,
      error: null,
      deletedIds: ["clip-1"],
      failed: [],
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { game: "poe3" },
      ),
    ).toEqual({
      ok: false,
      error: "game is invalid",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { kind: "boss" },
      ),
    ).toEqual({
      ok: false,
      error: "clip kind is invalid",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.({}, { league: "" }),
    ).toEqual({
      ok: false,
      error: "league is too short",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { pageIndex: -1 },
      ),
    ).toEqual({
      ok: false,
      error: "page index is too small",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { pageSize: 101 },
      ),
    ).toEqual({
      ok: false,
      error: "page size is too large",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { sortDirection: "sideways" },
      ),
    ).toEqual({
      ok: false,
      error: "sort direction is invalid",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { sortBy: "unknown" },
      ),
    ).toEqual({
      ok: false,
      error: "sort field is invalid",
    });
    expect(await handlers.get(ReplayClipsChannel.Open)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.Get)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.Update)?.({}, {})).toEqual({
      ok: false,
      error: "id must be a string",
    });
    expect(
      await handlers.get(ReplayClipsChannel.Update)?.(
        {},
        { id: "clip-1", trim: { inSeconds: 1, outSeconds: 1.05 } },
      ),
    ).toEqual({
      ok: false,
      error: "trim range is too short",
    });
    expect(
      await handlers.get(ReplayClipsChannel.Copy)?.(
        {},
        { id: "clip-1", trim: { inSeconds: 1, outSeconds: 1.05 } },
      ),
    ).toEqual({
      ok: false,
      error: "trim range is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.Reveal)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.Copy)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.Delete)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.DeleteMany)?.({}, "")).toEqual(
      {
        ok: false,
        error: "ids must be an array",
      },
    );
    expect(
      await handlers.get(ReplayClipsChannel.DeleteMany)?.(
        {},
        Array.from({ length: 101 }, (_, index) => `clip-${index}`),
      ),
    ).toEqual({
      ok: false,
      error: "ids is too large",
    });
    expect(
      await handlers.get(ReplayClipsChannel.DeleteMany)?.({}, [""]),
    ).toEqual({
      ok: false,
      error: "id is too short",
    });
    await handlers.get(ReplayClipsChannel.DeleteMany)?.({}, [
      "clip-1",
      "clip-1",
    ]);
    expect(ipcService.deleteManyClips).toHaveBeenLastCalledWith(["clip-1"]);
  });
});
