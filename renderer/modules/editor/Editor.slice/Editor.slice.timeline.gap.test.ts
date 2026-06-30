import { describe, expect, it } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
  loadEditorProject,
  setupEditorSliceTest,
} from "./Editor.slice.test-utils";

const { createTestStore } = setupEditorSliceTest();

describe("Editor timeline gap slice", () => {
  it("removes valid timeline gaps and ignores empty gaps", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-first",
      startSeconds: 0,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      id: "timeline-second",
      startSeconds: 7,
    });
    const timelineProject = {
      ...project,
      durationSeconds: 12,
      tracks: [{ ...project.tracks[0]!, clips: [firstClip, secondClip] }],
    };
    loadEditorProject(store, timelineProject, [asset], {
      hoveredTimelineGap: {
        durationSeconds: 2,
        endSeconds: 7,
        id: "gap-5-7",
        startSeconds: 5,
      },
    });

    store.getState().editor.setHoveredTimelineGap({
      durationSeconds: 0,
      endSeconds: 5,
      id: "gap-5-5",
      startSeconds: 5,
    });
    store.getState().editor.removeTimelineGap({
      endSeconds: 5,
      startSeconds: 5,
    });
    expect(store.getState().editor.project).toBe(timelineProject);

    store.getState().editor.removeTimelineGap({
      endSeconds: 7,
      startSeconds: 5,
    });
    expect(
      store.getState().editor.project?.tracks[0]?.clips[1]?.startSeconds,
    ).toBe(5);
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe("Delete gap");
    expect(store.getState().editor.hoveredTimelineGap).toBeNull();
  });

  it("ignores stale gap deletion requests that intersect clips", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-first",
      startSeconds: 0,
    });
    const middleClip = createEditorTestTimelineClip(asset, {
      durationSeconds: 2,
      id: "timeline-middle",
      outSeconds: 2,
      startSeconds: 6,
    });
    const lastClip = createEditorTestTimelineClip(asset, {
      id: "timeline-last",
      startSeconds: 10,
    });
    const timelineProject = {
      ...project,
      durationSeconds: 15,
      tracks: [
        {
          ...project.tracks[0]!,
          clips: [firstClip, middleClip, lastClip],
        },
      ],
    };
    loadEditorProject(store, timelineProject, [asset]);

    store.getState().editor.removeTimelineGap({
      endSeconds: 10,
      startSeconds: 5,
    });

    expect(store.getState().editor.project).toBe(timelineProject);
    expect(store.getState().editor.historyPastLabels).toEqual([]);
  });

  it("removes all timeline gaps in one history entry", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-first",
      startSeconds: 4,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      id: "timeline-second",
      startSeconds: 12,
    });
    const timelineProject = {
      ...project,
      durationSeconds: 17,
      tracks: [{ ...project.tracks[0]!, clips: [secondClip, firstClip] }],
    };
    loadEditorProject(store, timelineProject, [asset], {
      areTimelineGapsHighlighted: true,
      hoveredTimelineGap: {
        durationSeconds: 4,
        endSeconds: 4,
        id: "gap-0-4",
        startSeconds: 0,
      },
    });

    store.getState().editor.removeAllTimelineGaps();

    expect(
      store.getState().editor.project?.tracks[0]?.clips.map((clip) => ({
        id: clip.id,
        startSeconds: clip.startSeconds,
      })),
    ).toEqual([
      { id: "timeline-first", startSeconds: 0 },
      { id: "timeline-second", startSeconds: 5 },
    ]);
    expect(store.getState().editor.project?.durationSeconds).toBe(10);
    expect(store.getState().editor.historyPastLabels).toEqual(["Clear gaps"]);
    expect(store.getState().editor.areTimelineGapsHighlighted).toBe(false);
    expect(store.getState().editor.hoveredTimelineGap).toBeNull();
  });

  it("keeps compact timelines unchanged when clearing all gaps", () => {
    const store = createTestStore();
    const project = createEditorTestProject();
    loadEditorProject(store, project);

    store.getState().editor.removeAllTimelineGaps();

    expect(store.getState().editor.project).toBe(project);
    expect(store.getState().editor.historyPastLabels).toEqual([]);
  });

  it("orders same-start clips deterministically when clearing all gaps", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const secondClip = createEditorTestTimelineClip(asset, {
      id: "timeline-b",
      startSeconds: 5,
    });
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-a",
      startSeconds: 5,
    });
    loadEditorProject(
      store,
      {
        ...project,
        durationSeconds: 10,
        tracks: [{ ...project.tracks[0]!, clips: [secondClip, firstClip] }],
      },
      [asset],
    );

    store.getState().editor.removeAllTimelineGaps();

    expect(
      store.getState().editor.project?.tracks[0]?.clips.map((clip) => ({
        id: clip.id,
        startSeconds: clip.startSeconds,
      })),
    ).toEqual([
      { id: "timeline-a", startSeconds: 0 },
      { id: "timeline-b", startSeconds: 5 },
    ]);
  });

  it("toggles all-gap highlighting without editing the project", () => {
    const store = createTestStore();
    const project = createEditorTestProject();
    loadEditorProject(store, project);

    store.getState().editor.setTimelineGapsHighlighted(true);
    store.getState().editor.setTimelineGapsHighlighted(false);

    expect(store.getState().editor.areTimelineGapsHighlighted).toBe(false);
    expect(store.getState().editor.project).toBe(project);
    expect(store.getState().editor.historyPastLabels).toEqual([]);
  });

  it("removes trailing-only timeline gaps by shrinking duration", () => {
    const store = createTestStore();
    const project = createEditorTestProject(undefined, {
      durationSeconds: 12,
    });
    loadEditorProject(store, project);

    store.getState().editor.removeAllTimelineGaps();

    expect(store.getState().editor.project?.durationSeconds).toBe(10);
    expect(store.getState().editor.historyPastLabels).toEqual(["Clear gaps"]);
  });
});
