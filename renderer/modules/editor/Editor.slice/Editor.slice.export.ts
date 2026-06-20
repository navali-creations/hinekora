import type {
  EditorExportInput,
  EditorExportResolution,
} from "~/main/modules/editor";

import {
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
        return result;
      }

      set((state) => {
        state.editor.exportState.error =
          result.error ?? "Could not copy export to clipboard";
      });

      return result;
    },
    copyProjectToClipboard: async () => {
      const input = createEditorCopyToClipboardInput(get().editor.project);
      if (!input) {
        return { ok: false, error: "No editable clip is selected" };
      }

      return window.electron.editor.copyProjectToClipboard(input);
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
        return;
      }

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
      } catch (error) {
        set((state) => {
          if (state.editor.exportState.requestId !== requestId) {
            return;
          }

          state.editor.exportState = {
            error: error instanceof Error ? error.message : "Export failed",
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
    },
    revealExport: async (exportId) => {
      const result = await window.electron.editor.revealExport(exportId);
      if (result.ok) {
        return;
      }

      set((state) => {
        state.editor.exportState.error =
          result.error ?? "Exported file is not available";
      });
    },
  };
}

export { createEditorExportActions };
