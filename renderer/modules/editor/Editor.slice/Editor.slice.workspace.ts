import type {
  EditorMediaAssetPageQuery,
  EditorMediaReference,
  EditorProject,
  EditorTimelineClip,
} from "~/main/modules/editor";

import {
  calculateTimelineDuration,
  clampEditorTimelineZoom,
  clampTrimRange,
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

const editorProjectRenameFailureMessage = "Project rename failed";

type EditorWorkspaceActions = Pick<
  EditorSlice["editor"],
  | "createProject"
  | "deleteAllProjects"
  | "deleteProject"
  | "applySingleClipTrimDraft"
  | "fitTimelineToEdit"
  | "hydrate"
  | "hydrateMediaAssets"
  | "loadMoreProjects"
  | "openProject"
  | "refreshMedia"
  | "refreshMediaRecentlyClippedSince"
  | "renameProject"
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
  cancelPendingProjectSave,
  get,
  set,
  setProject,
  updateProject,
}: EditorSliceActionContext): EditorWorkspaceActions {
  let mediaAssetRequestId = 0;
  let mediaAssetPendingPromise: Promise<void> | null = null;
  let mediaAssetPendingPromiseQuery: EditorMediaAssetPageQuery | null = null;
  let mediaRefreshRequestId = 0;
  let projectListRequestId = 0;
  let projectSaveRequestId = 0;
  let projectSaveQueue: Promise<void> | null = null;
  let routeRequestId = 0;

  const createMediaRefreshRequestId = () => {
    mediaRefreshRequestId += 1;

    return mediaRefreshRequestId;
  };

  const createProjectListRequestId = () => {
    projectListRequestId += 1;

    return projectListRequestId;
  };

  const createRouteRequestId = () => {
    routeRequestId += 1;

    return routeRequestId;
  };

  const isCurrentMediaRefreshRequest = (requestId: number) =>
    requestId === mediaRefreshRequestId;
  const isCurrentProjectListRequest = (requestId: number) =>
    requestId === projectListRequestId;
  const isCurrentRouteRequest = (requestId: number) =>
    requestId === routeRequestId;
  const isEditorProjectStillCurrent = (projectId: string | null) =>
    (get().editor.project?.id ?? null) === projectId;
  const enqueueProjectSave = <T>(operation: () => Promise<T>) => {
    const savePromise = projectSaveQueue
      ? projectSaveQueue.then(operation, operation)
      : operation();
    const queuedSave = savePromise.then(
      () => undefined,
      () => undefined,
    );
    projectSaveQueue = queuedSave;
    void queuedSave.then(
      () => {
        if (projectSaveQueue === queuedSave) {
          projectSaveQueue = null;
        }
      },
      () => {
        if (projectSaveQueue === queuedSave) {
          projectSaveQueue = null;
        }
      },
    );

    return savePromise;
  };
  const clearProjectRenameFailureIfSaved = (savedProject: EditorProject) => {
    set((state) => {
      if (state.editor.error !== editorProjectRenameFailureMessage) {
        return;
      }

      if (
        state.editor.project?.id !== savedProject.id ||
        state.editor.project.title !== savedProject.title
      ) {
        return;
      }

      state.editor.error = null;
    });
  };

  return {
    createProject: async (input) => {
      const requestId = createRouteRequestId();
      set((state) => {
        state.editor.error = null;
        state.editor.exportState = initialExportState;
        state.editor.isLoading = true;
      });

      try {
        const project = await window.electron.editor.createProject(input);
        if (!isCurrentRouteRequest(requestId)) {
          return;
        }
        setProject(project, { resetHistory: true, resetViewState: true });
        set((state) => {
          state.editor.mediaPageIndex = 0;
          state.editor.mediaRailTab = "all";
          state.editor.savedEditPageIndex = 0;
        });
      } catch (error) {
        if (!isCurrentRouteRequest(requestId)) {
          return;
        }
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
      }
    },
    deleteProject: async (projectId) => {
      const requestId = createRouteRequestId();
      set((state) => {
        state.editor.error = null;
        state.editor.exportState = initialExportState;
        state.editor.isLoading = true;
      });

      try {
        const workspace = await window.electron.editor.deleteProject(projectId);
        if (!isCurrentRouteRequest(requestId)) {
          return;
        }
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
      } catch (error) {
        if (!isCurrentRouteRequest(requestId)) {
          return;
        }
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
      }
    },
    deleteAllProjects: async () => {
      const requestId = createRouteRequestId();
      set((state) => {
        state.editor.error = null;
        state.editor.exportState = initialExportState;
        state.editor.isLoading = true;
      });

      try {
        const workspace = await window.electron.editor.deleteAllProjects();
        if (!isCurrentRouteRequest(requestId)) {
          return;
        }
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
      } catch (error) {
        if (!isCurrentRouteRequest(requestId)) {
          return;
        }
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
      }
    },
    applySingleClipTrimDraft: (draft) => {
      updateProject(
        (project) => {
          const asset = project.assets.find(
            (item) =>
              item.id === draft.source.id && item.kind === draft.source.kind,
          );
          if (!asset) {
            return project;
          }

          const clipsForAsset = project.tracks
            .flatMap((track) => track.clips)
            .filter((clip) => clip.assetKey === asset.assetKey);
          if (clipsForAsset.length !== 1) {
            return project;
          }

          const clipId = clipsForAsset[0]?.id;
          if (!clipId) {
            return project;
          }

          const range = clampTrimRange({
            asset,
            inSeconds: draft.inSeconds,
            outSeconds: draft.outSeconds,
          });
          const title = draft.title?.trim();
          let didChangeClip = false;
          const tracks = project.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) => {
              if (clip.id !== clipId) {
                return clip;
              }

              const playbackRate = clip.playbackRate;
              const durationSeconds = roundToMilliseconds(
                range.durationSeconds / playbackRate,
              );
              didChangeClip =
                clip.durationSeconds !== durationSeconds ||
                clip.inSeconds !== range.inSeconds ||
                clip.outSeconds !== range.outSeconds ||
                clip.startSeconds !== 0;

              if (!didChangeClip) {
                return clip;
              }

              const nextClip: EditorTimelineClip = {
                ...clip,
                durationSeconds,
                inSeconds: range.inSeconds,
                outSeconds: range.outSeconds,
                playbackRate,
                sourceInSeconds: 0,
                startSeconds: 0,
              };
              if (typeof asset.durationSeconds === "number") {
                nextClip.sourceOutSeconds = asset.durationSeconds;
              } else {
                delete nextClip.sourceOutSeconds;
              }

              return nextClip;
            }),
          }));
          const nextTitle =
            title && project.title !== title ? title : project.title;
          if (!didChangeClip && nextTitle === project.title) {
            return project;
          }

          return {
            ...project,
            activeClipId: clipId,
            durationSeconds: calculateTimelineDuration(tracks),
            selectedAssetKey: asset.assetKey,
            title: nextTitle,
            tracks,
            updatedAt: new Date().toISOString(),
          };
        },
        { historyLabel: "Quick trim", recordHistory: false },
      );
    },
    hydrate: async (source?: EditorMediaReference | null) => {
      const requestId = createRouteRequestId();
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
        if (!isCurrentRouteRequest(requestId)) {
          return false;
        }
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
        return true;
      } catch (error) {
        if (!isCurrentRouteRequest(requestId)) {
          return false;
        }
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
        return false;
      }
    },
    hydrateMediaAssets: (query, options = {}) => {
      const { force = false } = options;
      const currentEditor = get().editor;
      if (
        !force &&
        currentEditor.mediaAssetPendingQuery !== null &&
        mediaAssetPendingPromise !== null &&
        mediaAssetPendingPromiseQuery !== null &&
        areEditorMediaAssetPageQueriesEqual(
          mediaAssetPendingPromiseQuery,
          query,
        )
      ) {
        return mediaAssetPendingPromise;
      }

      if (
        !force &&
        currentEditor.mediaAssetPendingQuery === null &&
        currentEditor.mediaAssetPage !== null &&
        currentEditor.mediaAssetQuery !== null &&
        areEditorMediaAssetPageQueriesEqual(
          currentEditor.mediaAssetQuery,
          query,
        )
      ) {
        set((state) => {
          state.editor.error = null;
        });

        return Promise.resolve();
      }

      mediaAssetRequestId += 1;
      const requestId = mediaAssetRequestId;
      set((state) => {
        state.editor.error = null;
        state.editor.mediaAssetPendingQuery = query;
      });

      const mediaAssetRequest = (async () => {
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
        } finally {
          if (requestId === mediaAssetRequestId) {
            mediaAssetPendingPromise = null;
            mediaAssetPendingPromiseQuery = null;
          }
        }
      })();
      mediaAssetPendingPromise = mediaAssetRequest;
      mediaAssetPendingPromiseQuery = query;

      return mediaAssetRequest;
    },
    loadMoreProjects: async () => {
      const requestId = createProjectListRequestId();
      const projectIdAtRequestStart = get().editor.project?.id ?? null;
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
        if (
          !isCurrentProjectListRequest(requestId) ||
          !isEditorProjectStillCurrent(projectIdAtRequestStart)
        ) {
          return;
        }

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
      } catch (error) {
        if (
          !isCurrentProjectListRequest(requestId) ||
          !isEditorProjectStillCurrent(projectIdAtRequestStart)
        ) {
          return;
        }
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
        });
      }
    },
    openProject: async (projectId) => {
      const requestId = createRouteRequestId();
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
        if (!isCurrentRouteRequest(requestId)) {
          return false;
        }
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
        return true;
      } catch (error) {
        if (!isCurrentRouteRequest(requestId)) {
          return false;
        }
        set((state) => {
          state.editor.error =
            error instanceof Error ? error.message : "Editor failed";
          state.editor.isLoading = false;
        });
        return false;
      }
    },
    refreshMedia: async () => {
      const requestId = createMediaRefreshRequestId();
      const projectIdAtRequestStart = get().editor.project?.id ?? null;
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
        if (
          !isCurrentMediaRefreshRequest(requestId) ||
          !isEditorProjectStillCurrent(projectIdAtRequestStart)
        ) {
          return;
        }
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
      } catch (error) {
        if (
          !isCurrentMediaRefreshRequest(requestId) ||
          !isEditorProjectStillCurrent(projectIdAtRequestStart)
        ) {
          return;
        }
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
    renameProject: (title) => {
      const nextTitle = title.trim();
      const project = get().editor.project;
      if (!project || !nextTitle || project.title === nextTitle) {
        return;
      }

      const nextProject = normalizeEditorProjectTimeline({
        ...project,
        title: nextTitle,
      });
      cancelPendingProjectSave();
      setProject(nextProject, { recordHistory: false });
      set((state) => {
        state.editor.error = null;
      });
      void get()
        .editor.saveProject(nextProject)
        .catch((error) => {
          console.warn("[editor] Project rename save failed", { error });
          set((state) => {
            if (
              state.editor.project?.id !== project.id ||
              state.editor.project.title !== nextTitle
            ) {
              return;
            }

            state.editor.error = editorProjectRenameFailureMessage;
          });
        });
    },
    saveProject: async (project, options = {}) => {
      const { applyResponse = true } = options;
      projectSaveRequestId += 1;
      const requestId = projectSaveRequestId;
      const currentEditor = get().editor;
      const projectWithHistory = createEditorProjectWithHistoryMetadata(
        project,
        currentEditor.historyPastLabels,
        currentEditor.historyPastSubtitles,
        currentEditor.historyPast,
      );
      const normalizedProject =
        normalizeEditorProjectTimeline(projectWithHistory);
      const savedProject = await enqueueProjectSave(async () => {
        const projectAtSaveStart = get().editor.project;
        const savedProject = await window.electron.editor.saveProject({
          project: normalizedProject,
        });
        if (
          applyResponse &&
          requestId === projectSaveRequestId &&
          shouldApplySavedEditorProject(
            projectAtSaveStart,
            get().editor.project,
            savedProject,
          )
        ) {
          setProject(savedProject, { recordHistory: false });
        }
        clearProjectRenameFailureIfSaved(savedProject);

        return savedProject;
      });

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

function shouldApplySavedEditorProject(
  projectAtSaveStart: EditorProject | null,
  currentProject: EditorProject | null,
  savedProject: EditorProject,
): boolean {
  if (!projectAtSaveStart || !currentProject) {
    return true;
  }

  return (
    currentProject === projectAtSaveStart &&
    currentProject.id === savedProject.id
  );
}

export { createEditorWorkspaceActions };
