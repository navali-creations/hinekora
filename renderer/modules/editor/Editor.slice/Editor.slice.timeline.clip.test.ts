import { describe, expect, it } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
  loadEditorProject,
  setupEditorSliceTest,
} from "./Editor.slice.test-utils";

const { createTestStore } = setupEditorSliceTest();

describe("Editor timeline clip slice", () => {
  it("keeps dropped assets in project references", () => {
    const store = createTestStore();
    const originalAsset = createEditorTestAsset();
    const droppedAsset = createEditorTestAsset({
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
    loadEditorProject(store, project, [originalAsset, droppedAsset]);

    store.getState().editor.addAssetToTimelineAt(droppedAsset.assetKey, 10);

    expect(store.getState().editor.project?.assets).toEqual([
      originalAsset,
      droppedAsset,
    ]);
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe(
      "Add asset-2.mp4",
    );
    expect(store.getState().editor.project?.tracks[1]).toBe(secondTrack);
  });

  it("ignores dropped assets that are unavailable or have no video track", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const unavailableAsset = createEditorTestAsset({
      assetKey: "clip:unavailable",
      exists: false,
      id: "unavailable",
      mediaUrl: null,
      status: "missing",
    });
    const project = {
      ...createEditorTestProject(asset),
      tracks: [],
    };
    loadEditorProject(store, project, [asset, unavailableAsset]);

    store.getState().editor.addAssetToTimelineAt("clip:missing", 0);
    store.getState().editor.addAssetToTimelineAt(unavailableAsset.assetKey, 0);
    store.getState().editor.addAssetToTimelineAt(asset.assetKey, 0);

    expect(store.getState().editor.project).toBe(project);
  });

  it("ignores dropped assets that are not ready", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const unavailableAsset = createEditorTestAsset({
      assetKey: "clip:processing",
      exists: true,
      id: "processing",
      mediaUrl: "hinekora-media://replay-clip/processing",
      status: "processing",
    });
    const project = createEditorTestProject(asset);
    loadEditorProject(store, project, [asset, unavailableAsset]);

    store.getState().editor.addAssetToTimelineAt(unavailableAsset.assetKey, 0);

    expect(store.getState().editor.project).toBe(project);
  });

  it("starts the first dropped clip at the beginning of an empty timeline", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = {
      ...createEditorTestProject(asset),
      activeClipId: null,
      durationSeconds: 0,
      tracks: [{ ...createEditorTestProject(asset).tracks[0]!, clips: [] }],
    };
    loadEditorProject(store, project, [asset]);

    store.getState().editor.addAssetToTimelineAt(asset.assetKey, 7);

    expect(
      store.getState().editor.project?.tracks[0]?.clips[0]?.startSeconds,
    ).toBe(0);
  });

  it("reorders a clip across an adjacent clip without requiring a gap", () => {
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
    const firstClip = createEditorTestTimelineClip(firstAsset, {
      id: "timeline-first",
      startSeconds: 0,
    });
    const secondClip = createEditorTestTimelineClip(secondAsset, {
      id: "timeline-second",
      startSeconds: 5,
    });
    const timelineProject = {
      ...project,
      activeClipId: "timeline-first",
      assets: [firstAsset, secondAsset],
      durationSeconds: 10,
      tracks: [{ ...project.tracks[0]!, clips: [firstClip, secondClip] }],
    };
    loadEditorProject(store, timelineProject, [firstAsset, secondAsset]);

    store.getState().editor.moveTimelineClip("timeline-first", 6, 8);

    const clips = store.getState().editor.project?.tracks[0]?.clips ?? [];
    expect(clips.map((clip) => clip.id)).toEqual([
      "timeline-second",
      "timeline-first",
    ]);
    expect(clips.map((clip) => clip.startSeconds)).toEqual([0, 5]);
  });

  it("moves a clip without an explicit cursor position", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    loadEditorProject(store, project, [asset]);

    store.getState().editor.moveTimelineClip("timeline-1", 2);

    expect(store.getState().editor.project?.tracks[0]?.clips[0]).toMatchObject({
      id: "timeline-1",
      startSeconds: 2,
    });
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe("Move");
  });

  it("keeps project identity when a clip move cannot change the timeline", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    loadEditorProject(store, project, [asset]);

    store.getState().editor.moveTimelineClip("missing", 3);

    expect(store.getState().editor.project).toBe(project);
  });

  it("keeps project identity when removing a missing clip", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    loadEditorProject(store, project, [asset]);

    store.getState().editor.removeTimelineClip("missing");

    expect(store.getState().editor.project).toBe(project);
    expect(store.getState().editor.historyPast).toEqual([]);
  });

  it("removes selected clips and falls back to the next clip", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-first",
      startSeconds: 0,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      id: "timeline-second",
      startSeconds: 5,
    });
    const timelineProject = {
      ...project,
      activeClipId: "timeline-second",
      durationSeconds: 10,
      selectedAssetKey: asset.assetKey,
      tracks: [{ ...project.tracks[0]!, clips: [firstClip, secondClip] }],
    };
    loadEditorProject(store, timelineProject, [asset], {
      selectedClipId: "timeline-second",
    });

    store.getState().editor.removeTimelineClip("timeline-first");
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe(
      "Delete asset-1.mp4",
    );
    expect(store.getState().editor.project?.activeClipId).toBe(
      "timeline-second",
    );

    store.getState().editor.removeTimelineClip("timeline-second");
    expect(store.getState().editor.project).toMatchObject({
      activeClipId: null,
      durationSeconds: 0,
      selectedAssetKey: null,
    });
  });
});
