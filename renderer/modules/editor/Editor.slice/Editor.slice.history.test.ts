import { describe, expect, it, vi } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  loadEditorProject,
  setupEditorSliceTest,
} from "./Editor.slice.test-utils";

const { createTestStore, getEditorApi } = setupEditorSliceTest();

describe("Editor history slice", () => {
  it("records history transactions and supports undo and redo", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const projectTrack = project.tracks[0];
    const projectClip = projectTrack?.clips[0];
    if (!projectTrack || !projectClip) {
      throw new Error("Expected test project to include a timeline clip");
    }
    const changedProject = {
      ...project,
      activeClipId: null,
      durationSeconds: 3,
      selectedAssetKey: null,
      tracks: [
        {
          ...projectTrack,
          clips: [
            {
              ...projectClip,
              durationSeconds: 3,
              outSeconds: 3,
            },
          ],
        },
      ],
    };
    loadEditorProject(store, project, [asset], {
      historyFuture: [changedProject],
      isPreviewPlaying: true,
      playbackSeconds: 20,
    });

    store.getState().editor.beginHistoryTransaction("Trim end", "asset-1.mp4");
    store.getState().editor.beginHistoryTransaction("Move");
    store.setState((state) => ({
      editor: {
        ...state.editor,
        project: changedProject,
      },
    }));
    store.getState().editor.commitHistoryTransaction();

    expect(store.getState().editor.historyPast.at(-1)).toBe(project);
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe("Trim end");
    expect(store.getState().editor.historyPastSubtitles.at(-1)).toBe(
      "asset-1.mp4",
    );
    expect(store.getState().editor.historyFuture).toEqual([]);
    expect(store.getState().editor.historyFutureLabels).toEqual([]);
    expect(store.getState().editor.historyFutureSubtitles).toEqual([]);

    store.getState().editor.undoProjectChange();
    expect(store.getState().editor.project).toBe(project);
    expect(store.getState().editor.historyFutureLabels[0]).toBe("Trim end");
    expect(store.getState().editor.historyFutureSubtitles[0]).toBe(
      "asset-1.mp4",
    );
    expect(store.getState().editor.isPreviewPlaying).toBe(false);
    expect(store.getState().editor.playbackSeconds).toBe(10);
    expect(getEditorApi().saveProject).toHaveBeenLastCalledWith({
      project,
    });

    store.getState().editor.redoProjectChange();
    expect(store.getState().editor.project).toBe(changedProject);
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe("Trim end");
    expect(store.getState().editor.historyPastSubtitles.at(-1)).toBe(
      "asset-1.mp4",
    );
    expect(store.getState().editor.playbackSeconds).toBe(3);
    expect(getEditorApi().saveProject).toHaveBeenLastCalledWith({
      project: {
        ...changedProject,
        history: {
          editCount: 1,
          labels: ["Trim end"],
          subtitles: ["asset-1.mp4"],
          snapshots: [project],
        },
      },
    });
  });

  it("stores compact runtime history snapshots", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset, {
      history: { editCount: 1, labels: ["Nested"] },
    }) as ReturnType<typeof createEditorTestProject> & { zoom: number };
    project.zoom = 4;
    const { history: _history, ...projectWithoutHistory } = project;
    const changedProject = {
      ...projectWithoutHistory,
      durationSeconds: project.durationSeconds + 1,
    };
    loadEditorProject(store, project, [asset]);

    store.getState().editor.beginHistoryTransaction("Move", "source.mp4");
    store.setState((state) => ({
      editor: {
        ...state.editor,
        project: changedProject,
      },
    }));
    store.getState().editor.commitHistoryTransaction();

    const snapshot = store.getState().editor.historyPast.at(-1);
    expect(snapshot).toMatchObject({ id: project.id });
    expect(snapshot).not.toHaveProperty("history");
    expect(snapshot).not.toHaveProperty("zoom");
  });

  it("supports undo and redo when no workspace is loaded", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const previousProject = {
      ...project,
      id: "previous-project",
      durationSeconds: 4,
    };
    const nextProject = {
      ...project,
      id: "next-project",
      durationSeconds: 6,
    };
    store.setState((state) => ({
      editor: {
        ...state.editor,
        historyPast: [previousProject],
        historyPastLabels: ["Delete"],
        historyPastSubtitles: ["asset-1.mp4"],
        playbackSeconds: 20,
        project,
        workspace: null,
      },
    }));

    store.getState().editor.undoProjectChange();
    expect(store.getState().editor.project).toBe(previousProject);
    expect(store.getState().editor.historyFutureLabels).toEqual(["Delete"]);
    expect(store.getState().editor.historyFutureSubtitles).toEqual([
      "asset-1.mp4",
    ]);
    expect(store.getState().editor.workspace).toBeNull();

    store.setState((state) => ({
      editor: {
        ...state.editor,
        historyFuture: [nextProject],
        historyFutureLabels: ["Delete"],
        historyFutureSubtitles: ["asset-1.mp4"],
        project,
        workspace: null,
      },
    }));
    store.getState().editor.redoProjectChange();
    expect(store.getState().editor.project).toBe(nextProject);
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe("Delete");
    expect(store.getState().editor.historyPastSubtitles.at(-1)).toBe(
      "asset-1.mp4",
    );
    expect(store.getState().editor.workspace).toBeNull();
  });

  it("logs undo and redo persistence failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const previousProject = {
      ...project,
      durationSeconds: 4,
      id: "previous-project",
    };
    const nextProject = {
      ...project,
      durationSeconds: 6,
      id: "next-project",
    };
    getEditorApi().saveProject.mockRejectedValue(new Error("save failed"));
    loadEditorProject(store, project, [asset], {
      historyFuture: [nextProject],
      historyFutureLabels: ["Redo"],
      historyFutureSubtitles: ["redo.mp4"],
      historyPast: [previousProject],
      historyPastLabels: ["Undo"],
      historyPastSubtitles: ["undo.mp4"],
    });

    try {
      store.getState().editor.undoProjectChange();
      await Promise.resolve();
      await Promise.resolve();
      expect(warn).toHaveBeenCalledWith("[editor] Project undo save failed", {
        error: expect.any(Error),
      });

      store.getState().editor.redoProjectChange();
      await Promise.resolve();
      await Promise.resolve();
      expect(warn).toHaveBeenCalledWith("[editor] Project redo save failed", {
        error: expect.any(Error),
      });
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps only the latest fifty history entries", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    loadEditorProject(store, createEditorTestProject(asset), [asset]);

    for (let index = 0; index < 55; index += 1) {
      const project = store.getState().editor.project;
      if (!project) {
        throw new Error("Expected test project to be loaded");
      }

      store
        .getState()
        .editor.beginHistoryTransaction(`Edit ${index}`, `clip-${index}.mp4`);
      store.setState((state) => ({
        editor: {
          ...state.editor,
          project: {
            ...project,
            durationSeconds: project.durationSeconds + 1,
            updatedAt: `2026-06-18T00:${index
              .toString()
              .padStart(2, "0")}:00.000Z`,
          },
        },
      }));
      store.getState().editor.commitHistoryTransaction();
    }

    expect(store.getState().editor.historyPast).toHaveLength(50);
    expect(store.getState().editor.historyPastLabels).toHaveLength(50);
    expect(store.getState().editor.historyPastSubtitles).toHaveLength(50);
    expect(store.getState().editor.historyPastLabels[0]).toBe("Edit 5");
    expect(store.getState().editor.historyPastSubtitles[0]).toBe("clip-5.mp4");
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe("Edit 54");
  });

  it("ignores history actions when there is no applicable project change", () => {
    const store = createTestStore();
    store.getState().editor.beginHistoryTransaction();
    store.getState().editor.commitHistoryTransaction();
    store.getState().editor.undoProjectChange();
    store.getState().editor.redoProjectChange();

    expect(store.getState().editor.historyPast).toEqual([]);
    expect(store.getState().editor.historyTransactionProject).toBeNull();
  });
});
