import { describe, expect, it } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "./Editor.slice.test-utils";
import {
  createEditorCopyToClipboardInput,
  createEditorExportInput,
  findTimelineClipAt,
  refreshProjectAssets,
  resolveAvailableTimelineStart,
} from "./Editor.slice.utils";

describe("Editor slice utilities", () => {
  it("creates editor export and clipboard inputs for sorted clips", () => {
    const asset = createEditorTestAsset();
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-first",
      startSeconds: 5,
    });
    const secondClip = createEditorTestTimelineClip(asset, {
      id: "timeline-second",
      startSeconds: 0,
    });
    const project = {
      ...createEditorTestProject(asset),
      activeClipId: firstClip.id,
      tracks: [
        {
          ...createEditorTestProject(asset).tracks[0]!,
          clips: [firstClip, secondClip],
        },
      ],
    };

    expect(
      createEditorExportInput(project, {
        exportRequestId: "request-1",
        fileName: "clip.mp4",
        mode: "overwrite",
        resolution: "720p",
      }),
    ).toMatchObject({
      clips: [
        expect.objectContaining({ startSeconds: 0 }),
        expect.objectContaining({ startSeconds: 5 }),
      ],
      overwriteSource: { id: asset.id, kind: asset.kind },
    });
    expect(createEditorCopyToClipboardInput(project)).toMatchObject({
      clips: expect.any(Array),
      fileName: expect.any(String),
    });
  });

  it("rejects export and clipboard inputs with empty or missing media", () => {
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const emptyProject = {
      ...project,
      tracks: [{ ...project.tracks[0]!, clips: [] }],
    };
    const missingVideoProject = {
      ...project,
      tracks: [],
    };
    const missingAssetProject = {
      ...project,
      assets: [],
    };
    const missingOverwriteSourceProject = {
      ...project,
      activeClipId: "missing",
    };

    expect(
      createEditorExportInput(emptyProject, {
        exportRequestId: "request-1",
        fileName: "clip.mp4",
        mode: "new-file",
        resolution: "1080p",
      }),
    ).toBeNull();
    expect(createEditorCopyToClipboardInput(emptyProject)).toBeNull();
    expect(createEditorCopyToClipboardInput(missingVideoProject)).toBeNull();
    expect(
      createEditorExportInput(missingAssetProject, {
        exportRequestId: "request-1",
        fileName: "clip.mp4",
        mode: "new-file",
        resolution: "1080p",
      }),
    ).toBeNull();
    expect(
      createEditorExportInput(missingOverwriteSourceProject, {
        exportRequestId: "request-1",
        fileName: "clip.mp4",
        mode: "overwrite",
        resolution: "1080p",
      }),
    ).toBeNull();
  });

  it("covers editor slice utility edge cases", () => {
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const refreshedProject = refreshProjectAssets(project, []);

    expect(refreshedProject.tracks[0]?.clips[0]).toBe(
      project.tracks[0]?.clips[0],
    );
    expect(
      resolveAvailableTimelineStart({
        clips: [
          createEditorTestTimelineClip(asset, {
            durationSeconds: 1,
            startSeconds: 5,
          }),
        ],
        desiredStartSeconds: 0,
        durationSeconds: 1,
      }),
    ).toBe(0);
    expect(
      resolveAvailableTimelineStart({
        clips: [
          createEditorTestTimelineClip(asset, {
            durationSeconds: 5,
            startSeconds: 0,
          }),
          createEditorTestTimelineClip(asset, {
            durationSeconds: 1,
            id: "timeline-later",
            startSeconds: 10,
          }),
        ],
        desiredStartSeconds: -1,
        durationSeconds: 1,
      }),
    ).toBe(5);
    expect(findTimelineClipAt(null, 0)).toBeNull();
    expect(findTimelineClipAt(project, 10)).toBe(project.tracks[0]?.clips[0]);
    expect(findTimelineClipAt(project, 11)).toBeNull();
  });
});
