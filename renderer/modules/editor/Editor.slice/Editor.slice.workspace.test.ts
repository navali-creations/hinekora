import { describe, expect, it, vi } from "vitest";

import type {
  EditorMediaAssetPage,
  EditorWorkspace,
} from "~/main/modules/editor";
import type { BoundStore } from "~/renderer/store/store.types";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
  loadEditorProject,
  setupEditorSliceTest,
} from "./Editor.slice.test-utils";

const { createTestStore, getEditorApi } = setupEditorSliceTest();

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

describe("Editor workspace slice", () => {
  it("hydrates the default editor with a fresh empty timeline", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project,
      projects: [],
    });

    await store.getState().editor.hydrate();

    expect(store.getState().editor.project).toMatchObject({
      activeClipId: null,
      durationSeconds: 0,
      id: project.id,
      selectedAssetKey: null,
    });
    expect(store.getState().editor.project?.tracks[0]?.clips).toEqual([]);
    expect(store.getState().editor.workspace?.project).toMatchObject({
      activeClipId: null,
      durationSeconds: 0,
      id: project.id,
      selectedAssetKey: null,
    });
    expect(store.getState().editor.workspace?.project.tracks[0]?.clips).toEqual(
      [],
    );
    expect(store.getState().editor.selectedAssetKey).toBeNull();
    expect(store.getState().editor.selectedClipId).toBeNull();
    expect(store.getState().editor.playbackSeconds).toBe(0);
    expect(store.getState().editor.mediaRailTab).toBe("all");
    expect(store.getState().editor.mediaPageIndex).toBe(0);
  });

  it("creates projects and surfaces create failures", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    loadEditorProject(store, createEditorTestProject(asset), [asset], {
      historyFuture: [createEditorTestProject(asset, { id: "future-project" })],
      historyPast: [createEditorTestProject(asset, { id: "past-project" })],
      isPreviewPlaying: true,
      mediaPageIndex: 2,
      mediaRailTab: "in-timeline",
      playbackSeconds: 4,
      savedEditPageIndex: 2,
    });
    editorApi.createProject
      .mockResolvedValueOnce(project)
      .mockRejectedValueOnce("failed")
      .mockRejectedValueOnce(new Error("create failed"));

    await store
      .getState()
      .editor.createProject({ source: { id: asset.id, kind: "clip" } });
    expect(store.getState().editor.project).toBe(project);
    expect(store.getState().editor.historyPast).toEqual([]);
    expect(store.getState().editor.historyFuture).toEqual([]);
    expect(store.getState().editor.isPreviewPlaying).toBe(false);
    expect(store.getState().editor.mediaRailTab).toBe("all");
    expect(store.getState().editor.mediaPageIndex).toBe(0);
    expect(store.getState().editor.playbackSeconds).toBe(0);
    expect(store.getState().editor.savedEditPageIndex).toBe(0);
    expect(store.getState().editor.workspace?.projects).toEqual([
      {
        clipCount: 1,
        createdAt: project.createdAt,
        durationSeconds: project.durationSeconds,
        id: project.id,
        title: project.title,
        updatedAt: project.updatedAt,
      },
    ]);

    await store
      .getState()
      .editor.createProject({ source: { id: asset.id, kind: "clip" } });
    expect(store.getState().editor.error).toBe("Editor failed");
    expect(store.getState().editor.isLoading).toBe(false);

    await store
      .getState()
      .editor.createProject({ source: { id: asset.id, kind: "clip" } });
    expect(store.getState().editor.error).toBe("create failed");
  });

  it("opens saved projects and saves project updates", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, {
      id: "saved-project",
      title: "Saved edit",
    });
    const previousProject = createEditorTestProject(asset, {
      id: "saved-project-previous",
      title: "Saved edit previous",
    });
    const projectWithHistory = {
      ...project,
      history: {
        editCount: 1,
        labels: ["Split"],
        subtitles: ["asset-1.mp4"],
        snapshots: [previousProject],
      },
    };
    const savedProject = {
      ...project,
      title: "Saved edit updated",
      updatedAt: "2026-06-18T00:01:00.000Z",
    };
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project: projectWithHistory,
      projects: [
        {
          clipCount: 1,
          createdAt: project.createdAt,
          durationSeconds: project.durationSeconds,
          id: project.id,
          title: project.title,
          updatedAt: project.updatedAt,
        },
        {
          clipCount: 0,
          createdAt: "2026-06-18T00:01:00.000Z",
          durationSeconds: 0,
          id: "alpha-project",
          title: "Alpha edit",
          updatedAt: savedProject.updatedAt,
        },
      ],
    });
    editorApi.saveProject.mockResolvedValue(savedProject);
    loadEditorProject(store, createEditorTestProject(asset), [asset], {
      historyFuture: [createEditorTestProject(asset, { id: "future-project" })],
      historyPast: [createEditorTestProject(asset, { id: "past-project" })],
      isPreviewPlaying: true,
      playbackSeconds: 9,
    });

    await store.getState().editor.openProject(project.id);

    expect(editorApi.getWorkspace).toHaveBeenCalledWith({
      projectLimit: 5,
      projectId: project.id,
    });
    expect(store.getState().editor.project).toBe(projectWithHistory);
    expect(store.getState().editor.historyPast).toEqual([previousProject]);
    expect(store.getState().editor.historyPastLabels).toEqual(["Split"]);
    expect(store.getState().editor.historyPastSubtitles).toEqual([
      "asset-1.mp4",
    ]);
    expect(store.getState().editor.historyFuture).toEqual([]);
    expect(store.getState().editor.playbackSeconds).toBe(0);

    await expect(store.getState().editor.saveProject(project)).resolves.toBe(
      savedProject,
    );

    expect(editorApi.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({
        history: {
          editCount: 1,
          labels: ["Split"],
          subtitles: ["asset-1.mp4"],
          snapshots: [previousProject],
        },
        id: project.id,
      }),
    });
    expect(store.getState().editor.project).toBe(savedProject);
    expect(store.getState().editor.workspace?.projects[0]).toMatchObject({
      id: "alpha-project",
      title: "Alpha edit",
      updatedAt: savedProject.updatedAt,
    });
    expect(store.getState().editor.workspace?.projects[1]).toMatchObject({
      id: savedProject.id,
      title: savedProject.title,
      updatedAt: savedProject.updatedAt,
    });
  });

  it("persists compact history metadata when saving projects", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    editorApi.saveProject.mockImplementation(({ project: savedProject }) =>
      Promise.resolve(savedProject),
    );
    loadEditorProject(store, project, [asset], {
      historyPast: [
        createEditorTestProject(asset, {
          history: { editCount: 1, labels: ["Nested"] },
          id: "previous-project",
        }),
      ],
      historyPastLabels: ["Split", "Mute audio"],
      historyPastSubtitles: ["asset-1.mp4", null],
    });

    await store.getState().editor.saveProject(project);

    expect(editorApi.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({
        history: {
          editCount: 2,
          labels: ["Split", "Mute audio"],
          subtitles: ["asset-1.mp4", null],
          snapshots: [
            expect.objectContaining({
              id: "previous-project",
            }),
          ],
        },
      }),
    });
    expect(
      editorApi.saveProject.mock.calls[0]?.[0].project.history?.snapshots?.[0],
    ).not.toHaveProperty("history");
  });

  it("repairs malformed timeline clip order when opening saved projects", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const earlyClip = createEditorTestTimelineClip(asset, {
      id: "timeline-early",
      startSeconds: 0,
    });
    const overlappingClip = createEditorTestTimelineClip(asset, {
      id: "timeline-overlap",
      startSeconds: 3,
    });
    const lateClip = createEditorTestTimelineClip(asset, {
      id: "timeline-late",
      startSeconds: 4,
    });
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project: {
        ...project,
        activeClipId: "timeline-overlap",
        durationSeconds: 20,
        tracks: [
          {
            ...project.tracks[0]!,
            clips: [lateClip, overlappingClip, earlyClip],
          },
        ],
      },
      projects: [],
    });

    await store.getState().editor.openProject(project.id);

    expect(
      store.getState().editor.project?.tracks[0]?.clips.map((clip) => ({
        id: clip.id,
        startSeconds: clip.startSeconds,
      })),
    ).toEqual([
      { id: "timeline-early", startSeconds: 0 },
      { id: "timeline-overlap", startSeconds: 5 },
      { id: "timeline-late", startSeconds: 10 },
    ]);
    expect(store.getState().editor.project?.durationSeconds).toBe(20);
    expect(store.getState().editor.selectedClipId).toBe("timeline-overlap");
  });

  it("loads more project summaries without replacing the active edit", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, {
      id: "active-project",
      title: "Active edit",
    });
    const refreshedProject = createEditorTestProject(asset, {
      id: "refreshed-project",
      title: "Refreshed edit",
    });
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project: refreshedProject,
      projects: Array.from({ length: 10 }, (_, index) => ({
        clipCount: index,
        createdAt: `2026-06-18T00:0${index}:00.000Z`,
        durationSeconds: index,
        id: `project-${index}`,
        title: `Edit ${index}`,
        updatedAt: `2026-06-18T00:0${index}:00.000Z`,
      })),
    });
    loadEditorProject(store, project, [asset]);

    await store.getState().editor.loadMoreProjects();

    expect(editorApi.getWorkspace).toHaveBeenCalledWith({
      projectId: "active-project",
      projectLimit: 10,
    });
    expect(store.getState().editor.project).toBe(project);
    expect(store.getState().editor.projectLimit).toBe(10);
    expect(store.getState().editor.workspace?.hasMoreProjects).toBe(false);
    expect(store.getState().editor.workspace?.projects).toHaveLength(10);
  });

  it("loads more project summaries without an active edit", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const refreshedProject = createEditorTestProject(asset, {
      id: "refreshed-project",
      title: "Refreshed edit",
    });
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project: refreshedProject,
      projects: [],
    });

    await store.getState().editor.loadMoreProjects();

    expect(editorApi.getWorkspace).toHaveBeenCalledWith({
      projectLimit: 10,
    });
    expect(store.getState().editor.project).toBe(refreshedProject);
  });

  it("deletes saved projects and resets to the default edit", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, {
      id: "saved-project",
      title: "Saved edit",
    });
    const defaultProject = createEditorTestProject(asset, {
      id: "default-project",
      title: "Untitled edit",
    });
    editorApi.deleteProject.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project: defaultProject,
      projects: [],
    });
    loadEditorProject(store, project, [asset], {
      historyFuture: [createEditorTestProject(asset, { id: "future-project" })],
      historyPast: [createEditorTestProject(asset, { id: "past-project" })],
      isPreviewPlaying: true,
      playbackSeconds: 8,
      selectedAssetKey: asset.assetKey,
      selectedClipId: "timeline-1",
    });

    await store.getState().editor.deleteProject(project.id);

    expect(editorApi.deleteProject).toHaveBeenCalledWith("saved-project");
    expect(store.getState().editor.project).toMatchObject({
      activeClipId: null,
      durationSeconds: 0,
      id: "default-project",
      selectedAssetKey: null,
    });
    expect(store.getState().editor.project?.tracks[0]?.clips).toEqual([]);
    expect(store.getState().editor.historyPast).toEqual([]);
    expect(store.getState().editor.historyFuture).toEqual([]);
    expect(store.getState().editor.isPreviewPlaying).toBe(false);
    expect(store.getState().editor.playbackSeconds).toBe(0);
    expect(store.getState().editor.selectedAssetKey).toBeNull();
    expect(store.getState().editor.selectedClipId).toBeNull();
    expect(store.getState().editor.workspace?.projects).toEqual([]);
  });

  it("deletes all saved projects and resets to the default edit", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, {
      id: "saved-project",
      title: "Saved edit",
    });
    const defaultProject = createEditorTestProject(asset, {
      id: "default-project",
      title: "Untitled edit",
    });
    editorApi.deleteAllProjects.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project: defaultProject,
      projects: [],
    });
    loadEditorProject(store, project, [asset], {
      historyFuture: [createEditorTestProject(asset, { id: "future-project" })],
      historyPast: [createEditorTestProject(asset, { id: "past-project" })],
      isPreviewPlaying: true,
      playbackSeconds: 8,
      selectedAssetKey: asset.assetKey,
      selectedClipId: "timeline-1",
    });

    await store.getState().editor.deleteAllProjects();

    expect(editorApi.deleteAllProjects).toHaveBeenCalledTimes(1);
    expect(store.getState().editor.project).toMatchObject({
      activeClipId: null,
      durationSeconds: 0,
      id: "default-project",
      selectedAssetKey: null,
    });
    expect(store.getState().editor.project?.tracks[0]?.clips).toEqual([]);
    expect(store.getState().editor.historyPast).toEqual([]);
    expect(store.getState().editor.historyFuture).toEqual([]);
    expect(store.getState().editor.isPreviewPlaying).toBe(false);
    expect(store.getState().editor.playbackSeconds).toBe(0);
    expect(store.getState().editor.selectedAssetKey).toBeNull();
    expect(store.getState().editor.selectedClipId).toBeNull();
    expect(store.getState().editor.workspace?.projects).toEqual([]);
  });

  it("stores open project failures", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    editorApi.getWorkspace
      .mockRejectedValueOnce("offline")
      .mockRejectedValueOnce(new Error("open failed"));

    await store.getState().editor.openProject("missing-project");
    expect(store.getState().editor.error).toBe("Editor failed");
    expect(store.getState().editor.isLoading).toBe(false);

    await store.getState().editor.openProject("missing-project");
    expect(store.getState().editor.error).toBe("open failed");

    editorApi.deleteProject.mockRejectedValueOnce(new Error("delete failed"));
    await store.getState().editor.deleteProject("missing-project");
    expect(store.getState().editor.error).toBe("delete failed");

    editorApi.deleteProject.mockRejectedValueOnce("delete offline");
    await store.getState().editor.deleteProject("missing-project");
    expect(store.getState().editor.error).toBe("Editor failed");

    editorApi.deleteAllProjects.mockRejectedValueOnce(
      new Error("delete all failed"),
    );
    await store.getState().editor.deleteAllProjects();
    expect(store.getState().editor.error).toBe("delete all failed");

    editorApi.deleteAllProjects.mockRejectedValueOnce("delete all offline");
    await store.getState().editor.deleteAllProjects();
    expect(store.getState().editor.error).toBe("Editor failed");
  });

  it("logs project autosave failures", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    editorApi.saveProject.mockRejectedValue(new Error("save failed"));
    loadEditorProject(store, project, [asset]);

    try {
      store.getState().editor.selectTimelineClip("timeline-1");
      await vi.advanceTimersByTimeAsync(500);

      expect(warn).toHaveBeenCalledWith("[editor] Project autosave failed", {
        error: expect.any(Error),
      });
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });

  it("hydrates a source editor with the source timeline selected", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project,
      projects: [],
    });

    await store.getState().editor.hydrate({ id: asset.id, kind: asset.kind });

    expect(editorApi.getWorkspace).toHaveBeenCalledWith({
      projectLimit: 5,
      source: { id: asset.id, kind: asset.kind },
    });
    expect(store.getState().editor.project).toMatchObject({
      activeClipId: "timeline-1",
      durationSeconds: project.durationSeconds,
      id: project.id,
      selectedAssetKey: asset.assetKey,
    });
    expect(store.getState().editor.project?.tracks[0]?.clips).toHaveLength(1);
    expect(store.getState().editor.selectedAssetKey).toBe(asset.assetKey);
    expect(store.getState().editor.selectedClipId).toBe("timeline-1");
  });

  it("recovers source editor selection when the hydrated project has clips but no active clip", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, {
      activeClipId: null,
      selectedAssetKey: null,
    });
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project,
      projects: [],
    });

    await store.getState().editor.hydrate({ id: asset.id, kind: asset.kind });

    expect(store.getState().editor.project).toMatchObject({
      activeClipId: "timeline-1",
      selectedAssetKey: asset.assetKey,
    });
    expect(store.getState().editor.selectedAssetKey).toBe(asset.assetKey);
    expect(store.getState().editor.selectedClipId).toBe("timeline-1");
  });

  it("preserves source editor asset selection when the hydrated project has no clips", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, {
      activeClipId: "missing",
      selectedAssetKey: asset.assetKey,
      tracks: [{ ...createEditorTestProject(asset).tracks[0]!, clips: [] }],
    });
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project,
      projects: [],
    });

    await store.getState().editor.hydrate({ id: asset.id, kind: asset.kind });

    expect(store.getState().editor.project).toMatchObject({
      activeClipId: null,
      selectedAssetKey: asset.assetKey,
    });
  });

  it("clears source editor selection when the hydrated project has no clips or asset selection", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, {
      activeClipId: "missing",
      selectedAssetKey: null,
      tracks: [{ ...createEditorTestProject(asset).tracks[0]!, clips: [] }],
    });
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project,
      projects: [],
    });

    await store.getState().editor.hydrate({ id: asset.id, kind: asset.kind });

    expect(store.getState().editor.project).toMatchObject({
      activeClipId: null,
      selectedAssetKey: null,
    });
  });

  it("stores hydrate and refresh errors", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    editorApi.getWorkspace.mockRejectedValueOnce("offline");

    await store.getState().editor.hydrate();
    expect(store.getState().editor.error).toBe("Editor failed");
    expect(store.getState().editor.isLoading).toBe(false);

    editorApi.getWorkspace.mockRejectedValueOnce(new Error("load failed"));
    await store.getState().editor.hydrate();
    expect(store.getState().editor.error).toBe("load failed");

    editorApi.getWorkspace.mockRejectedValueOnce(new Error("refresh failed"));
    await store.getState().editor.refreshMedia();
    expect(store.getState().editor.error).toBe("refresh failed");

    editorApi.getWorkspace.mockRejectedValueOnce("offline");
    await store.getState().editor.refreshMedia();
    expect(store.getState().editor.error).toBe("Editor failed");

    editorApi.getWorkspace.mockRejectedValueOnce("offline");
    await store.getState().editor.loadMoreProjects();
    expect(store.getState().editor.error).toBe("Editor failed");

    editorApi.getWorkspace.mockRejectedValueOnce(new Error("load more failed"));
    await store.getState().editor.loadMoreProjects();
    expect(store.getState().editor.error).toBe("load more failed");
  });

  it("hydrates editor media assets without toggling the page loading state", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    editorApi.listMediaAssets.mockResolvedValue({
      items: [asset],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 5,
      totalCount: 1,
    });

    await store.getState().editor.hydrateMediaAssets({
      category: "death-clip",
      game: "poe2",
      league: "Standard",
      pageIndex: 0,
      pageSize: 5,
    });

    expect(editorApi.listMediaAssets).toHaveBeenCalledWith({
      category: "death-clip",
      game: "poe2",
      league: "Standard",
      pageIndex: 0,
      pageSize: 5,
    });
    expect(store.getState().editor.mediaAssetPage).toMatchObject({
      items: [asset],
      pageSize: 5,
      totalCount: 1,
    });
    expect(store.getState().editor.mediaAssetPendingQuery).toBeNull();
    expect(store.getState().editor.mediaAssetQuery).toEqual({
      category: "death-clip",
      game: "poe2",
      league: "Standard",
      pageIndex: 0,
      pageSize: 5,
    });
    expect(store.getState().editor.isLoading).toBe(false);

    const nextAsset = createEditorTestAsset({
      assetKey: "clip:asset-2",
      id: "asset-2",
      name: "asset-2.mp4",
    });
    editorApi.listMediaAssets.mockResolvedValueOnce({
      items: [nextAsset],
      pageCount: 1,
      pageIndex: 1,
      pageSize: 5,
      totalCount: 2,
    });
    await store.getState().editor.hydrateMediaAssets({
      category: "death-clip",
      game: "poe2",
      league: "Standard",
      pageIndex: 1,
      pageSize: 5,
    });

    expect(
      store.getState().editor.mediaAssetPage?.items.map((item) => item.id),
    ).toEqual(["asset-2"]);

    editorApi.listMediaAssets.mockRejectedValueOnce(new Error("media failed"));
    await store.getState().editor.hydrateMediaAssets({
      category: "recording",
      game: "poe1",
      pageSize: 10,
    });

    expect(store.getState().editor.error).toBe("media failed");
    expect(store.getState().editor.mediaAssetPendingQuery).toBeNull();
    expect(
      store.getState().editor.mediaAssetPage?.items.map((item) => item.id),
    ).toEqual(["asset-2"]);

    editorApi.listMediaAssets.mockRejectedValueOnce("offline");
    await store.getState().editor.hydrateMediaAssets({
      category: "recording",
      game: "poe1",
      pageIndex: 0,
      pageSize: 10,
    });

    expect(store.getState().editor.error).toBe("Editor failed");
  });

  it("keeps editor media asset paging pending until the response loads", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const firstAsset = createEditorTestAsset({
      assetKey: "clip:asset-1",
      id: "asset-1",
      name: "asset-1.mp4",
    });
    const secondAsset = createEditorTestAsset({
      assetKey: "clip:asset-2",
      id: "asset-2",
      name: "asset-2.mp4",
    });
    const secondPage = createDeferred<EditorMediaAssetPage>();
    editorApi.listMediaAssets
      .mockResolvedValueOnce({
        items: [firstAsset],
        pageCount: 2,
        pageIndex: 0,
        pageSize: 1,
        totalCount: 2,
      })
      .mockReturnValueOnce(secondPage.promise);

    await store.getState().editor.hydrateMediaAssets({
      category: "death-clip",
      game: "poe2",
      pageIndex: 0,
      pageSize: 1,
    });
    const request = store.getState().editor.hydrateMediaAssets({
      category: "death-clip",
      game: "poe2",
      pageIndex: 1,
      pageSize: 1,
    });
    store.getState().editor.setMediaPageIndex(1);

    expect(store.getState().editor.mediaPageIndex).toBe(0);
    expect(store.getState().editor.mediaAssetPendingQuery).toEqual({
      category: "death-clip",
      game: "poe2",
      pageIndex: 1,
      pageSize: 1,
    });
    expect(store.getState().editor.mediaAssetQuery).toEqual({
      category: "death-clip",
      game: "poe2",
      pageIndex: 0,
      pageSize: 1,
    });

    secondPage.resolve({
      items: [secondAsset],
      pageCount: 2,
      pageIndex: 1,
      pageSize: 1,
      totalCount: 2,
    });
    await request;

    expect(store.getState().editor.mediaAssetPage?.items).toEqual([
      secondAsset,
    ]);
    expect(store.getState().editor.mediaAssetPendingQuery).toBeNull();
  });

  it("ignores stale editor media asset responses", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const staleAsset = createEditorTestAsset({
      assetKey: "clip:stale",
      id: "stale",
      name: "stale.mp4",
    });
    const currentAsset = createEditorTestAsset({
      assetKey: "recording:current",
      category: "recording",
      id: "current",
      kind: "recording",
      name: "current.mp4",
    });
    const stalePage = createDeferred<EditorMediaAssetPage>();
    const currentPage = createDeferred<EditorMediaAssetPage>();
    editorApi.listMediaAssets
      .mockReturnValueOnce(stalePage.promise)
      .mockReturnValueOnce(currentPage.promise);

    const staleRequest = store.getState().editor.hydrateMediaAssets({
      category: "death-clip",
      game: "poe2",
      pageIndex: 0,
      pageSize: 5,
    });
    const currentRequest = store.getState().editor.hydrateMediaAssets({
      category: "recording",
      game: "poe2",
      pageIndex: 0,
      pageSize: 5,
    });

    currentPage.resolve({
      items: [currentAsset],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 5,
      totalCount: 1,
    });
    await currentRequest;
    stalePage.resolve({
      items: [staleAsset],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 5,
      totalCount: 1,
    });
    await staleRequest;

    expect(store.getState().editor.mediaAssetPage?.items).toEqual([
      currentAsset,
    ]);
    expect(store.getState().editor.mediaAssetQuery).toEqual({
      category: "recording",
      game: "poe2",
      pageIndex: 0,
      pageSize: 5,
    });
  });

  it("ignores stale editor media asset failures", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const currentAsset = createEditorTestAsset({
      assetKey: "recording:current",
      category: "recording",
      id: "current",
      kind: "recording",
      name: "current.mp4",
    });
    const stalePage = createDeferred<EditorMediaAssetPage>();
    const currentPage = createDeferred<EditorMediaAssetPage>();
    editorApi.listMediaAssets
      .mockReturnValueOnce(stalePage.promise)
      .mockReturnValueOnce(currentPage.promise);

    const staleRequest = store.getState().editor.hydrateMediaAssets({
      category: "death-clip",
      game: "poe2",
      pageIndex: 0,
      pageSize: 5,
    });
    const currentRequest = store.getState().editor.hydrateMediaAssets({
      category: "recording",
      game: "poe2",
      pageIndex: 0,
      pageSize: 5,
    });

    currentPage.resolve({
      items: [currentAsset],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 5,
      totalCount: 1,
    });
    await currentRequest;
    stalePage.reject(new Error("stale media failed"));
    await staleRequest;

    expect(store.getState().editor.error).toBeNull();
    expect(store.getState().editor.mediaAssetPage?.items).toEqual([
      currentAsset,
    ]);
  });

  it("keeps media rail paging state in the editor slice", () => {
    const store = createTestStore();

    store.getState().editor.setMediaPageIndex(1);
    store.getState().editor.setSavedEditPageIndex(1);

    expect(store.getState().editor.mediaPageIndex).toBe(1);
    expect(store.getState().editor.savedEditPageIndex).toBe(1);

    store.setState({
      editor: {
        ...store.getState().editor,
        mediaAssetPendingQuery: {
          category: "death-clip",
          game: "poe2",
          pageIndex: 1,
          pageSize: 5,
        },
      },
    });
    store.getState().editor.setMediaPageIndex(2);

    expect(store.getState().editor.mediaPageIndex).toBe(1);

    store.setState((state) => ({
      savedEdits: {
        ...(state.savedEdits as BoundStore["savedEdits"]),
        libraryPendingQuery: { pageIndex: 1 },
      },
    }));
    store.getState().editor.setSavedEditPageIndex(2);

    expect(store.getState().editor.savedEditPageIndex).toBe(1);

    store.getState().editor.setMediaFilter("recording");

    expect(store.getState().editor.mediaFilter).toBe("recording");
    expect(store.getState().editor.mediaPageIndex).toBe(0);
    expect(store.getState().editor.savedEditPageIndex).toBe(0);

    store.getState().editor.setMediaPageIndex(1);
    store.getState().editor.setSavedEditPageIndex(1);

    store.getState().editor.setMediaRailTab("in-timeline");

    expect(store.getState().editor.mediaRailTab).toBe("in-timeline");
    expect(store.getState().editor.mediaPageIndex).toBe(0);
    expect(store.getState().editor.savedEditPageIndex).toBe(0);

    store.getState().editor.setMediaPageIndex(1);
    store.getState().editor.setSavedEditPageIndex(1);
    store.getState().editor.resetMediaPagination();

    expect(store.getState().editor.mediaPageIndex).toBe(0);
    expect(store.getState().editor.savedEditPageIndex).toBe(0);
  });

  it("refreshes available media without resetting the active edit", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const originalAsset = createEditorTestAsset();
    const refreshedAsset = createEditorTestAsset({
      mediaUrl: "hinekora-media://replay-clip/asset-1-refreshed",
      name: "asset-1-refreshed.mp4",
      sizeBytes: 2048,
    });
    const availableAsset = createEditorTestAsset({
      assetKey: "clip:asset-2",
      id: "asset-2",
      mediaUrl: "hinekora-media://replay-clip/asset-2",
      name: "asset-2.mp4",
    });
    const secondTrack = {
      clips: [],
      id: "video-track-2",
      kind: "video" as const,
      label: "Second video",
    };
    const baseProject = createEditorTestProject(originalAsset);
    const project = {
      ...baseProject,
      tracks: [...baseProject.tracks, secondTrack],
    };
    const previousProject = {
      ...project,
      id: "previous-project",
    };
    const refreshedWorkspace: EditorWorkspace = {
      assets: [refreshedAsset, availableAsset],
      hasMoreProjects: false,
      project: createEditorTestProject(availableAsset),
      projects: [],
    };
    editorApi.getWorkspace.mockResolvedValue(refreshedWorkspace);
    loadEditorProject(store, project, [originalAsset], {
      historyPast: [previousProject],
      playbackSeconds: 4.25,
      selectedAssetKey: originalAsset.assetKey,
      selectedClipId: "timeline-1",
    });

    await store.getState().editor.refreshMedia();

    const editor = store.getState().editor;
    const timelineClip = editor.project?.tracks[0]?.clips[0];
    expect(editorApi.getWorkspace).toHaveBeenCalledWith({
      projectId: "project-1",
      projectLimit: 5,
    });
    expect(editor.workspace?.assets).toEqual([refreshedAsset, availableAsset]);
    expect(editor.workspace?.project.id).toBe("project-1");
    expect(editor.project?.id).toBe("project-1");
    expect(editor.project?.assets).toEqual([refreshedAsset]);
    expect(timelineClip?.name).toBe("asset-1-refreshed.mp4");
    expect(timelineClip?.mediaUrl).toBe(
      "hinekora-media://replay-clip/asset-1-refreshed",
    );
    expect(editor.historyPast).toEqual([previousProject]);
    expect(editor.playbackSeconds).toBe(4.25);
    expect(editor.selectedAssetKey).toBe(originalAsset.assetKey);
    expect(editor.selectedClipId).toBe("timeline-1");
  });

  it("refreshes media into a workspace when no project is active", async () => {
    const store = createTestStore();
    const editorApi = getEditorApi();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project,
      projects: [],
    });

    await store.getState().editor.refreshMedia();

    expect(store.getState().editor.project).toBe(project);
    expect(store.getState().editor.workspace).toEqual({
      assets: [asset],
      hasMoreProjects: false,
      project,
      projects: [],
    });
  });

  it("updates local selection, playback, preview, and zoom state", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    loadEditorProject(store, project, [asset], {
      playbackSeconds: 50,
    });

    store.getState().editor.selectAsset(asset.assetKey);
    store.getState().editor.selectTimelineClip("missing");
    store.getState().editor.setPlaybackSeconds(-5);
    store.getState().editor.setPlaybackSeconds(50);
    store.getState().editor.setPreviewPlaying(true);
    store.getState().editor.setPreviewHasAudio(true);
    store.getState().editor.setPreviewVolume(2);
    store.getState().editor.setPreviewVolume(-1);
    store.getState().editor.fitTimelineToEdit();
    expect(store.getState().editor.isTimelineFitToEdit).toBe(true);
    expect(store.getState().editor.zoom).toBe(1);
    store.getState().editor.setZoom(0.1);
    expect(store.getState().editor.isTimelineFitToEdit).toBe(false);
    expect(store.getState().editor.zoom).toBe(1);
    store.getState().editor.setZoom(10);

    expect(store.getState().editor).toMatchObject({
      isPreviewPlaying: true,
      playbackSeconds: 10,
      previewHasAudio: true,
      previewVolume: 0,
      selectedAssetKey: asset.assetKey,
      selectedClipId: "timeline-1",
      zoom: 4,
    });
  });

  it("clamps playback without a loaded project", () => {
    const store = createTestStore();

    store.getState().editor.setPlaybackSeconds(5);

    expect(store.getState().editor.playbackSeconds).toBe(0);
  });

  it("ignores project updates when no project is loaded", () => {
    const store = createTestStore();

    store.getState().editor.selectTimelineClip("missing");
    store.getState().editor.splitTimelineClipAt(5);
    store.getState().editor.moveTimelineClip("missing", 1);
    store.getState().editor.removeTimelineClip("missing");

    expect(store.getState().editor.project).toBeNull();
  });
});
