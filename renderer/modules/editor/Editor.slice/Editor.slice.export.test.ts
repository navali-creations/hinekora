import { describe, expect, it, vi } from "vitest";

import type {
  EditorExportInput,
  EditorExportResult,
} from "~/main/modules/editor";

import {
  createEditorTestAsset,
  createEditorTestExportResult,
  createEditorTestProject,
  loadEditorProject,
  setupEditorSliceTest,
} from "./Editor.slice.test-utils";

const { createTestStore, getEditorApi, getProgressTracker } =
  setupEditorSliceTest();

describe("Editor export slice", () => {
  it("updates export progress from main process events", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const progressTracker = getProgressTracker();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, { isAudioMuted: true });
    let resolveExport: (value: EditorExportResult) => void = () => undefined;
    const unsubscribe = vi.fn();
    progressTracker.setExportProgressUnsubscribe(unsubscribe);
    editorApi.exportProject.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExport = resolve;
        }),
    );
    loadEditorProject(store, project, [asset], {
      selectedClipId: "timeline-1",
    });

    const exportRequest = store.getState().editor.exportProject({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });

    expect(store.getState().editor.exportState).toMatchObject({
      progress: 0.02,
      status: "exporting",
    });
    const exportInput = editorApi.exportProject.mock.calls[0]?.[0] as
      | EditorExportInput
      | undefined;
    expect(exportInput?.exportRequestId).toEqual(expect.any(String));

    progressTracker.getExportProgressCallback()?.({
      exportRequestId: "stale-export-request",
      progress: 0.95,
    });
    expect(store.getState().editor.exportState.progress).toBe(0.02);

    progressTracker.getExportProgressCallback()?.({
      exportRequestId: exportInput?.exportRequestId ?? "",
      progress: 0.45,
    });
    expect(store.getState().editor.exportState.progress).toBe(0.45);
    progressTracker.getExportProgressCallback()?.({
      exportRequestId: exportInput?.exportRequestId ?? "",
      progress: 0.25,
    });
    expect(store.getState().editor.exportState.progress).toBe(0.45);
    progressTracker.getExportProgressCallback()?.({
      exportRequestId: exportInput?.exportRequestId ?? "",
      progress: 2,
    });
    expect(store.getState().editor.exportState.progress).toBe(0.98);

    resolveExport(createEditorTestExportResult());
    await exportRequest;

    progressTracker.getExportProgressCallback()?.({
      exportRequestId: exportInput?.exportRequestId ?? "",
      progress: 0.5,
    });
    expect(store.getState().editor.exportState).toMatchObject({
      progress: 1,
      requestId: null,
      status: "ready",
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("completes exports immediately when the render exceeds the minimum duration", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, { isAudioMuted: true });
    const unsubscribe = vi.fn();
    const performanceNow = vi
      .spyOn(performance, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1_000);
    editorApi.onExportProgress.mockReturnValue(unsubscribe);
    editorApi.exportProject.mockResolvedValue(createEditorTestExportResult());
    loadEditorProject(store, project, [asset]);

    try {
      await store.getState().editor.exportProject({
        fileName: "asset-1.mp4",
        mode: "new-file",
        resolution: "1080p",
      });

      expect(store.getState().editor.exportState).toMatchObject({
        progress: 1,
        status: "ready",
      });
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      performanceNow.mockRestore();
    }
  });

  it("copies exports and stores copy failures", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    editorApi.copyExport
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });

    await expect(
      store.getState().editor.copyExport("export-1"),
    ).resolves.toEqual({
      ok: true,
    });
    await expect(
      store.getState().editor.copyExport("export-1"),
    ).resolves.toEqual({
      ok: false,
    });
    expect(store.getState().editor.exportState.error).toBe(
      "Could not copy saved video to clipboard",
    );
  });

  it("tracks current project clipboard copy status", async () => {
    vi.useFakeTimers();
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, { isAudioMuted: true });
    let resolveCopy: (value: { error: null; ok: true }) => void = () =>
      undefined;
    editorApi.copyProjectToClipboard.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCopy = resolve;
        }),
    );
    loadEditorProject(store, project, [asset]);

    try {
      const copyRequest = store.getState().editor.copyProjectToClipboard();

      expect(store.getState().editor.clipboardState).toMatchObject({
        error: null,
        status: "copying",
      });
      await expect(
        store.getState().editor.copyProjectToClipboard(),
      ).resolves.toEqual({
        error: "Clipboard copy is already running",
        ok: false,
      });

      resolveCopy({ error: null, ok: true });
      await expect(copyRequest).resolves.toEqual({ error: null, ok: true });

      expect(editorApi.copyProjectToClipboard).toHaveBeenCalledWith(
        expect.objectContaining({
          durationSeconds: project.durationSeconds,
          muteAudio: true,
          resolution: "1080p",
        }),
      );
      expect(store.getState().editor.clipboardState).toMatchObject({
        error: null,
        status: "copied",
      });

      await vi.runOnlyPendingTimersAsync();

      expect(store.getState().editor.clipboardState).toMatchObject({
        error: null,
        requestId: null,
        status: "idle",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects clipboard copies and exports when no editable clip exists", async () => {
    const store = createTestStore();

    await expect(
      store.getState().editor.copyProjectToClipboard(),
    ).resolves.toEqual({
      error: "No editable clip is selected",
      ok: false,
    });
    expect(store.getState().editor.clipboardState).toMatchObject({
      error: "No editable clip is selected",
      status: "failed",
    });
    await store.getState().editor.exportProject({
      fileName: "empty.mp4",
      mode: "new-file",
      resolution: "720p",
    });

    expect(store.getState().editor.exportState).toMatchObject({
      error: "No editable clip is selected",
      fileName: "empty.mp4",
      status: "failed",
    });
  });

  it("stores export failures and keeps editing after export", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const unsubscribe = vi.fn();
    editorApi.onExportProgress.mockReturnValue(unsubscribe);
    editorApi.exportProject
      .mockRejectedValueOnce("failed")
      .mockRejectedValueOnce(new Error("render failed"));
    loadEditorProject(store, project, [asset]);

    await store.getState().editor.exportProject({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });
    expect(store.getState().editor.exportState).toMatchObject({
      error: "Save failed",
      status: "failed",
    });
    expect(unsubscribe).toHaveBeenCalled();

    await store.getState().editor.exportProject({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });
    expect(store.getState().editor.exportState).toMatchObject({
      error: "render failed",
      status: "failed",
    });

    store.getState().editor.keepEditingAfterExport();
    expect(store.getState().editor.exportState).toMatchObject({
      error: null,
      status: "idle",
    });
  });

  it("ignores stale export failures", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    let rejectExport: (error: unknown) => void = () => undefined;
    editorApi.exportProject.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectExport = reject;
        }),
    );
    editorApi.onExportProgress.mockReturnValue(vi.fn());
    loadEditorProject(store, project, [asset]);

    const exportRequest = store.getState().editor.exportProject({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });
    store.getState().editor.keepEditingAfterExport();
    rejectExport(new Error("failed"));
    await exportRequest;

    expect(store.getState().editor.exportState.status).toBe("idle");
  });

  it("ignores stale export completions", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    let resolveExport: (value: EditorExportResult) => void = () => undefined;
    editorApi.exportProject.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExport = resolve;
        }),
    );
    editorApi.onExportProgress.mockReturnValue(vi.fn());
    loadEditorProject(store, project, [asset]);

    const exportRequest = store.getState().editor.exportProject({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });
    store.getState().editor.keepEditingAfterExport();
    resolveExport(createEditorTestExportResult());
    await exportRequest;

    expect(store.getState().editor.exportState.status).toBe("idle");
  });

  it("reveals exports and stores reveal failures", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    editorApi.revealExport
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });

    await store.getState().editor.revealExport("export-1");
    await store.getState().editor.revealExport("export-1");

    expect(store.getState().editor.exportState.error).toBe(
      "Saved video is not available",
    );
  });
});
