import type {
  EditorProject,
  EditorProjectSummary,
} from "~/main/modules/editor";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

import { editorHistoryLimit } from "./Editor.slice.constants";
import { createEditorExportActions } from "./Editor.slice.export";
import { createEditorHistoryActions } from "./Editor.slice.history";
import { createEditorInitialState } from "./Editor.slice.state";
import { createEditorTimelineActions } from "./Editor.slice.timeline";
import type { EditorSlice, SetProjectOptions } from "./Editor.slice.types";
import { normalizeEditorProjectTimeline } from "./Editor.slice.utils";
import { createEditorWorkspaceActions } from "./Editor.slice.workspace";

const createEditorSlice: BoundStoreStateCreator<EditorSlice> = (set, get) => {
  const setProject = (
    project: EditorProject,
    options: SetProjectOptions = {},
  ) => {
    set((state) => {
      const shouldRecordHistory = Boolean(
        options.recordHistory &&
          !state.editor.historyTransactionProject &&
          state.editor.project &&
          state.editor.project !== project,
      );

      if (options.resetHistory || shouldRecordHistory) {
        state.editor.historyFuture = [];
        state.editor.historyFutureLabels = [];
      }

      if (options.resetHistory) {
        state.editor.historyPast = [];
        state.editor.historyPastLabels = [];
      } else if (shouldRecordHistory && state.editor.project) {
        state.editor.historyPast = [
          ...state.editor.historyPast,
          state.editor.project,
        ].slice(-editorHistoryLimit);
        state.editor.historyPastLabels = [
          ...state.editor.historyPastLabels,
          options.historyLabel ?? "Edit",
        ].slice(-editorHistoryLimit);
      }

      if (options.resetHistory) {
        state.editor.historyTransactionLabel = null;
        state.editor.historyTransactionProject = null;
      }

      state.editor.hoveredTimelineGap = null;
      state.editor.isLoading = false;
      state.editor.isPreviewPlaying = false;
      state.editor.playbackSeconds = options.resetViewState
        ? 0
        : Math.min(state.editor.playbackSeconds, project.durationSeconds);
      state.editor.project = project;
      state.editor.selectedAssetKey = project.selectedAssetKey;
      state.editor.selectedClipId = project.activeClipId;
      if (state.editor.workspace) {
        state.editor.workspace.project = project;
        if (options.syncProjectList !== false) {
          state.editor.workspace.projects = upsertEditorProjectSummary(
            state.editor.workspace.projects,
            project,
          );
        }
      }
    });
  };

  const updateProject = (
    updater: (project: EditorProject) => EditorProject,
    options: { historyLabel?: string; recordHistory?: boolean } = {},
  ) => {
    const project = get().editor.project;
    if (!project) {
      return;
    }

    const updatedProject = updater(project);
    if (updatedProject === project) {
      return;
    }

    const nextProject = normalizeEditorProjectTimeline(updatedProject);
    setProject(nextProject, {
      ...(options.historyLabel ? { historyLabel: options.historyLabel } : {}),
      recordHistory: options.recordHistory ?? true,
    });
    scheduleEditorProjectSave(nextProject, get().editor.saveProject);
  };

  const context = {
    get,
    set,
    setProject,
    updateProject,
  };

  return {
    editor: {
      ...createEditorInitialState(),
      ...createEditorHistoryActions(context),
      ...createEditorWorkspaceActions(context),
      ...createEditorExportActions(context),
      ...createEditorTimelineActions(context),
    },
  };
};

export type { EditorSlice };
export { createEditorSlice };

function upsertEditorProjectSummary(
  summaries: EditorProjectSummary[],
  project: EditorProject,
): EditorProjectSummary[] {
  const summary = createEditorProjectSummary(project);
  const nextSummaries = summaries.filter((item) => item.id !== summary.id);

  return [summary, ...nextSummaries].sort(
    (first, second) =>
      Date.parse(second.updatedAt) - Date.parse(first.updatedAt) ||
      first.title.localeCompare(second.title),
  );
}

function createEditorProjectSummary(
  project: EditorProject,
): EditorProjectSummary {
  return {
    clipCount: project.tracks.reduce(
      (clipCount, track) => clipCount + track.clips.length,
      0,
    ),
    createdAt: project.createdAt,
    durationSeconds: project.durationSeconds,
    id: project.id,
    title: project.title,
    updatedAt: project.updatedAt,
  };
}

let editorProjectSaveTimer: number | null = null;

function scheduleEditorProjectSave(
  project: EditorProject,
  saveProject: (project: EditorProject) => Promise<EditorProject>,
) {
  if (editorProjectSaveTimer !== null) {
    window.clearTimeout(editorProjectSaveTimer);
  }

  editorProjectSaveTimer = window.setTimeout(() => {
    editorProjectSaveTimer = null;
    void saveProject(project).catch((error) => {
      console.warn("[editor] Project autosave failed", { error });
    });
  }, 500);
}
