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
});
