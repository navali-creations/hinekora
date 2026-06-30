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
  areEditorMediaAssetPageQueriesEqual,
  createEditorProjectWithHistoryMetadata,
  createEditorRecentlyClippedSince,
  findTimelineClip,
  findTimelineClipAt,
  getEditorProjectHistoryLabels,
  getEditorProjectHistorySnapshots,
  getEditorProjectHistorySubtitles,
  normalizeEditorProjectTimeline,
  refreshProjectAssets,
  refreshWorkspaceAssets,
} from "./Editor.slice.utils";

type EditorWorkspaceActions = Pick<
  EditorSlice["editor"],
  | "createProject"
  | "deleteAllProjects"
  | "deleteProject"
  | "fitTimelineToEdit"
  | "hydrate"
  | "hydrateMediaAssets"
  | "loadMoreProjects"
  | "openProject"
  | "refreshMedia"
  | "refreshMediaRecentlyClippedSince"
  | "resetMediaPagination"
  | "saveProject"
  | "selectAsset"
  | "selectTimelineClip"
  | "setMediaFilter"
  | "setMediaPageIndex"
  | "setMediaRailTab"
  | "setSavedEditPageIndex"
  | "setPlaybackSeconds"
  | "setPreviewHasAudio"
  | "setPreviewPlaying"
  | "setPreviewVolume"
  | "setZoom"
>;

function createEditorWorkspaceActions({
  get,
  set,
  setProject,
  updateProject,
}: EditorSliceActionContext): EditorWorkspaceActions {
  let mediaAssetRequestId = 0;

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
        set((state) => {
          state.editor.mediaPageIndex = 0;
          state.editor.mediaRailTab = "all";
          state.editor.savedEditPageIndex = 0;
        });
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
          resetEditorLoadedProjectState(state.editor, project);
          state.editor.mediaPageIndex = 0;
          state.editor.mediaRailTab = "all";
          state.editor.playbackSeconds = 0;
          state.editor.project = project;
          state.editor.projectLimit = editorProjectPageSize;
          state.editor.selectedAssetKey = null;
          state.editor.selectedClipId = null;
          state.editor.savedEditPageIndex = 0;
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
    deleteAllProjects: async () => {
      set((state) => {
        state.editor.error = null;
        state.editor.exportState = initialExportState;
        state.editor.isLoading = true;
      });

      try {
        const workspace = await window.electron.editor.deleteAllProjects();
        const project = createHydratedEditorProject({
          project: workspace.project,
          shouldStartWithEmptyTimeline: true,
        });
        set((state) => {
          resetEditorLoadedProjectState(state.editor, project);
          state.editor.mediaPageIndex = 0;
          state.editor.mediaRailTab = "all";
          state.editor.playbackSeconds = 0;
          state.editor.project = project;
          state.editor.projectLimit = editorProjectPageSize;
          state.editor.selectedAssetKey = null;
          state.editor.selectedClipId = null;
          state.editor.savedEditPageIndex = 0;
          state.editor.workspace = {
            ...workspace,
            project,
          };
        });
        trackEvent("editor-projects-deleted-all");
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
          resetEditorLoadedProjectState(state.editor, project);
          if (!source) {
            state.editor.mediaPageIndex = 0;
            state.editor.mediaRailTab = "all";
            state.editor.savedEditPageIndex = 0;
          }
          state.editor.playbackSeconds = 0;
          state.editor.project = project;
          state.editor.selectedAssetKey = project.selectedAssetKey;
          state.editor.selectedClipId = project.activeClipId;
          state.editor.workspace = {
            ...workspace,
            project,
          };
        });
        trackEvent("editor-hydrated");
        return true;
      } catch (error) {
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
        return false;
      }
    },
    hydrateMediaAssets: async (query) => {
      mediaAssetRequestId += 1;
      const requestId = mediaAssetRequestId;
      set((state) => {
        state.editor.error = null;
        state.editor.mediaAssetPendingQuery = query;
      });

      try {
        const mediaAssetPage =
          await window.electron.editor.listMediaAssets(query);
        set((state) => {
          if (
            requestId !== mediaAssetRequestId ||
            state.editor.mediaAssetPendingQuery === null ||
            !areEditorMediaAssetPageQueriesEqual(
              state.editor.mediaAssetPendingQuery,
              query,
            )
          ) {
            return;
          }

          state.editor.error = null;
          state.editor.mediaAssetPendingQuery = null;
          state.editor.mediaAssetPage = mediaAssetPage;
          state.editor.mediaAssetQuery = query;
        });
      } catch (error) {
        set((state) => {
          if (
            requestId !== mediaAssetRequestId ||
            state.editor.mediaAssetPendingQuery === null ||
            !areEditorMediaAssetPageQueriesEqual(
              state.editor.mediaAssetPendingQuery,
              query,
            )
          ) {
            return;
          }

          state.editor.mediaAssetPendingQuery = null;
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
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
        const project = createHydratedEditorProject({
          project: workspace.project,
          shouldStartWithEmptyTimeline: false,
        });
        set((state) => {
          resetEditorLoadedProjectState(state.editor, project);
          state.editor.playbackSeconds = 0;
          state.editor.project = project;
          state.editor.selectedAssetKey = project.selectedAssetKey;
          state.editor.selectedClipId = project.activeClipId;
          state.editor.workspace = {
            ...workspace,
            project,
          };
        });
        trackEvent("editor-project-opened");
        return true;
      } catch (error) {
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
        return false;
      }
    },
    refreshMedia: async () => {
      set((state) => {
        state.editor.error = null;
      });

      try {
        const currentEditor = get().editor;
        const refreshedWorkspace = await window.electron.editor.getWorkspace({
          ...(currentEditor.project
            ? { projectId: currentEditor.project.id }
            : {}),
          projectLimit: currentEditor.projectLimit,
        });
        set((state) => {
          const project = normalizeEditorProjectTimeline(
            state.editor.project
              ? refreshProjectAssets(
                  state.editor.project,
                  refreshedWorkspace.assets,
                )
              : refreshedWorkspace.project,
            { preserveDuration: true },
          );
          const workspace = refreshWorkspaceAssets({
            currentWorkspace: state.editor.workspace,
            project,
            refreshedWorkspace,
          });

          state.editor.error = null;
          state.editor.project = project;
          state.editor.projectLimit = currentEditor.projectLimit;
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
    refreshMediaRecentlyClippedSince: () => {
      const recentlyClippedSince = createEditorRecentlyClippedSince();

      set((state) => {
        state.editor.mediaRecentlyClippedSince = recentlyClippedSince;
      });

      return recentlyClippedSince;
    },
    resetMediaPagination: () => {
      set((state) => {
        state.editor.mediaPageIndex = 0;
        state.editor.savedEditPageIndex = 0;
      });
    },
    fitTimelineToEdit: () => {
      set((state) => {
        state.editor.isTimelineFitToEdit = true;
        state.editor.zoom = editorMinZoom;
      });
      trackEvent("editor-timeline-fit-to-edit");
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
    setMediaFilter: (filter) => {
      set((state) => {
        state.editor.mediaFilter = filter;
        state.editor.mediaPageIndex = 0;
        state.editor.savedEditPageIndex = 0;
      });
    },
    setMediaPageIndex: (pageIndex) => {
      set((state) => {
        if (state.editor.mediaAssetPendingQuery !== null) {
          return;
        }

        state.editor.mediaPageIndex = Math.max(0, pageIndex);
      });
    },
    setMediaRailTab: (tab) => {
      set((state) => {
        if (tab === "recently-clipped") {
          state.editor.mediaRecentlyClippedSince =
            createEditorRecentlyClippedSince();
        }
        state.editor.mediaRailTab = tab;
        state.editor.mediaPageIndex = 0;
        state.editor.savedEditPageIndex = 0;
      });
    },
    setSavedEditPageIndex: (pageIndex) => {
      set((state) => {
        if (get().savedEdits?.libraryPendingQuery) {
          return;
        }

        state.editor.savedEditPageIndex = Math.max(0, pageIndex);
      });
    },
    saveProject: async (project) => {
      const currentEditor = get().editor;
      const projectWithHistory = createEditorProjectWithHistoryMetadata(
        project,
        currentEditor.historyPastLabels,
        currentEditor.historyPastSubtitles,
        currentEditor.historyPast,
      );
      const normalizedProject =
        normalizeEditorProjectTimeline(projectWithHistory);
      const savedProject = await window.electron.editor.saveProject({
        project: normalizedProject,
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
    setPreviewHasAudio: (hasAudio) => {
      set((state) => {
        state.editor.previewHasAudio = hasAudio;
      });
    },
    setPreviewVolume: (volume) => {
      set((state) => {
        state.editor.previewVolume = Math.min(Math.max(volume, 0), 1);
      });
    },
    setZoom: (zoom) => {
      set((state) => {
        state.editor.isTimelineFitToEdit = false;
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
  if (!input.shouldStartWithEmptyTimeline) {
    return resolveEditorProjectSelection(
      normalizeEditorProjectTimeline(input.project, { preserveDuration: true }),
    );
  }

  const project = clearEditorProjectSelection(input.project);
  return {
    ...project,
    durationSeconds: 0,
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: [],
    })),
  };
}

function resetEditorLoadedProjectState(
  editor: EditorSlice["editor"],
  project: EditorProject,
): void {
  editor.error = null;
  editor.exportState = initialExportState;
  editor.historyFuture = [];
  editor.historyFutureLabels = [];
  editor.historyFutureSubtitles = [];
  editor.historyPast = getEditorProjectHistorySnapshots(project);
  editor.historyPastLabels = getEditorProjectHistoryLabels(project);
  editor.historyPastSubtitles = getEditorProjectHistorySubtitles(project);
  editor.historyTransactionLabel = null;
  editor.historyTransactionSubtitle = null;
  editor.historyTransactionProject = null;
  editor.hoveredTimelineGap = null;
  editor.isLoading = false;
  editor.isPreviewPlaying = false;
  editor.isTimelineFitToEdit = false;
}

function resolveEditorProjectSelection(project: EditorProject): EditorProject {
  const currentClip = findTimelineClip(project, project.activeClipId);
  const fallbackClip =
    currentClip ?? project.tracks.flatMap((track) => track.clips)[0] ?? null;
  const activeClipId = fallbackClip?.id ?? null;
  const selectedAssetKey =
    fallbackClip?.assetKey ?? project.selectedAssetKey ?? null;
  if (
    project.activeClipId === activeClipId &&
    project.selectedAssetKey === selectedAssetKey
  ) {
    return project;
  }

  return {
    ...project,
    activeClipId,
    selectedAssetKey,
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
