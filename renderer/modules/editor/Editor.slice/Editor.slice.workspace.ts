import type {
  EditorMediaReference,
  EditorProject,
} from "~/main/modules/editor";
import { trackEvent } from "~/renderer/modules/umami";

import {
  clampEditorTimelineZoom,
  roundToMilliseconds,
} from "../Editor.utils/Editor.utils";
import {
  editorMaxZoom,
  editorMinZoom,
  editorProjectPageSize,
  initialExportState,
} from "./Editor.slice.constants";
import type { EditorSliceActionContext } from "./Editor.slice.context";
import type { EditorSlice } from "./Editor.slice.types";
import {
  findTimelineClip,
  findTimelineClipAt,
  refreshProjectAssets,
  refreshWorkspaceAssets,
} from "./Editor.slice.utils";

type EditorWorkspaceActions = Pick<
  EditorSlice["editor"],
  | "createProject"
  | "deleteProject"
  | "hydrate"
  | "loadMoreProjects"
  | "openProject"
  | "refreshMedia"
  | "saveProject"
  | "selectAsset"
  | "selectTimelineClip"
  | "setPlaybackSeconds"
  | "setPreviewPlaying"
  | "setZoom"
>;

function createEditorWorkspaceActions({
  get,
  set,
  setProject,
  updateProject,
}: EditorSliceActionContext): EditorWorkspaceActions {
  return {
    createProject: async (input) => {
      set((state) => {
        state.editor.error = null;
        state.editor.exportState = initialExportState;
        state.editor.isLoading = true;
      });

      try {
        const project = await window.electron.editor.createProject(input);
        setProject(project, { resetHistory: true, resetViewState: true });
        trackEvent("editor-project-created");
      } catch (error) {
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
      }
    },
    deleteProject: async (projectId) => {
      set((state) => {
        state.editor.error = null;
        state.editor.exportState = initialExportState;
        state.editor.isLoading = true;
      });

      try {
        const workspace = await window.electron.editor.deleteProject(projectId);
        const project = createHydratedEditorProject({
          project: workspace.project,
          shouldStartWithEmptyTimeline: true,
        });
        set((state) => {
          state.editor.error = null;
          state.editor.exportState = initialExportState;
          state.editor.historyFuture = [];
          state.editor.historyFutureLabels = [];
          state.editor.historyPast = [];
          state.editor.historyPastLabels = [];
          state.editor.historyTransactionLabel = null;
          state.editor.historyTransactionProject = null;
          state.editor.hoveredTimelineGap = null;
          state.editor.isLoading = false;
          state.editor.isPreviewPlaying = false;
          state.editor.playbackSeconds = 0;
          state.editor.project = project;
          state.editor.projectLimit = editorProjectPageSize;
          state.editor.selectedAssetKey = null;
          state.editor.selectedClipId = null;
          state.editor.workspace = {
            ...workspace,
            project,
          };
        });
        trackEvent("editor-project-deleted");
      } catch (error) {
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
      }
    },
    hydrate: async (source?: EditorMediaReference | null) => {
      set((state) => {
        state.editor.error = null;
        state.editor.exportState = initialExportState;
        state.editor.isLoading = true;
      });

      try {
        const projectLimit = get().editor.projectLimit;
        const workspace = await window.electron.editor.getWorkspace(
          source ? { projectLimit, source } : { projectLimit },
        );
        const project = createHydratedEditorProject({
          project: workspace.project,
          shouldStartWithEmptyTimeline: !source,
        });
        set((state) => {
          state.editor.error = null;
          state.editor.exportState = initialExportState;
          state.editor.historyFuture = [];
          state.editor.historyFutureLabels = [];
          state.editor.historyPast = [];
          state.editor.historyPastLabels = [];
          state.editor.historyTransactionLabel = null;
          state.editor.historyTransactionProject = null;
          state.editor.hoveredTimelineGap = null;
          state.editor.isLoading = false;
          state.editor.isPreviewPlaying = false;
          state.editor.playbackSeconds = 0;
          state.editor.project = project;
          state.editor.selectedAssetKey = null;
          state.editor.selectedClipId = null;
          state.editor.workspace = {
            ...workspace,
            project,
          };
        });
        trackEvent("editor-hydrated");
      } catch (error) {
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
      }
    },
    loadMoreProjects: async () => {
      set((state) => {
        state.editor.error = null;
      });

      try {
        const currentEditor = get().editor;
        const projectLimit = currentEditor.projectLimit + editorProjectPageSize;
        const refreshedWorkspace = await window.electron.editor.getWorkspace({
          ...(currentEditor.project
            ? { projectId: currentEditor.project.id }
            : {}),
          projectLimit,
        });

        set((state) => {
          const project = state.editor.project ?? refreshedWorkspace.project;
          const workspace = refreshWorkspaceAssets({
            currentWorkspace: state.editor.workspace,
            project,
            refreshedWorkspace,
          });

          state.editor.error = null;
          state.editor.project = project;
          state.editor.projectLimit = projectLimit;
          state.editor.workspace = workspace;
        });
        trackEvent("editor-projects-loaded-more");
      } catch (error) {
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
        });
      }
    },
    openProject: async (projectId) => {
      set((state) => {
        state.editor.error = null;
        state.editor.exportState = initialExportState;
        state.editor.isLoading = true;
      });

      try {
        const workspace = await window.electron.editor.getWorkspace({
          projectLimit: get().editor.projectLimit,
          projectId,
        });
        set((state) => {
          state.editor.error = null;
          state.editor.exportState = initialExportState;
          state.editor.historyFuture = [];
          state.editor.historyFutureLabels = [];
          state.editor.historyPast = [];
          state.editor.historyPastLabels = [];
          state.editor.historyTransactionLabel = null;
          state.editor.historyTransactionProject = null;
          state.editor.hoveredTimelineGap = null;
          state.editor.isLoading = false;
          state.editor.isPreviewPlaying = false;
          state.editor.playbackSeconds = 0;
          state.editor.project = workspace.project;
          state.editor.selectedAssetKey = workspace.project.selectedAssetKey;
          state.editor.selectedClipId = workspace.project.activeClipId;
          state.editor.workspace = workspace;
        });
        trackEvent("editor-project-opened");
      } catch (error) {
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
      }
    },
    refreshMedia: async () => {
      set((state) => {
        state.editor.error = null;
      });

      try {
        const refreshedWorkspace = await window.electron.editor.getWorkspace({
          projectLimit: get().editor.projectLimit,
        });
        set((state) => {
          const project = state.editor.project
            ? refreshProjectAssets(
                state.editor.project,
                refreshedWorkspace.assets,
              )
            : refreshedWorkspace.project;
          const workspace = refreshWorkspaceAssets({
            currentWorkspace: state.editor.workspace,
            project,
            refreshedWorkspace,
          });

          state.editor.error = null;
          state.editor.project = project;
          state.editor.projectLimit = get().editor.projectLimit;
          state.editor.workspace = workspace;
        });
        trackEvent("editor-media-refreshed");
      } catch (error) {
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
        });
      }
    },
    selectAsset: (assetKey) => {
      set((state) => {
        state.editor.selectedAssetKey = assetKey;
      });
    },
    selectTimelineClip: (clipId) => {
      const clip = findTimelineClip(get().editor.project, clipId);
      set((state) => {
        state.editor.selectedAssetKey =
          clip?.assetKey ?? state.editor.selectedAssetKey;
        state.editor.selectedClipId = clipId;
      });
      updateProject(
        (project) => ({
          ...project,
          activeClipId: clipId,
          selectedAssetKey: clip?.assetKey ?? project.selectedAssetKey,
        }),
        { recordHistory: false },
      );
    },
    saveProject: async (project) => {
      const savedProject = await window.electron.editor.saveProject({
        project,
      });
      setProject(savedProject, { recordHistory: false });

      return savedProject;
    },
    setPlaybackSeconds: (seconds) => {
      const durationSeconds = get().editor.project?.durationSeconds ?? 0;
      const playbackSeconds = roundToMilliseconds(
        Math.min(Math.max(seconds, 0), durationSeconds),
      );
      const clipAtPlayback = findTimelineClipAt(
        get().editor.project,
        playbackSeconds,
      );

      set((state) => {
        state.editor.playbackSeconds = playbackSeconds;
        state.editor.selectedAssetKey =
          clipAtPlayback?.assetKey ?? state.editor.selectedAssetKey;
        state.editor.selectedClipId =
          clipAtPlayback?.id ?? state.editor.selectedClipId;
      });
    },
    setPreviewPlaying: (isPlaying) => {
      set((state) => {
        state.editor.isPreviewPlaying = isPlaying;
      });
    },
    setZoom: (zoom) => {
      set((state) => {
        state.editor.zoom = clampEditorTimelineZoom({
          maxZoom: editorMaxZoom,
          minZoom: editorMinZoom,
          zoom,
        });
      });
      trackEvent("editor-timeline-zoom-changed");
    },
  };
}

function createHydratedEditorProject(input: {
  project: EditorProject;
  shouldStartWithEmptyTimeline: boolean;
}): EditorProject {
  const project = clearEditorProjectSelection(input.project);
  if (!input.shouldStartWithEmptyTimeline) {
    return project;
  }

  return {
    ...project,
    durationSeconds: 0,
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: [],
    })),
  };
}

function clearEditorProjectSelection(project: EditorProject): EditorProject {
  return {
    ...project,
    activeClipId: null,
    selectedAssetKey: null,
  };
}

export { createEditorWorkspaceActions };
