import { editorHistoryLimit } from "./Editor.slice.constants";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorSlice } from "./Editor.slice.types";

type EditorHistoryActions = Pick<
  EditorSlice["editor"],
  | "beginHistoryTransaction"
  | "commitHistoryTransaction"
  | "redoProjectChange"
  | "undoProjectChange"
>;

function createEditorHistoryActions({
  get,
  set,
  setProject,
}: EditorSliceActionContext): EditorHistoryActions {
  return {
    beginHistoryTransaction: (label = "Edit") => {
      const project = get().editor.project;
      if (!project || get().editor.historyTransactionProject) {
        return;
      }

      set((state) => {
        state.editor.historyTransactionLabel = label;
        state.editor.historyTransactionProject = project;
      });
    },
    commitHistoryTransaction: () => {
      set((state) => {
        const transactionProject = state.editor.historyTransactionProject;
        const project = state.editor.project;
        if (!transactionProject || !project || transactionProject === project) {
          state.editor.historyTransactionLabel = null;
          state.editor.historyTransactionProject = null;
          return;
        }

        state.editor.historyFuture = [];
        state.editor.historyFutureLabels = [];
        state.editor.historyPast = [
          ...state.editor.historyPast,
          transactionProject,
        ].slice(-editorHistoryLimit);
        state.editor.historyPastLabels = [
          ...state.editor.historyPastLabels,
          state.editor.historyTransactionLabel ?? "Edit",
        ].slice(-editorHistoryLimit);
        state.editor.historyTransactionLabel = null;
        state.editor.historyTransactionProject = null;
      });
    },
    redoProjectChange: () => {
      const project = get().editor.project;
      const nextProject = get().editor.historyFuture[0];
      const nextLabel = get().editor.historyFutureLabels[0] ?? "Edit";
      if (!project || !nextProject) {
        return;
      }

      set((state) => {
        state.editor.historyFuture = state.editor.historyFuture.slice(1);
        state.editor.historyFutureLabels =
          state.editor.historyFutureLabels.slice(1);
        state.editor.historyPast = [...state.editor.historyPast, project].slice(
          -editorHistoryLimit,
        );
        state.editor.historyPastLabels = [
          ...state.editor.historyPastLabels,
          nextLabel,
        ].slice(-editorHistoryLimit);
        state.editor.historyTransactionLabel = null;
        state.editor.historyTransactionProject = null;
      });
      setProject(nextProject, { recordHistory: false });
      void get()
        .editor.saveProject(nextProject)
        .catch((error) => {
          console.warn("[editor] Project redo save failed", { error });
        });
    },
    undoProjectChange: () => {
      const project = get().editor.project;
      const previousProject = get().editor.historyPast.at(-1);
      const previousLabel = get().editor.historyPastLabels.at(-1) ?? "Edit";
      if (!project || !previousProject) {
        return;
      }

      set((state) => {
        state.editor.historyFuture = [
          project,
          ...state.editor.historyFuture,
        ].slice(0, editorHistoryLimit);
        state.editor.historyFutureLabels = [
          previousLabel,
          ...state.editor.historyFutureLabels,
        ].slice(0, editorHistoryLimit);
        state.editor.historyPast = state.editor.historyPast.slice(0, -1);
        state.editor.historyPastLabels = state.editor.historyPastLabels.slice(
          0,
          -1,
        );
        state.editor.historyTransactionLabel = null;
        state.editor.historyTransactionProject = null;
      });
      setProject(previousProject, { recordHistory: false });
      void get()
        .editor.saveProject(previousProject)
        .catch((error) => {
          console.warn("[editor] Project undo save failed", { error });
        });
    },
  };
}

export { createEditorHistoryActions };
