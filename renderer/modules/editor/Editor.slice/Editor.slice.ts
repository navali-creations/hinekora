import type {
  EditorProject,
  EditorProjectSummary,
} from "~/main/modules/editor";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

import { editorHistoryLimit } from "./Editor.slice.constants";
import { createEditorExportActions } from "./Editor.slice.export";
import { createEditorHistoryActions } from "./Editor.slice.history";
import { createEditorProjectActions } from "./Editor.slice.project";
import { createEditorInitialState } from "./Editor.slice.state";
import { createEditorTimelineActions } from "./Editor.slice.timeline";
import type { EditorSlice, SetProjectOptions } from "./Editor.slice.types";
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
      ...createEditorProjectActions(context),
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
