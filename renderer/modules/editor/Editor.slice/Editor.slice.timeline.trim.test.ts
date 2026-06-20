import { describe, expect, it } from "vitest";

import type { EditorProject } from "~/main/modules/editor";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
  loadEditorProject,
  setupEditorSliceTest,
} from "./Editor.slice.test-utils";

const { createTestStore } = setupEditorSliceTest();

describe("Editor timeline trim slice", () => {
  it("pushes following clips when trimming a clip end over the next clip", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset);
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-first",
      startSeconds: 0,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      id: "timeline-second",
      inSeconds: 5,
      outSeconds: 10,
      startSeconds: 5,
    });
    const timelineProject = {
      ...project,
      activeClipId: "timeline-first",
      durationSeconds: 10,
      tracks: [{ ...project.tracks[0]!, clips: [firstClip, secondClip] }],
    };
    loadEditorProject(store, timelineProject, [asset]);

    store.getState().editor.trimTimelineClipEdge("timeline-first", "end", 7);

    const clips = store.getState().editor.project?.tracks[0]?.clips ?? [];
    expect(clips[0]).toMatchObject({
      durationSeconds: 7,
      outSeconds: 7,
      startSeconds: 0,
    });
    expect(clips[1]).toMatchObject({
      durationSeconds: 5,
      startSeconds: 7,
    });
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe("Trim");
    expect(store.getState().editor.project?.durationSeconds).toBe(12);
  });

  it("keeps a shortened reordered clip expandable from its source copy", () => {
    const store = createTestStore();
    const firstAsset = createEditorTestAsset({
      assetKey: "clip:first",
      id: "first",
      name: "first.mp4",
    });
    const secondAsset = createEditorTestAsset({
      assetKey: "clip:second",
      id: "second",
      name: "second.mp4",
    });
    const project = createEditorTestProject(firstAsset);
    const shortenedFirstClip = createEditorTestTimelineClip(firstAsset, {
      durationSeconds: 4,
      id: "timeline-first",
      outSeconds: 4,
      sourceOutSeconds: 10,
      startSeconds: 0,
    });
    const secondClip = createEditorTestTimelineClip(secondAsset, {
      id: "timeline-second",
      startSeconds: 4,
    });
    const timelineProject = {
      ...project,
      activeClipId: "timeline-first",
      assets: [firstAsset, secondAsset],
      durationSeconds: 9,
      tracks: [
        {
          ...project.tracks[0]!,
          clips: [shortenedFirstClip, secondClip],
        },
      ],
    };
    loadEditorProject(store, timelineProject, [firstAsset, secondAsset]);

    store.getState().editor.moveTimelineClip("timeline-first", 6, 8);
    store.getState().editor.trimTimelineClipEdge("timeline-first", "end", 15);

    const clips = store.getState().editor.project?.tracks[0]?.clips ?? [];
    expect(clips.map((clip) => clip.id)).toEqual([
      "timeline-second",
      "timeline-first",
    ]);
    expect(clips[1]).toMatchObject({
      durationSeconds: 10,
      inSeconds: 0,
      outSeconds: 10,
      sourceInSeconds: 0,
      sourceOutSeconds: 10,
      startSeconds: 5,
    });
    expect(store.getState().editor.project?.durationSeconds).toBe(15);
  });

  it("expands a start-trimmed reordered clip when the previous clip blocks the left edge", () => {
    const store = createTestStore();
    const firstAsset = createEditorTestAsset({
      assetKey: "clip:first",
      id: "first",
      name: "first.mp4",
    });
    const secondAsset = createEditorTestAsset({
      assetKey: "clip:second",
      id: "second",
      name: "second.mp4",
    });
    const project = createEditorTestProject(firstAsset);
    const secondClip = createEditorTestTimelineClip(secondAsset, {
      id: "timeline-second",
      startSeconds: 0,
    });
    const startTrimmedFirstClip = createEditorTestTimelineClip(firstAsset, {
      durationSeconds: 7,
      id: "timeline-first",
      inSeconds: 3,
      outSeconds: 10,
      sourceOutSeconds: 10,
      startSeconds: 5,
    });
    const timelineProject = {
      ...project,
      activeClipId: "timeline-first",
      assets: [firstAsset, secondAsset],
      durationSeconds: 12,
      tracks: [
        {
          ...project.tracks[0]!,
          clips: [secondClip, startTrimmedFirstClip],
        },
      ],
    };
    loadEditorProject(store, timelineProject, [firstAsset, secondAsset]);

    store.getState().editor.trimTimelineClipEdge("timeline-first", "start", 2);

    const clips = store.getState().editor.project?.tracks[0]?.clips ?? [];
    expect(clips[1]).toMatchObject({
      durationSeconds: 10,
      inSeconds: 0,
      outSeconds: 10,
      sourceInSeconds: 0,
      sourceOutSeconds: 10,
      startSeconds: 5,
    });
    expect(store.getState().editor.project?.durationSeconds).toBe(15);
  });

  it("keeps split clips linked to the original source range", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset);
    loadEditorProject(store, project, [asset]);

    store.getState().editor.splitTimelineClipAt(4);

    const clips = store.getState().editor.project?.tracks[0]?.clips ?? [];
    expect(clips).toEqual([
      expect.objectContaining({
        durationSeconds: 4,
        inSeconds: 0,
        outSeconds: 4,
        sourceInSeconds: 0,
        sourceOutSeconds: 10,
      }),
      expect.objectContaining({
        durationSeconds: 6,
        inSeconds: 4,
        outSeconds: 10,
        sourceInSeconds: 0,
        sourceOutSeconds: 10,
      }),
    ]);
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe("Split");
  });

  it("splits and trims clips even when project asset metadata is missing", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = {
      ...createEditorTestProject(asset),
      assets: [],
    };
    loadEditorProject(store, project, [asset]);

    store.getState().editor.splitTimelineClipAt(4);
    store.getState().editor.trimTimelineClipEdge("timeline-1", "end", 6);

    const clips = store.getState().editor.project?.tracks[0]?.clips ?? [];
    expect(clips[0]).toMatchObject({
      durationSeconds: 6,
      sourceInSeconds: 0,
      sourceOutSeconds: 10,
    });
    expect(clips[1]).toMatchObject({
      startSeconds: 6,
      sourceInSeconds: 0,
      sourceOutSeconds: 10,
    });
  });

  it("ignores splits and trims outside editable clip ranges", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    loadEditorProject(store, project, [asset]);

    store.getState().editor.splitTimelineClipAt(0);
    store.getState().editor.splitTimelineClipAt(10);
    store.getState().editor.trimTimelineClipEdge("missing", "end", 1);
    store.getState().editor.trimTimelineClipEdge("timeline-1", "end", 10);

    expect(store.getState().editor.project).toBe(project);
  });

  it("defensively ignores malformed split and trim clip arrays", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const baseProject = createEditorTestProject(asset);
    const malformedClips = {
      0: undefined,
      findIndex: () => 0,
    } as unknown as EditorProject["tracks"][number]["clips"];
    const malformedProject = {
      ...baseProject,
      tracks: [{ ...baseProject.tracks[0]!, clips: malformedClips }],
    };
    loadEditorProject(store, malformedProject, [asset]);

    store.getState().editor.splitTimelineClipAt(1);
    store.getState().editor.trimTimelineClipEdge("timeline-1", "end", 1);

    expect(store.getState().editor.project).toBe(malformedProject);
  });

  it("defensively ignores zero-length forced split ranges", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const baseProject = createEditorTestProject(asset);
    const clip = createEditorTestTimelineClip(asset, {
      durationSeconds: 10,
      startSeconds: 0,
    });
    const forcedClips = {
      0: clip,
      findIndex: () => 0,
    } as unknown as EditorProject["tracks"][number]["clips"];
    const forcedProject = {
      ...baseProject,
      tracks: [{ ...baseProject.tracks[0]!, clips: forcedClips }],
    };
    loadEditorProject(store, forcedProject, [asset]);

    store.getState().editor.splitTimelineClipAt(0);

    expect(store.getState().editor.project).toBe(forcedProject);
  });
});
