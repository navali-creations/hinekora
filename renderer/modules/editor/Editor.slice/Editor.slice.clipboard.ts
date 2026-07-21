import type { EditorExportFileActionResult } from "~/main/modules/editor";

import {
  clipboardStatusResetMs,
  initialClipboardState,
} from "./Editor.slice.constants";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorSlice } from "./Editor.slice.types";
import { createEditorCopyToClipboardInput } from "./Editor.slice.utils";

type EditorClipboardActions = Pick<
  EditorSlice["editor"],
  "copyExport" | "copyProjectToClipboard"
>;

function createEditorClipboardActions({
  get,
  set,
}: EditorSliceActionContext): EditorClipboardActions {
  return {
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

export { createEditorClipboardActions };
