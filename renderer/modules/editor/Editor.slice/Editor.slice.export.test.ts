import { describe, expect, it, vi } from "vitest";

import type {
  EditorExportInput,
  EditorExportResult,
} from "~/main/modules/editor";

import {
  createDeferred,
  createEditorTestAsset,
  createEditorTestExportResult,
  createEditorTestProject,
  loadEditorProject,
  setupEditorSliceTest,
} from "./Editor.slice.test-utils";

const { createTestStore, getEditorApi, getProgressTracker } =
  setupEditorSliceTest();

describe("Editor export slice", () => {
  it("rehydrates an active export and keeps its lifecycle after a refresh", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const progressTracker = getProgressTracker();
    const result = createEditorTestExportResult();
    editorApi.getExportLifecycle.mockResolvedValue({
      error: null,
      exportRequestId: "export-request-refresh",
      fileName: "refresh.mp4",
      progress: 0.35,
      projectId: "project-refresh",
      result: null,
      status: "exporting",
    });

    const unsubscribe = store.getState().editor.startExportStateListening();
    await store.getState().editor.hydrateExportState();

    expect(store.getState().editor.exportState).toMatchObject({
      fileName: "refresh.mp4",
      isViewOpen: true,
      progress: 0.35,
      projectId: "project-refresh",
      requestId: "export-request-refresh",
      status: "exporting",
    });
    store.getState().editor.dismissExportNotice("keep-editing-safely");
    store.getState().editor.dismissExportNotice("keep-editing-safely");
    expect(store.getState().editor.exportState.dismissedNoticeIds).toEqual([
      "keep-editing-safely",
    ]);
    const refreshedStore = createTestStore();
    await refreshedStore.getState().editor.hydrateExportState();
    expect(
      refreshedStore.getState().editor.exportState.dismissedNoticeIds,
    ).toEqual(["keep-editing-safely"]);

    store.getState().editor.keepEditingAfterExport();
    progressTracker.getExportLifecycleCallback()?.({
      error: null,
      exportRequestId: "export-request-refresh",
      fileName: "refresh.mp4",
      progress: 0.6,
      projectId: "project-refresh",
      result: null,
      status: "exporting",
    });
    expect(store.getState().editor.exportState).toMatchObject({
      dismissedNoticeIds: ["keep-editing-safely"],
      isViewOpen: false,
      progress: 0.6,
      status: "exporting",
    });
    expect(editorApi.dismissExport).not.toHaveBeenCalled();

    progressTracker.getExportLifecycleCallback()?.({
      error: null,
      exportRequestId: "export-request-refresh",
      fileName: result.fileName,
      progress: 1,
      projectId: "project-refresh",
      result,
      status: "ready",
    });
    expect(store.getState().editor.exportState).toMatchObject({
      isViewOpen: false,
      progress: 1,
      result,
      status: "ready",
    });

    store.getState().editor.viewExport();
    store.getState().editor.keepEditingAfterExport();
    expect(store.getState().editor.exportState.status).toBe("idle");
    expect(editorApi.dismissExport).toHaveBeenCalledTimes(1);

    progressTracker.getExportLifecycleCallback()?.({
      error: "render failed",
      exportRequestId: "export-request-failed",
      fileName: "failed.mp4",
      progress: 0,
      projectId: "project-failed",
      result: null,
      status: "failed",
    });
    expect(store.getState().editor.exportState).toMatchObject({
      error: "render failed",
      dismissedNoticeIds: [],
      isViewOpen: true,
      status: "failed",
    });
    progressTracker.getExportLifecycleCallback()?.({
      error: null,
      exportRequestId: null,
      fileName: null,
      progress: 0,
      projectId: null,
      result: null,
      status: "idle",
    });
    expect(store.getState().editor.exportState.status).toBe("idle");

    unsubscribe();
    expect(
      progressTracker.getExportLifecycleUnsubscribe(),
    ).toHaveBeenCalledTimes(1);
  });

  it("keeps the app usable when export lifecycle synchronization fails", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    editorApi.getExportLifecycle.mockRejectedValueOnce(new Error("offline"));

    try {
      await store.getState().editor.hydrateExportState();
      expect(store.getState().editor.exportState.status).toBe("idle");
      expect(consoleWarn).toHaveBeenCalledWith(
        "[editor] Export state hydration failed",
        { error: expect.any(Error) },
      );

      store.setState((state) => ({
        editor: {
          ...state.editor,
          exportState: {
            ...state.editor.exportState,
            error: "failed",
            isViewOpen: true,
            status: "failed",
          },
        },
      }));
      editorApi.dismissExport.mockRejectedValueOnce(new Error("offline"));
      store.getState().editor.keepEditingAfterExport();
      await Promise.resolve();
      expect(consoleWarn).toHaveBeenCalledWith(
        "[editor] Export state dismissal failed",
        { error: expect.any(Error) },
      );
    } finally {
      consoleWarn.mockRestore();
    }
  });

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
    await vi.waitFor(() => {
      expect(editorApi.exportProject).toHaveBeenCalledTimes(1);
    });
    const exportInput = editorApi.exportProject.mock.calls[0]?.[0] as
      | EditorExportInput
      | undefined;
    expect(exportInput?.exportRequestId).toEqual(expect.any(String));
    expect(exportInput?.clips[0]).toMatchObject({ playbackRate: 1 });
    expect(exportInput?.projectId).toBe(project.id);
    expect(editorApi.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({ id: project.id }),
    });
    expect(editorApi.saveProject.mock.invocationCallOrder[0]).toBeLessThan(
      editorApi.exportProject.mock.invocationCallOrder[0] ?? 0,
    );

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
          clips: [expect.objectContaining({ playbackRate: 1 })],
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

  it("keeps background export failures after leaving the processing view", async () => {
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
    await vi.waitFor(() => {
      expect(editorApi.exportProject).toHaveBeenCalledTimes(1);
    });
    store.getState().editor.keepEditingAfterExport();
    expect(store.getState().editor.exportState).toMatchObject({
      isViewOpen: false,
      status: "exporting",
    });
    rejectExport(new Error("failed"));
    await exportRequest;

    expect(store.getState().editor.exportState).toMatchObject({
      error: "failed",
      isViewOpen: false,
      status: "failed",
    });
  });

  it("keeps background export completions after leaving the processing view", async () => {
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
    expect(store.getState().editor.exportState.isViewOpen).toBe(false);
    await expect(
      store.getState().editor.copyProjectToClipboard(),
    ).resolves.toEqual({
      error: "Wait for the current save to finish",
      ok: false,
    });
    await store.getState().editor.exportProject({
      fileName: "second.mp4",
      mode: "new-file",
      resolution: "720p",
    });
    expect(editorApi.copyProjectToClipboard).not.toHaveBeenCalled();
    expect(editorApi.exportProject).toHaveBeenCalledTimes(1);
    resolveExport(createEditorTestExportResult());
    await exportRequest;

    expect(store.getState().editor.exportState).toMatchObject({
      isViewOpen: false,
      status: "ready",
    });
  });

  it("reopens and cancels a background export after confirmation", async () => {
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
    editorApi.cancelExport.mockImplementation(async () => {
      rejectExport(new DOMException("Editor export cancelled", "AbortError"));
      return { cancelled: true };
    });
    editorApi.onExportProgress.mockReturnValue(vi.fn());
    loadEditorProject(store, project, [asset]);

    const exportRequest = store.getState().editor.exportProject({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });
    await vi.waitFor(() => {
      expect(editorApi.exportProject).toHaveBeenCalledTimes(1);
    });
    const requestId = store.getState().editor.exportState.requestId;
    store.getState().editor.keepEditingAfterExport();
    store.getState().editor.viewExport();
    expect(store.getState().editor.exportState.isViewOpen).toBe(true);

    store.getState().editor.openExportCancellationConfirmation();
    expect(store.getState().editor.exportState.isCancelConfirmationOpen).toBe(
      true,
    );
    store.getState().editor.closeExportCancellationConfirmation();
    expect(store.getState().editor.exportState.isCancelConfirmationOpen).toBe(
      false,
    );
    store.getState().editor.openExportCancellationConfirmation();

    const cancelRequest = store.getState().editor.cancelExport();
    expect(store.getState().editor.exportState).toMatchObject({
      isCancelConfirmationOpen: false,
      isCancellationPending: true,
      status: "exporting",
    });
    await cancelRequest;
    await exportRequest;

    expect(editorApi.cancelExport).toHaveBeenCalledWith({
      exportRequestId: requestId,
    });
    expect(store.getState().editor.exportState).toMatchObject({
      isCancellationPending: false,
      isViewOpen: false,
      status: "idle",
    });
  });

  it("cancels before rendering when project persistence is still pending", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const saveRequest = createDeferred<typeof project>();
    editorApi.saveProject.mockReturnValue(saveRequest.promise);
    loadEditorProject(store, project, [asset]);

    const exportRequest = store.getState().editor.exportProject({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });
    expect(store.getState().editor.exportState.status).toBe("exporting");

    await store.getState().editor.cancelExport();
    expect(store.getState().editor.exportState.status).toBe("idle");
    expect(editorApi.cancelExport).not.toHaveBeenCalled();
    expect(editorApi.exportProject).not.toHaveBeenCalled();

    saveRequest.resolve(project);
    await exportRequest;
    expect(editorApi.exportProject).not.toHaveBeenCalled();
  });

  it("keeps rendering when cancellation arrives after the commit phase", async () => {
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
    editorApi.cancelExport.mockResolvedValue({ cancelled: false });
    editorApi.onExportProgress.mockReturnValue(vi.fn());
    loadEditorProject(store, project, [asset]);

    const exportRequest = store.getState().editor.exportProject({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });
    await vi.waitFor(() => {
      expect(editorApi.exportProject).toHaveBeenCalledTimes(1);
    });
    store.getState().editor.openExportCancellationConfirmation();
    await store.getState().editor.cancelExport();

    expect(store.getState().editor.exportState).toMatchObject({
      isCancellationPending: false,
      status: "exporting",
    });
    resolveExport(createEditorTestExportResult());
    await exportRequest;
    expect(store.getState().editor.exportState.status).toBe("ready");
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
