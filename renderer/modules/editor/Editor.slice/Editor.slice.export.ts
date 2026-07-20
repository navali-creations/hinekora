import type {
  EditorExportFileActionResult,
  EditorExportInput,
  EditorExportLifecycle,
  EditorExportResolution,
} from "~/main/modules/editor";

import {
  clipboardStatusResetMs,
  initialClipboardState,
  initialExportState,
  minimumExportDurationMs,
} from "./Editor.slice.constants";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorExportNoticeId, EditorSlice } from "./Editor.slice.types";
import {
  createEditorCopyToClipboardInput,
  createEditorExportInput,
  waitMs,
} from "./Editor.slice.utils";

type EditorExportActions = Pick<
  EditorSlice["editor"],
  | "cancelExport"
  | "closeExportCancellationConfirmation"
  | "copyExport"
  | "copyProjectToClipboard"
  | "dismissExportNotice"
  | "exportProject"
  | "hydrateExportState"
  | "keepEditingAfterExport"
  | "openExportCancellationConfirmation"
  | "revealExport"
  | "startExportStateListening"
  | "viewExport"
>;

const editorExportNoticeIds: EditorExportNoticeId[] = [
  "cancel-without-leftovers",
  "keep-editing-safely",
  "keep-using-hinekora",
];
const editorExportNoticeStoragePrefix = "hinekora:editor-export-notices:";

function createEditorExportActions({
  get,
  set,
}: EditorSliceActionContext): EditorExportActions {
  let preparingExportRequestId: string | null = null;

  return {
    cancelExport: async () => {
      const requestId = get().editor.exportState.requestId;
      if (!requestId || get().editor.exportState.status !== "exporting") {
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

      if (preparingExportRequestId === requestId) {
        preparingExportRequestId = null;
        clearDismissedExportNoticeIds(requestId);
        set((state) => {
          if (state.editor.exportState.requestId === requestId) {
            state.editor.exportState = initialExportState;
          }
        });
        return;
      }

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
    copyExport: async (exportId) => {
      const result = await window.electron.editor.copyExport(exportId);
      if (result.ok) {
        return result;
      }

      set((state) => {
        state.editor.exportState.error =
          result.error ?? "Could not copy saved video to clipboard";
      });

      return result;
    },
    copyProjectToClipboard: async () => {
      if (get().editor.exportState.status === "exporting") {
        return {
          error: "Wait for the current save to finish",
          ok: false,
        };
      }
      if (get().editor.clipboardState.status === "copying") {
        return { error: "Clipboard copy is already running", ok: false };
      }

      const input = createEditorCopyToClipboardInput(get().editor.project);
      const requestId = globalThis.crypto.randomUUID();
      if (!input) {
        const result = {
          error: "No editable clip is selected",
          ok: false,
        };
        set((state) => {
          state.editor.clipboardState = {
            error: result.error,
            requestId,
            status: "failed",
          };
        });
        resetClipboardStateLater(set, requestId);

        return result;
      }

      set((state) => {
        state.editor.clipboardState = {
          error: null,
          requestId,
          status: "copying",
        };
        state.editor.isPreviewPlaying = false;
      });

      try {
        const result =
          await window.electron.editor.copyProjectToClipboard(input);
        setClipboardResult(set, requestId, result);
        resetClipboardStateLater(set, requestId);

        return result;
      } catch (error) {
        const result = {
          error:
            error instanceof Error ? error.message : "Clipboard copy failed",
          ok: false,
        };
        setClipboardResult(set, requestId, result);
        resetClipboardStateLater(set, requestId);

        return result;
      }
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
            dismissedNoticeIds: [],
            error: "No editable clip is selected",
            fileName: input.fileName,
            isCancelConfirmationOpen: false,
            isCancellationPending: false,
            isViewOpen: true,
            progress: 0,
            projectId: project?.id ?? null,
            requestId: null,
            result: null,
            status: "failed",
          };
        });
        return;
      }

      set((state) => {
        state.editor.exportState = {
          dismissedNoticeIds: [],
          error: null,
          fileName: exportInput.fileName,
          isCancelConfirmationOpen: false,
          isCancellationPending: false,
          isViewOpen: true,
          progress: 0.02,
          projectId: exportInput.projectId,
          requestId,
          result: null,
          status: "exporting",
        };
        state.editor.isPreviewPlaying = false;
      });

      const unsubscribeProgress = window.electron.editor.onExportProgress(
        ({ exportRequestId, progress }) => {
          set((state) => {
            if (
              state.editor.exportState.status !== "exporting" ||
              state.editor.exportState.requestId !== exportRequestId
            ) {
              return;
            }

            state.editor.exportState.progress = Math.max(
              state.editor.exportState.progress,
              Math.min(Math.max(progress, 0), 0.98),
            );
          });
        },
      );
      preparingExportRequestId = requestId;

      try {
        const exportStartedAt = performance.now();
        await get().editor.saveProject(project, { applyResponse: false });
        if (
          get().editor.exportState.status !== "exporting" ||
          get().editor.exportState.requestId !== requestId
        ) {
          return;
        }
        preparingExportRequestId = null;
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
            dismissedNoticeIds: state.editor.exportState.dismissedNoticeIds,
            error: null,
            fileName: result.fileName,
            isCancelConfirmationOpen: false,
            isCancellationPending: false,
            isViewOpen: state.editor.exportState.isViewOpen,
            progress: 1,
            projectId: exportInput.projectId,
            requestId: null,
            result,
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
            dismissedNoticeIds: state.editor.exportState.dismissedNoticeIds,
            error: error instanceof Error ? error.message : "Save failed",
            fileName: exportInput.fileName,
            isCancelConfirmationOpen: false,
            isCancellationPending: false,
            isViewOpen: state.editor.exportState.isViewOpen,
            progress: 0,
            projectId: exportInput.projectId,
            requestId: null,
            result: null,
            status: "failed",
          };
        });
      } finally {
        if (preparingExportRequestId === requestId) {
          preparingExportRequestId = null;
        }
        unsubscribeProgress();
      }
    },
    hydrateExportState: async () => {
      try {
        applyExportLifecycle(
          set,
          await window.electron.editor.getExportLifecycle(),
        );
      } catch (error) {
        console.warn("[editor] Export state hydration failed", { error });
      }
    },
    keepEditingAfterExport: () => {
      set((state) => {
        if (state.editor.exportState.status === "exporting") {
          state.editor.exportState.isCancelConfirmationOpen = false;
          state.editor.exportState.isViewOpen = false;
          return;
        }
        state.editor.exportState = initialExportState;
      });
      if (get().editor.exportState.status === "idle") {
        void window.electron.editor.dismissExport().catch((error) => {
          console.warn("[editor] Export state dismissal failed", { error });
        });
      }
    },
    openExportCancellationConfirmation: () => {
      set((state) => {
        if (
          state.editor.exportState.status === "exporting" &&
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
    startExportStateListening: () =>
      window.electron.editor.onExportLifecycleChanged((lifecycle) => {
        applyExportLifecycle(set, lifecycle);
      }),
    viewExport: () => {
      set((state) => {
        if (state.editor.exportState.status !== "idle") {
          state.editor.exportState.isViewOpen = true;
        }
      });
    },
  };
}

function applyExportLifecycle(
  set: EditorSliceActionContext["set"],
  lifecycle: EditorExportLifecycle,
): void {
  const persistedNoticeIds = lifecycle.exportRequestId
    ? readDismissedExportNoticeIds(lifecycle.exportRequestId)
    : [];
  let completedRequestId: string | null = null;
  set((state) => {
    const current = state.editor.exportState;
    const isCurrentRequest =
      lifecycle.exportRequestId !== null &&
      current.requestId === lifecycle.exportRequestId;

    if (lifecycle.status === "idle") {
      completedRequestId = current.requestId;
      state.editor.exportState = initialExportState;
      return;
    }

    const isViewOpen = isCurrentRequest ? current.isViewOpen : true;
    if (lifecycle.status === "exporting") {
      state.editor.exportState = {
        dismissedNoticeIds: isCurrentRequest
          ? current.dismissedNoticeIds
          : persistedNoticeIds,
        error: null,
        fileName: lifecycle.fileName,
        isCancelConfirmationOpen: isCurrentRequest
          ? current.isCancelConfirmationOpen
          : false,
        isCancellationPending: isCurrentRequest
          ? current.isCancellationPending
          : false,
        isViewOpen,
        progress: isCurrentRequest
          ? Math.max(current.progress, lifecycle.progress)
          : lifecycle.progress,
        projectId: lifecycle.projectId,
        requestId: lifecycle.exportRequestId,
        result: null,
        status: "exporting",
      };
      return;
    }

    state.editor.exportState = {
      dismissedNoticeIds: isCurrentRequest ? current.dismissedNoticeIds : [],
      error: lifecycle.error,
      fileName: lifecycle.fileName,
      isCancelConfirmationOpen: false,
      isCancellationPending: false,
      isViewOpen,
      progress: lifecycle.status === "ready" ? 1 : 0,
      projectId: lifecycle.projectId,
      requestId: null,
      result: lifecycle.result,
      status: lifecycle.status,
    };
    completedRequestId = lifecycle.exportRequestId;
  });
  if (completedRequestId) {
    clearDismissedExportNoticeIds(completedRequestId);
  }
}

function clearDismissedExportNoticeIds(exportRequestId: string): void {
  try {
    window.sessionStorage.removeItem(
      `${editorExportNoticeStoragePrefix}${exportRequestId}`,
    );
  } catch {
    // Dismissal remains active in memory when session storage is unavailable.
  }
}

function persistDismissedExportNoticeIds(
  exportRequestId: string,
  noticeIds: EditorExportNoticeId[],
): void {
  try {
    window.sessionStorage.setItem(
      `${editorExportNoticeStoragePrefix}${exportRequestId}`,
      JSON.stringify(noticeIds),
    );
  } catch {
    // Dismissal remains active in memory when session storage is unavailable.
  }
}

function readDismissedExportNoticeIds(
  exportRequestId: string,
): EditorExportNoticeId[] {
  try {
    const storedValue = window.sessionStorage.getItem(
      `${editorExportNoticeStoragePrefix}${exportRequestId}`,
    );
    if (!storedValue) {
      return [];
    }
    const parsedValue: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return editorExportNoticeIds.filter((noticeId) =>
      parsedValue.includes(noticeId),
    );
  } catch {
    return [];
  }
}

function resetClipboardStateLater(
  set: EditorSliceActionContext["set"],
  requestId: string,
): void {
  globalThis.setTimeout(() => {
    set((state) => {
      if (state.editor.clipboardState.requestId !== requestId) {
        return;
      }

      state.editor.clipboardState = initialClipboardState;
    });
  }, clipboardStatusResetMs);
}

function setClipboardResult(
  set: EditorSliceActionContext["set"],
  requestId: string,
  result: EditorExportFileActionResult,
): void {
  set((state) => {
    if (state.editor.clipboardState.requestId !== requestId) {
      return;
    }

    state.editor.clipboardState = {
      error: result.error,
      requestId,
      status: result.ok ? "copied" : "failed",
    };
  });
}

export { createEditorExportActions };
