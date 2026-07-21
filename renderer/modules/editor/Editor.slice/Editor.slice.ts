import type {
  EditorProject,
  EditorProjectSummary,
} from "~/main/modules/editor";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

import { createEditorClipboardActions } from "./Editor.slice.clipboard";
import { editorHistoryLimit } from "./Editor.slice.constants";
import { createEditorExportActions } from "./Editor.slice.export";
import { createEditorHistoryActions } from "./Editor.slice.history";
import { createEditorProjectActions } from "./Editor.slice.project";
import { createEditorInitialState } from "./Editor.slice.state";
import { createEditorTimelineActions } from "./Editor.slice.timeline";
import type {
  EditorSlice,
  SaveProjectOptions,
  SetProjectOptions,
} from "./Editor.slice.types";
import {
  createEditorProjectHistorySnapshot,
  getEditorProjectHistoryLabels,
  getEditorProjectHistorySnapshots,
  getEditorProjectHistorySubtitles,
  normalizeEditorProjectTimeline,
} from "./Editor.slice.utils";
import { createEditorWorkspaceActions } from "./Editor.slice.workspace";

const createEditorSlice: BoundStoreStateCreator<EditorSlice> = (set, get) => {
  const setProject = (
    project: EditorProject,
    options: SetProjectOptions = {},
  ) => {
    const {
      historyLabel = "Edit",
      historySubtitle = null,
      recordHistory,
      resetHistory,
      resetViewState,
    } = options;
    set((state) => {
      const shouldRecordHistory = Boolean(
        recordHistory &&
          !state.editor.historyTransactionProject &&
          state.editor.project &&
          state.editor.project !== project,
      );

      if (resetHistory || shouldRecordHistory) {
        state.editor.historyFuture = [];
        state.editor.historyFutureLabels = [];
        state.editor.historyFutureSubtitles = [];
      }

      if (resetHistory) {
        state.editor.historyPast = getEditorProjectHistorySnapshots(project);
        state.editor.historyPastLabels = getEditorProjectHistoryLabels(project);
        state.editor.historyPastSubtitles =
          getEditorProjectHistorySubtitles(project);
      } else if (shouldRecordHistory && state.editor.project) {
        state.editor.historyPast = [
          ...state.editor.historyPast,
          createEditorProjectHistorySnapshot(state.editor.project),
        ].slice(-editorHistoryLimit);
        state.editor.historyPastLabels = [
          ...state.editor.historyPastLabels,
          historyLabel,
        ].slice(-editorHistoryLimit);
        state.editor.historyPastSubtitles = [
          ...state.editor.historyPastSubtitles,
          historySubtitle,
        ].slice(-editorHistoryLimit);
      }

      if (resetHistory) {
        state.editor.historyTransactionLabel = null;
        state.editor.historyTransactionSubtitle = null;
        state.editor.historyTransactionProject = null;
      }

      state.editor.areTimelineGapsHighlighted = false;
      state.editor.hoveredTimelineGap = null;
      state.editor.isLoading = false;
      state.editor.isPreviewPlaying = false;
      if (resetViewState) {
        state.editor.isTimelineFitToEdit = false;
      }
      state.editor.playbackSeconds = resetViewState
        ? 0
        : Math.min(state.editor.playbackSeconds, project.durationSeconds);
      state.editor.project = project;
      state.editor.selectedAssetKey = project.selectedAssetKey;
      state.editor.selectedClipId = project.activeClipId;
      if (state.editor.workspace) {
        state.editor.workspace.project = project;
        state.editor.workspace.projects = upsertEditorProjectSummary(
          state.editor.workspace.projects,
          project,
        );
      }
    });
  };

  const updateProject = (
    updater: (project: EditorProject) => EditorProject,
    options: {
      historyLabel?: string;
      historySubtitle?: string | null;
      recordHistory?: boolean;
    } = {},
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
      historyLabel: options.historyLabel ?? "Edit",
      historySubtitle: options.historySubtitle ?? null,
      recordHistory: options.recordHistory ?? true,
    });
    if (get().editor.historyTransactionProject) {
      return;
    }

    scheduleEditorProjectSave(nextProject, get().editor.saveProject);
  };

  const persistProject = (project: EditorProject, failureMessage: string) => {
    persistEditorProject(project, get().editor.saveProject, failureMessage);
  };

  const context = {
    cancelPendingProjectSave: cancelEditorProjectSave,
    get,
    persistProject,
    set,
    setProject,
    updateProject,
  };

  return {
    editor: {
      ...createEditorInitialState(),
      closeSidePanel: () => {
        set((state) => {
          state.editor.visibleSidePanel = null;
        });
      },
      ...createEditorHistoryActions(context),
      ...createEditorProjectActions(context),
      ...createEditorWorkspaceActions(context),
      ...createEditorClipboardActions(context),
      ...createEditorExportActions(context),
      ...createEditorTimelineActions(context),
      toggleSidePanel: (panel) => {
        set((state) => {
          state.editor.visibleSidePanel =
            state.editor.visibleSidePanel === panel ? null : panel;
        });
      },
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

type SaveEditorProject = (
  project: EditorProject,
  options?: SaveProjectOptions,
) => Promise<EditorProject>;

function cancelEditorProjectSave() {
  if (editorProjectSaveTimer === null) {
    return;
  }

  window.clearTimeout(editorProjectSaveTimer);
  editorProjectSaveTimer = null;
}

function scheduleEditorProjectSave(
  project: EditorProject,
  saveProject: SaveEditorProject,
) {
  cancelEditorProjectSave();

  editorProjectSaveTimer = window.setTimeout(() => {
    editorProjectSaveTimer = null;
    persistEditorProject(
      project,
      saveProject,
      "[editor] Project autosave failed",
    );
  }, 500);
}

function persistEditorProject(
  project: EditorProject,
  saveProject: SaveEditorProject,
  failureMessage: string,
) {
  void saveProject(project, { applyResponse: false }).catch((error) => {
    console.warn(failureMessage, { error });
  });
}
