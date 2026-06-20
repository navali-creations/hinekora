import { describe, expect, it, vi } from "vitest";

import type { EditorWorkspace } from "~/main/modules/editor";

import {
  createEditorTestAsset,
  createEditorTestProject,
  loadEditorProject,
  setupEditorSliceTest,
} from "./Editor.slice.test-utils";

const { createTestStore, getEditorApi } = setupEditorSliceTest();

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
      playbackSeconds: 4,
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
    expect(store.getState().editor.playbackSeconds).toBe(0);
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
    const savedProject = {
      ...project,
      title: "Saved edit updated",
      updatedAt: "2026-06-18T00:01:00.000Z",
    };
    editorApi.getWorkspace.mockResolvedValue({
      assets: [asset],
      hasMoreProjects: false,
      project,
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
    expect(store.getState().editor.project).toBe(project);
    expect(store.getState().editor.historyPast).toEqual([]);
    expect(store.getState().editor.historyFuture).toEqual([]);
    expect(store.getState().editor.playbackSeconds).toBe(0);

    await expect(store.getState().editor.saveProject(project)).resolves.toBe(
      savedProject,
    );

    expect(editorApi.saveProject).toHaveBeenCalledWith({ project });
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

  it("hydrates a source editor without selecting but keeps the source timeline", async () => {
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
      activeClipId: null,
      durationSeconds: project.durationSeconds,
      id: project.id,
      selectedAssetKey: null,
    });
    expect(store.getState().editor.project?.tracks[0]?.clips).toHaveLength(1);
    expect(store.getState().editor.selectedAssetKey).toBeNull();
    expect(store.getState().editor.selectedClipId).toBeNull();
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
    store.getState().editor.setZoom(0.1);
    expect(store.getState().editor.zoom).toBe(0.5);
    store.getState().editor.setZoom(10);

    expect(store.getState().editor).toMatchObject({
      isPreviewPlaying: true,
      playbackSeconds: 10,
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
