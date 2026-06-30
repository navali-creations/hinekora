import { trackEvent } from "~/renderer/modules/umami";

import { editorHistoryLimit } from "./Editor.slice.constants";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorSlice } from "./Editor.slice.types";
import { createEditorProjectHistorySnapshot } from "./Editor.slice.utils";

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
    beginHistoryTransaction: (label = "Edit", subtitle = null) => {
      const project = get().editor.project;
      if (!project || get().editor.historyTransactionProject) {
        return;
      }

      set((state) => {
        state.editor.historyTransactionLabel = label;
        state.editor.historyTransactionSubtitle = subtitle;
        state.editor.historyTransactionProject = project;
      });
    },
    commitHistoryTransaction: () => {
      const transactionProject = get().editor.historyTransactionProject;
      const project = get().editor.project;
      const transactionLabel = get().editor.historyTransactionLabel ?? "Edit";
      const transactionSubtitle = get().editor.historyTransactionSubtitle;
      if (!transactionProject || !project || transactionProject === project) {
        set((state) => {
          state.editor.historyTransactionLabel = null;
          state.editor.historyTransactionSubtitle = null;
          state.editor.historyTransactionProject = null;
        });
        return;
      }

      set((state) => {
        state.editor.historyFuture = [];
        state.editor.historyFutureLabels = [];
        state.editor.historyFutureSubtitles = [];
        state.editor.historyPast = [
          ...state.editor.historyPast,
          createEditorProjectHistorySnapshot(transactionProject),
        ].slice(-editorHistoryLimit);
        state.editor.historyPastLabels = [
          ...state.editor.historyPastLabels,
          transactionLabel,
        ].slice(-editorHistoryLimit);
        state.editor.historyPastSubtitles = [
          ...state.editor.historyPastSubtitles,
          transactionSubtitle,
        ].slice(-editorHistoryLimit);
        state.editor.historyTransactionLabel = null;
        state.editor.historyTransactionSubtitle = null;
        state.editor.historyTransactionProject = null;
      });
      trackEvent("editor-history-transaction-committed", {
        label: transactionLabel,
      });
    },
    redoProjectChange: () => {
      const project = get().editor.project;
      const nextProject = get().editor.historyFuture[0];
      const nextLabel = get().editor.historyFutureLabels[0] ?? "Edit";
      const nextSubtitle = get().editor.historyFutureSubtitles[0] ?? null;
      if (!project || !nextProject) {
        return;
      }

      set((state) => {
        state.editor.historyFuture = state.editor.historyFuture.slice(1);
        state.editor.historyFutureLabels =
          state.editor.historyFutureLabels.slice(1);
        state.editor.historyFutureSubtitles =
          state.editor.historyFutureSubtitles.slice(1);
        state.editor.historyPast = [...state.editor.historyPast, project]
          .slice(-editorHistoryLimit)
          .map(createEditorProjectHistorySnapshot);
        state.editor.historyPastLabels = [
          ...state.editor.historyPastLabels,
          nextLabel,
        ].slice(-editorHistoryLimit);
        state.editor.historyPastSubtitles = [
          ...state.editor.historyPastSubtitles,
          nextSubtitle,
        ].slice(-editorHistoryLimit);
        state.editor.historyTransactionLabel = null;
        state.editor.historyTransactionSubtitle = null;
        state.editor.historyTransactionProject = null;
      });
      setProject(nextProject, { recordHistory: false });
      trackEvent("editor-redone", {
        label: nextLabel,
      });
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
      const previousSubtitle = get().editor.historyPastSubtitles.at(-1) ?? null;
      if (!project || !previousProject) {
        return;
      }

      set((state) => {
        state.editor.historyFuture = [
          createEditorProjectHistorySnapshot(project),
          ...state.editor.historyFuture,
        ].slice(0, editorHistoryLimit);
        state.editor.historyFutureLabels = [
          previousLabel,
          ...state.editor.historyFutureLabels,
        ].slice(0, editorHistoryLimit);
        state.editor.historyFutureSubtitles = [
          previousSubtitle,
          ...state.editor.historyFutureSubtitles,
        ].slice(0, editorHistoryLimit);
        state.editor.historyPast = state.editor.historyPast.slice(0, -1);
        state.editor.historyPastLabels = state.editor.historyPastLabels.slice(
          0,
          -1,
        );
        state.editor.historyPastSubtitles =
          state.editor.historyPastSubtitles.slice(0, -1);
        state.editor.historyTransactionLabel = null;
        state.editor.historyTransactionSubtitle = null;
        state.editor.historyTransactionProject = null;
      });
      setProject(previousProject, { recordHistory: false });
      trackEvent("editor-undone", {
        label: previousLabel,
      });
      void get()
        .editor.saveProject(previousProject)
        .catch((error) => {
          console.warn("[editor] Project undo save failed", { error });
        });
    },
  };
}

export { createEditorHistoryActions };
