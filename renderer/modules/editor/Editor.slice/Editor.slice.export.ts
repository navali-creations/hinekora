import type {
  EditorExportInput,
  EditorExportResolution,
} from "~/main/modules/editor";

import {
  initialExportState,
  minimumExportDurationMs,
} from "./Editor.slice.constants";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import {
  applyExportLifecycle,
  applyExportProgress,
  clearDismissedExportNoticeIds,
  persistDismissedExportNoticeIds,
} from "./Editor.slice.export.utils";
import type { EditorSlice } from "./Editor.slice.types";
import { createEditorExportInput, waitMs } from "./Editor.slice.utils";

const exportHydrationRetryDelaysMs = [250, 1_000, 3_000] as const;

type EditorExportActions = Pick<
  EditorSlice["editor"],
  | "cancelExport"
  | "closeExportCancellationConfirmation"
  | "dismissExportNotice"
  | "exportProject"
  | "hydrateExportState"
  | "keepEditingAfterExport"
  | "openExportCancellationConfirmation"
  | "revealExport"
  | "startExportStateListening"
  | "viewExport"
>;

function createEditorExportActions({
  get,
  set,
}: EditorSliceActionContext): EditorExportActions {
  let exportLifecycleRevision = 0;
  let exportHydrationPromise: Promise<void> | null = null;
  let exportHydrationRetryAttempt = 0;
  let exportHydrationRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let isExportStateListening = false;

  const clearExportHydrationRetry = () => {
    if (exportHydrationRetryTimer) {
      clearTimeout(exportHydrationRetryTimer);
      exportHydrationRetryTimer = null;
    }
  };

  const hydrateExportState = (): Promise<void> => {
    if (exportHydrationPromise) {
      return exportHydrationPromise;
    }

    clearExportHydrationRetry();
    const lifecycleRevision = ++exportLifecycleRevision;
    const hydrationRequest = (async () => {
      try {
        const lifecycle = await window.electron.editor.getExportLifecycle();
        if (lifecycleRevision !== exportLifecycleRevision) {
          return;
        }
        exportHydrationRetryAttempt = 0;
        applyExportLifecycle(set, lifecycle);
      } catch (error) {
        if (lifecycleRevision !== exportLifecycleRevision) {
          return;
        }
        console.warn("[editor] Export state hydration failed", { error });
        const retryDelay =
          exportHydrationRetryDelaysMs[exportHydrationRetryAttempt];
        if (isExportStateListening && retryDelay !== undefined) {
          exportHydrationRetryAttempt += 1;
          exportHydrationRetryTimer = setTimeout(() => {
            exportHydrationRetryTimer = null;
            void hydrateExportState();
          }, retryDelay);
        }
      }
    })();
    exportHydrationPromise = hydrationRequest;
    void hydrationRequest.then(() => {
      if (exportHydrationPromise === hydrationRequest) {
        exportHydrationPromise = null;
      }
    });

    return hydrationRequest;
  };

  return {
    cancelExport: async () => {
      const exportState = get().editor.exportState;
      const requestId = exportState.requestId;
      if (
        !requestId ||
        exportState.status !== "exporting" ||
        !exportState.canCancel
      ) {
        set((state) => {
          state.editor.exportState.isCancelConfirmationOpen = false;
        });
        return;
      }

      set((state) => {
        if (state.editor.exportState.requestId !== requestId) {
          return;
        }
        state.editor.exportState.isCancelConfirmationOpen = false;
        state.editor.exportState.isCancellationPending = true;
      });

      try {
        const result = await window.electron.editor.cancelExport({
          exportRequestId: requestId,
        });
        if (result.cancelled) {
          clearDismissedExportNoticeIds(requestId);
        }
        set((state) => {
          if (state.editor.exportState.requestId !== requestId) {
            return;
          }
          if (result.cancelled) {
            state.editor.exportState = initialExportState;
            return;
          }
          state.editor.exportState.isCancellationPending = false;
        });
      } catch (error) {
        set((state) => {
          if (state.editor.exportState.requestId !== requestId) {
            return;
          }
          state.editor.exportState.error =
            error instanceof Error ? error.message : "Cancellation failed";
          state.editor.exportState.isCancellationPending = false;
        });
      }
    },
    closeExportCancellationConfirmation: () => {
      set((state) => {
        state.editor.exportState.isCancelConfirmationOpen = false;
      });
    },
    dismissExportNotice: (noticeId) => {
      const currentExport = get().editor.exportState;
      if (
        currentExport.requestId === null ||
        currentExport.dismissedNoticeIds.includes(noticeId)
      ) {
        return;
      }
      const dismissedNoticeIds = [
        ...currentExport.dismissedNoticeIds,
        noticeId,
      ];
      set((state) => {
        if (state.editor.exportState.requestId === currentExport.requestId) {
          state.editor.exportState.dismissedNoticeIds = dismissedNoticeIds;
        }
      });
      persistDismissedExportNoticeIds(
        currentExport.requestId,
        dismissedNoticeIds,
      );
    },
    exportProject: async (input: {
      fileName: string;
      mode: EditorExportInput["mode"];
      resolution: EditorExportResolution;
    }) => {
      if (
        get().editor.exportState.status === "exporting" ||
        get().editor.clipboardState.status === "copying"
      ) {
        return;
      }
      const project = get().editor.project;
      const requestId = globalThis.crypto.randomUUID();
      const exportInput = createEditorExportInput(project, {
        ...input,
        exportRequestId: requestId,
      });
      if (!exportInput || !project) {
        set((state) => {
          state.editor.exportState = {
            canCancel: false,
            dismissedNoticeIds: [],
            error: "No editable clip is selected",
            fileName: input.fileName,
            isCancelConfirmationOpen: false,
            isCancellationPending: false,
            isViewOpen: true,
            previewClips: [],
            progress: 0,
            projectId: project?.id ?? null,
            requestId: null,
            result: null,
            startedAt: null,
            status: "failed",
          };
        });
        return;
      }

      set((state) => {
        state.editor.exportState = {
          canCancel: true,
          dismissedNoticeIds: [],
          error: null,
          fileName: exportInput.fileName,
          isCancelConfirmationOpen: false,
          isCancellationPending: false,
          isViewOpen: true,
          previewClips: [],
          progress: 0.02,
          projectId: project.id,
          requestId,
          result: null,
          startedAt: new Date().toISOString(),
          status: "exporting",
        };
        state.editor.isPreviewPlaying = false;
      });

      try {
        const exportStartedAt = performance.now();
        const result = await window.electron.editor.exportProject(exportInput);
        const remainingExportMs =
          minimumExportDurationMs - (performance.now() - exportStartedAt);
        if (remainingExportMs > 0) {
          await waitMs(remainingExportMs);
        }
        set((state) => {
          if (state.editor.exportState.requestId !== requestId) {
            return;
          }

          state.editor.exportState = {
            canCancel: false,
            dismissedNoticeIds: state.editor.exportState.dismissedNoticeIds,
            error: null,
            fileName: result.fileName,
            isCancelConfirmationOpen: false,
            isCancellationPending: false,
            isViewOpen: state.editor.exportState.isViewOpen,
            previewClips: state.editor.exportState.previewClips,
            progress: 1,
            projectId: project.id,
            requestId,
            result,
            startedAt: state.editor.exportState.startedAt,
            status: "ready",
          };
        });
      } catch (error) {
        set((state) => {
          if (state.editor.exportState.requestId !== requestId) {
            return;
          }
          if (state.editor.exportState.isCancellationPending) {
            return;
          }

          state.editor.exportState = {
            canCancel: false,
            dismissedNoticeIds: state.editor.exportState.dismissedNoticeIds,
            error: error instanceof Error ? error.message : "Save failed",
            fileName: exportInput.fileName,
            isCancelConfirmationOpen: false,
            isCancellationPending: false,
            isViewOpen: state.editor.exportState.isViewOpen,
            previewClips: state.editor.exportState.previewClips,
            progress: 0,
            projectId: project.id,
            requestId,
            result: null,
            startedAt: state.editor.exportState.startedAt,
            status: "failed",
          };
        });
      }
    },
    hydrateExportState,
    keepEditingAfterExport: async () => {
      const exportState = get().editor.exportState;
      if (exportState.status === "exporting") {
        set((state) => {
          if (state.editor.exportState.requestId !== exportState.requestId) {
            return;
          }
          state.editor.exportState.isCancelConfirmationOpen = false;
          state.editor.exportState.isViewOpen = false;
        });
        return;
      }

      if (exportState.status === "idle" || !exportState.requestId) {
        return;
      }

      try {
        await window.electron.editor.dismissExport();
        set((state) => {
          if (
            state.editor.exportState.requestId === exportState.requestId &&
            state.editor.exportState.status !== "exporting"
          ) {
            state.editor.exportState = initialExportState;
          }
        });
        clearDismissedExportNoticeIds(exportState.requestId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Dismissal failed";
        set((state) => {
          if (state.editor.exportState.requestId === exportState.requestId) {
            state.editor.exportState.error = `Could not dismiss export status: ${message}`;
          }
        });
        console.warn("[editor] Export state dismissal failed", { error });
      }
    },
    openExportCancellationConfirmation: () => {
      set((state) => {
        if (
          state.editor.exportState.status === "exporting" &&
          state.editor.exportState.canCancel &&
          !state.editor.exportState.isCancellationPending
        ) {
          state.editor.exportState.isCancelConfirmationOpen = true;
        }
      });
    },
    revealExport: async (exportId) => {
      const result = await window.electron.editor.revealExport(exportId);
      if (result.ok) {
        return;
      }

      set((state) => {
        state.editor.exportState.error =
          result.error ?? "Saved video is not available";
      });
    },
    startExportStateListening: () => {
      isExportStateListening = true;
      const unsubscribeLifecycle =
        window.electron.editor.onExportLifecycleChanged((lifecycle) => {
          exportLifecycleRevision += 1;
          exportHydrationRetryAttempt = 0;
          clearExportHydrationRetry();
          applyExportLifecycle(set, lifecycle);
        });
      const unsubscribeProgress = window.electron.editor.onExportProgress(
        (progress) => {
          const exportState = get().editor.exportState;
          if (
            exportState.status === "idle" &&
            exportState.requestId !== progress.exportRequestId
          ) {
            void hydrateExportState();
            return;
          }
          applyExportProgress(set, progress);
        },
      );

      return () => {
        isExportStateListening = false;
        exportLifecycleRevision += 1;
        exportHydrationPromise = null;
        exportHydrationRetryAttempt = 0;
        clearExportHydrationRetry();
        unsubscribeLifecycle();
        unsubscribeProgress();
      };
    },
    viewExport: () => {
      set((state) => {
        if (state.editor.exportState.status !== "idle") {
          state.editor.exportState.isViewOpen = true;
        }
      });
    },
  };
}

export { createEditorExportActions };
