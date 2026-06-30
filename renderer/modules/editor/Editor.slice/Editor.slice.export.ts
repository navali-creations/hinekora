import type {
  EditorExportFileActionResult,
  EditorExportInput,
  EditorExportResolution,
} from "~/main/modules/editor";
import { trackEvent } from "~/renderer/modules/umami";

import {
  clipboardStatusResetMs,
  initialClipboardState,
  initialExportState,
  minimumExportDurationMs,
} from "./Editor.slice.constants";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorSlice } from "./Editor.slice.types";
import {
  createEditorCopyToClipboardInput,
  createEditorExportInput,
  waitMs,
} from "./Editor.slice.utils";

type EditorExportActions = Pick<
  EditorSlice["editor"],
  | "copyExport"
  | "copyProjectToClipboard"
  | "exportProject"
  | "keepEditingAfterExport"
  | "revealExport"
>;

function createEditorExportActions({
  get,
  set,
}: EditorSliceActionContext): EditorExportActions {
  return {
    copyExport: async (exportId) => {
      const result = await window.electron.editor.copyExport(exportId);
      if (result.ok) {
        trackEvent("editor-export-copied");
        return result;
      }

      set((state) => {
        state.editor.exportState.error =
          result.error ?? "Could not copy saved video to clipboard";
      });

      return result;
    },
    copyProjectToClipboard: async () => {
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
        trackEvent("editor-project-copied", {
          ok: result.ok,
        });

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
    exportProject: async (input: {
      fileName: string;
      mode: EditorExportInput["mode"];
      resolution: EditorExportResolution;
    }) => {
      const project = get().editor.project;
      const requestId = globalThis.crypto.randomUUID();
      const exportInput = createEditorExportInput(project, {
        ...input,
        exportRequestId: requestId,
      });
      if (!exportInput) {
        set((state) => {
          state.editor.exportState = {
            error: "No editable clip is selected",
            fileName: input.fileName,
            progress: 0,
            requestId: null,
            result: null,
            status: "failed",
          };
        });
        trackEvent("editor-export-failed", {
          reason: "empty-project",
        });
        return;
      }

      trackEvent("editor-export-started", {
        mode: input.mode,
        resolution: input.resolution,
      });
      set((state) => {
        state.editor.exportState = {
          error: null,
          fileName: exportInput.fileName,
          progress: 0.02,
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
            error: null,
            fileName: result.fileName,
            progress: 1,
            requestId: null,
            result,
            status: "ready",
          };
        });
        trackEvent("editor-export-ready", {
          mode: input.mode,
          resolution: input.resolution,
        });
      } catch (error) {
        set((state) => {
          if (state.editor.exportState.requestId !== requestId) {
            return;
          }

          state.editor.exportState = {
            error: error instanceof Error ? error.message : "Save failed",
            fileName: exportInput.fileName,
            progress: 0,
            requestId: null,
            result: null,
            status: "failed",
          };
        });
      } finally {
        unsubscribeProgress();
      }
    },
    keepEditingAfterExport: () => {
      set((state) => {
        state.editor.exportState = initialExportState;
      });
      trackEvent("editor-export-keep-editing");
    },
    revealExport: async (exportId) => {
      const result = await window.electron.editor.revealExport(exportId);
      if (result.ok) {
        trackEvent("editor-export-revealed");
        return;
      }

      set((state) => {
        state.editor.exportState.error =
          result.error ?? "Saved video is not available";
      });
    },
  };
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
