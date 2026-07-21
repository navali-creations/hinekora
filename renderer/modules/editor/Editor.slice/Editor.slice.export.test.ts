import { describe, expect, it, vi } from "vitest";

import type {
  EditorExportInput,
  EditorExportLifecycle,
  EditorExportResult,
} from "~/main/modules/editor";

import {
  createDeferred,
  createEditorTestAsset,
  createEditorTestExportLifecycle,
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
    const previewClip = {
      durationSeconds: 10,
      id: "timeline-preview",
      inSeconds: 0,
      mediaUrl: "hinekora-media://replay-clip/asset-1",
      name: "preview.mp4",
      outSeconds: 10,
      playbackRate: 1 as const,
      startSeconds: 0,
    };
    editorApi.getExportLifecycle.mockResolvedValue(
      createEditorTestExportLifecycle({
        canCancel: true,
        error: null,
        exportRequestId: "export-request-refresh",
        fileName: "refresh.mp4",
        progress: 0.35,
        previewClips: [previewClip],
        projectId: "project-refresh",
        result: null,
        startedAt: "2026-07-20T10:00:00.000Z",
        status: "exporting",
      }),
    );

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

    void store.getState().editor.keepEditingAfterExport();
    const { previewClips: _previewClips, ...lifecycleUpdate } =
      createEditorTestExportLifecycle({
        canCancel: true,
        error: null,
        exportRequestId: "export-request-refresh",
        fileName: "refresh.mp4",
        progress: 0.6,
        projectId: "project-refresh",
        result: null,
        startedAt: "2026-07-20T10:00:00.000Z",
        status: "exporting",
      });
    progressTracker.getExportLifecycleCallback()?.(lifecycleUpdate);
    expect(store.getState().editor.exportState).toMatchObject({
      dismissedNoticeIds: ["keep-editing-safely"],
      isViewOpen: false,
      progress: 0.6,
      previewClips: [previewClip],
      status: "exporting",
    });
    expect(editorApi.dismissExport).not.toHaveBeenCalled();

    progressTracker.getExportLifecycleCallback()?.(
      createEditorTestExportLifecycle({
        error: null,
        exportRequestId: "export-request-refresh",
        fileName: result.fileName,
        progress: 1,
        projectId: "project-refresh",
        result,
        startedAt: "2026-07-20T10:00:00.000Z",
        status: "ready",
      }),
    );
    expect(store.getState().editor.exportState).toMatchObject({
      isViewOpen: false,
      progress: 1,
      result,
      status: "ready",
    });

    store.getState().editor.viewExport();
    await store.getState().editor.keepEditingAfterExport();
    expect(store.getState().editor.exportState.status).toBe("idle");
    expect(editorApi.dismissExport).toHaveBeenCalledTimes(1);

    progressTracker.getExportLifecycleCallback()?.(
      createEditorTestExportLifecycle({
        error: "render failed",
        exportRequestId: "export-request-failed",
        fileName: "failed.mp4",
        progress: 0,
        projectId: "project-failed",
        result: null,
        startedAt: "2026-07-20T10:00:00.000Z",
        status: "failed",
      }),
    );
    expect(store.getState().editor.exportState).toMatchObject({
      error: "render failed",
      dismissedNoticeIds: [],
      isViewOpen: true,
      status: "failed",
    });
    progressTracker.getExportLifecycleCallback()?.(
      createEditorTestExportLifecycle(),
    );
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
            requestId: "export-request-failed",
            status: "failed",
          },
        },
      }));
      editorApi.dismissExport.mockRejectedValueOnce(new Error("offline"));
      await store.getState().editor.keepEditingAfterExport();
      expect(consoleWarn).toHaveBeenCalledWith(
        "[editor] Export state dismissal failed",
        { error: expect.any(Error) },
      );
      expect(store.getState().editor.exportState).toMatchObject({
        error: "Could not dismiss export status: offline",
        status: "failed",
      });
    } finally {
      consoleWarn.mockRestore();
    }
  });

  it("retries lifecycle hydration while export listeners are active", async () => {
    vi.useFakeTimers();
    const store = createTestStore();
    const editorApi = getEditorApi();
    const lifecycle = createEditorTestExportLifecycle({
      canCancel: true,
      exportRequestId: "export-request-recovered",
      progress: 0.4,
      status: "exporting",
    });
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    editorApi.getExportLifecycle
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(lifecycle);
    const stopListening = store.getState().editor.startExportStateListening();

    try {
      await store.getState().editor.hydrateExportState();
      expect(store.getState().editor.exportState.status).toBe("idle");

      await vi.advanceTimersByTimeAsync(250);

      expect(editorApi.getExportLifecycle).toHaveBeenCalledTimes(2);
      expect(store.getState().editor.exportState).toMatchObject({
        progress: 0.4,
        requestId: "export-request-recovered",
        status: "exporting",
      });
    } finally {
      stopListening();
      consoleWarn.mockRestore();
      vi.useRealTimers();
    }
  });

  it("recovers an unknown background export from its progress event", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const progressTracker = getProgressTracker();
    editorApi.getExportLifecycle.mockResolvedValue(
      createEditorTestExportLifecycle({
        canCancel: true,
        exportRequestId: "export-request-background",
        progress: 0.55,
        status: "exporting",
      }),
    );
    const stopListening = store.getState().editor.startExportStateListening();

    try {
      progressTracker.getExportProgressCallback()?.({
        exportRequestId: "export-request-background",
        progress: 0.5,
      });

      await vi.waitFor(() => {
        expect(store.getState().editor.exportState).toMatchObject({
          progress: 0.55,
          requestId: "export-request-background",
          status: "exporting",
        });
      });
    } finally {
      stopListening();
    }
  });

  it("does not overwrite a lifecycle event with an older hydration result", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const progressTracker = getProgressTracker();
    const hydration = createDeferred<EditorExportLifecycle>();
    const result = createEditorTestExportResult();
    editorApi.getExportLifecycle.mockReturnValueOnce(hydration.promise);
    const stopListening = store.getState().editor.startExportStateListening();

    const hydrationRequest = store.getState().editor.hydrateExportState();
    progressTracker.getExportLifecycleCallback()?.(
      createEditorTestExportLifecycle({
        exportRequestId: "export-request-refresh",
        fileName: result.fileName,
        progress: 1,
        projectId: "project-refresh",
        result,
        startedAt: "2026-07-20T10:00:00.000Z",
        status: "ready",
      }),
    );
    hydration.resolve(
      createEditorTestExportLifecycle({
        canCancel: true,
        exportRequestId: "export-request-refresh",
        fileName: result.fileName,
        progress: 0.5,
        projectId: "project-refresh",
        startedAt: "2026-07-20T10:00:00.000Z",
        status: "exporting",
      }),
    );
    await hydrationRequest;

    expect(store.getState().editor.exportState).toMatchObject({
      progress: 1,
      result,
      status: "ready",
    });
    stopListening();
  });

  it("starts fresh hydration after a listener remount", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const firstHydration = createDeferred<EditorExportLifecycle>();
    editorApi.getExportLifecycle
      .mockReturnValueOnce(firstHydration.promise)
      .mockResolvedValueOnce(
        createEditorTestExportLifecycle({
          canCancel: true,
          exportRequestId: "export-request-remount",
          progress: 0.3,
          status: "exporting",
        }),
      );

    const stopFirstListener = store
      .getState()
      .editor.startExportStateListening();
    const staleHydration = store.getState().editor.hydrateExportState();
    stopFirstListener();
    const stopSecondListener = store
      .getState()
      .editor.startExportStateListening();

    try {
      await store.getState().editor.hydrateExportState();
      expect(editorApi.getExportLifecycle).toHaveBeenCalledTimes(2);
      expect(store.getState().editor.exportState).toMatchObject({
        progress: 0.3,
        requestId: "export-request-remount",
        status: "exporting",
      });

      firstHydration.resolve(createEditorTestExportLifecycle());
      await staleHydration;
      expect(store.getState().editor.exportState.status).toBe("exporting");
    } finally {
      stopSecondListener();
    }
  });

  it("does not report a stale hydration failure after a lifecycle event", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const progressTracker = getProgressTracker();
    const hydration = createDeferred<EditorExportLifecycle>();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    editorApi.getExportLifecycle.mockReturnValueOnce(hydration.promise);
    const stopListening = store.getState().editor.startExportStateListening();

    try {
      const hydrationRequest = store.getState().editor.hydrateExportState();
      progressTracker.getExportLifecycleCallback()?.(
        createEditorTestExportLifecycle({
          exportRequestId: "export-request-current",
          status: "failed",
        }),
      );
      hydration.reject(new Error("stale offline response"));
      await hydrationRequest;

      expect(consoleWarn).not.toHaveBeenCalled();
      expect(store.getState().editor.exportState.status).toBe("failed");
    } finally {
      stopListening();
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
    const stopListening = store.getState().editor.startExportStateListening();
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
    expect(exportInput?.project.tracks[0]?.clips[0]).toMatchObject({
      playbackRate: 1,
    });
    expect(exportInput?.project.id).toBe(project.id);
    expect(editorApi.saveProject).not.toHaveBeenCalled();

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
      requestId: exportInput?.exportRequestId,
      status: "ready",
    });
    stopListening();
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
      expect(unsubscribe).not.toHaveBeenCalled();
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
          project: expect.objectContaining({
            durationSeconds: project.durationSeconds,
            isAudioMuted: true,
            tracks: [
              expect.objectContaining({
                clips: [expect.objectContaining({ playbackRate: 1 })],
              }),
            ],
          }),
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
    expect(unsubscribe).not.toHaveBeenCalled();

    await store.getState().editor.exportProject({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });
    expect(store.getState().editor.exportState).toMatchObject({
      error: "render failed",
      status: "failed",
    });

    await store.getState().editor.keepEditingAfterExport();
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
    void store.getState().editor.keepEditingAfterExport();
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
    void store.getState().editor.keepEditingAfterExport();
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
    void store.getState().editor.keepEditingAfterExport();
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

  it("starts the main-owned export without a renderer persistence preflight", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const saveRequest = createDeferred<typeof project>();
    const mainExportRequest = createDeferred<EditorExportResult>();
    editorApi.saveProject.mockReturnValue(saveRequest.promise);
    editorApi.exportProject.mockReturnValue(mainExportRequest.promise);
    loadEditorProject(store, project, [asset]);

    const exportRequest = store.getState().editor.exportProject({
      fileName: "asset-1.mp4",
      mode: "new-file",
      resolution: "1080p",
    });
    expect(store.getState().editor.exportState.status).toBe("exporting");
    expect(editorApi.exportProject).toHaveBeenCalledTimes(1);
    expect(editorApi.saveProject).not.toHaveBeenCalled();

    mainExportRequest.resolve(createEditorTestExportResult());
    await exportRequest;
    expect(store.getState().editor.exportState.status).toBe("ready");
  });

  it("disables cancellation after main enters the commit phase", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const progressTracker = getProgressTracker();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    let resolveExport: (value: EditorExportResult) => void = () => undefined;
    editorApi.exportProject.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExport = resolve;
        }),
    );
    const stopListening = store.getState().editor.startExportStateListening();
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
    progressTracker.getExportLifecycleCallback()?.(
      createEditorTestExportLifecycle({
        canCancel: false,
        exportRequestId: requestId,
        fileName: "asset-1.mp4",
        progress: 0.98,
        projectId: project.id,
        startedAt: "2026-07-20T10:00:00.000Z",
        status: "exporting",
      }),
    );
    store.getState().editor.openExportCancellationConfirmation();
    await store.getState().editor.cancelExport();

    expect(store.getState().editor.exportState).toMatchObject({
      canCancel: false,
      isCancelConfirmationOpen: false,
      isCancellationPending: false,
      status: "exporting",
    });
    expect(editorApi.cancelExport).not.toHaveBeenCalled();
    resolveExport(createEditorTestExportResult());
    await exportRequest;
    expect(store.getState().editor.exportState.status).toBe("ready");
    stopListening();
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
