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

  it("drops paged media rail assets that are not in the workspace cache", () => {
    const store = createTestStore();
    const originalAsset = createEditorTestAsset();
    const droppedAsset = createEditorTestAsset({
      assetKey: "clip:paged-asset",
      id: "paged-asset",
      mediaUrl: "hinekora-media://replay-clip/paged-asset",
      name: "paged-asset.mp4",
    });
    const project = createEditorTestProject(originalAsset);
    loadEditorProject(store, project, [originalAsset], {
      mediaAssetPage: {
        items: [droppedAsset],
        pageCount: 1,
        pageIndex: 0,
        pageSize: 5,
        totalCount: 1,
      },
      mediaAssetQuery: {
        category: "death-clip",
        game: "poe2",
        pageIndex: 0,
        pageSize: 5,
      },
    });

    store.getState().editor.addAssetToTimelineAt(droppedAsset.assetKey, 10);

    expect(store.getState().editor.project?.assets).toEqual([
      originalAsset,
      droppedAsset,
    ]);
    expect(
      store
        .getState()
        .editor.project?.tracks.flatMap((track) => track.clips)
        .some((clip) => clip.assetKey === droppedAsset.assetKey),
    ).toBe(true);
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

  it("renames an untitled empty timeline from the first dropped asset", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset({ name: "boss-kill.mp4" });
    const project = {
      ...createEditorTestProject(asset),
      durationSeconds: 0,
      title: "Untitled edit",
      tracks: [{ ...createEditorTestProject(asset).tracks[0]!, clips: [] }],
    };
    loadEditorProject(store, project, [asset]);

    store.getState().editor.addAssetToTimelineAt(asset.assetKey, 0);

    expect(store.getState().editor.project?.title).toBe("boss-kill.mp4 edit");
  });

  it("keeps dropped clips sorted when adding into an earlier gap", () => {
    const store = createTestStore();
    const originalAsset = createEditorTestAsset({
      assetKey: "clip:original",
      id: "original",
      name: "original.mp4",
    });
    const droppedAsset = createEditorTestAsset({
      assetKey: "clip:dropped",
      id: "dropped",
      name: "dropped.mp4",
    });
    const project = createEditorTestProject(originalAsset);
    const existingClip = createEditorTestTimelineClip(originalAsset, {
      id: "timeline-original",
      startSeconds: 10,
    });
    loadEditorProject(
      store,
      {
        ...project,
        durationSeconds: 15,
        tracks: [{ ...project.tracks[0]!, clips: [existingClip] }],
      },
      [originalAsset, droppedAsset],
    );

    store.getState().editor.addAssetToTimelineAt(droppedAsset.assetKey, 0);

    expect(
      store.getState().editor.project?.tracks[0]?.clips.map((clip) => ({
        assetKey: clip.assetKey,
        startSeconds: clip.startSeconds,
      })),
    ).toEqual([
      { assetKey: droppedAsset.assetKey, startSeconds: 0 },
      { assetKey: originalAsset.assetKey, startSeconds: 10 },
    ]);
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

  it("changes selected clip speed and recalculates timeline duration", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset);
    loadEditorProject(store, project, [asset], {
      selectedClipId: "timeline-1",
    });

    store.getState().editor.setSelectedTimelineClipPlaybackRate(2);

    expect(store.getState().editor.project?.tracks[0]?.clips[0]).toMatchObject({
      durationSeconds: 5,
      playbackRate: 2,
    });
    expect(store.getState().editor.project?.durationSeconds).toBe(5);
    expect(store.getState().editor.historyPastLabels.at(-1)).toBe("Speed 2x");
    expect(store.getState().editor.historyPastSubtitles.at(-1)).toBe(
      "asset-1.mp4",
    );
  });

  it("pushes following clips when slowing a selected clip would overlap them", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset({ durationSeconds: 10 });
    const project = createEditorTestProject(asset);
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-first",
      startSeconds: 0,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      id: "timeline-second",
      startSeconds: 5,
    });
    loadEditorProject(
      store,
      {
        ...project,
        activeClipId: "timeline-first",
        durationSeconds: 10,
        tracks: [{ ...project.tracks[0]!, clips: [firstClip, secondClip] }],
      },
      [asset],
      { selectedClipId: "timeline-first" },
    );

    store.getState().editor.setSelectedTimelineClipPlaybackRate(0.5);

    const clips = store.getState().editor.project?.tracks[0]?.clips ?? [];
    expect(clips[0]).toMatchObject({
      durationSeconds: 10,
      playbackRate: 0.5,
      startSeconds: 0,
    });
    expect(clips[1]).toMatchObject({ startSeconds: 10 });
    expect(store.getState().editor.project?.durationSeconds).toBe(15);
  });

  it("keeps the project exportable when a slower speed exceeds the duration limit", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset({ durationSeconds: 22_000 });
    const project = createEditorTestProject(asset);
    const longClip = createEditorTestTimelineClip(asset, {
      durationSeconds: 22_000,
      outSeconds: 22_000,
      sourceOutSeconds: 22_000,
    });
    const longProject = {
      ...project,
      activeClipId: longClip.id,
      durationSeconds: 22_000,
      tracks: [{ ...project.tracks[0]!, clips: [longClip] }],
    };
    loadEditorProject(store, longProject, [asset], {
      selectedClipId: longClip.id,
    });

    store.getState().editor.setSelectedTimelineClipPlaybackRate(0.25);

    expect(store.getState().editor.project).toBe(longProject);
    expect(store.getState().editor.historyPast).toEqual([]);
  });

  it("keeps project identity when selected clip speed cannot change", () => {
    const store = createTestStore();
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    loadEditorProject(store, project, [asset], {
      selectedClipId: null,
    });

    store.getState().editor.setSelectedTimelineClipPlaybackRate(2);

    expect(store.getState().editor.project).toBe(project);
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
