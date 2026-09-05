import { describe, expect, it } from "vitest";

import { createEditorTestProject } from "../../Editor.slice/Editor.slice.test-utils";
import {
  createExportSubtitle,
  createExportTitle,
  isEditorDeleteShortcut,
  resolveEditorFrameStepSeconds,
  shouldHydrateEditorProject,
} from "./EditorPage.utils";

describe("EditorPage utils", () => {
  it("creates export titles for each status", () => {
    expect(createExportTitle("ready")).toBe("Your video is ready");
    expect(createExportTitle("failed")).toBe("Save failed");
    expect(createExportTitle("exporting")).toBe("Saving video");
  });

  it("creates the ready export subtitle from the export result", () => {
    expect(
      createExportSubtitle({
        fileName: "fallback.mp4",
        result: {
          durationSeconds: 65.4,
          fileName: "render.mp4",
          sizeBytes: 1_572_864,
        },
        status: "ready",
      }),
    ).toBe("render.mp4 - 1:05.40 - 1.5 MB");
  });

  it("falls back to the requested file name or failure text", () => {
    expect(
      createExportSubtitle({
        fileName: "rendering.mp4",
        result: null,
        status: "exporting",
      }),
    ).toBe("rendering.mp4");
    expect(
      createExportSubtitle({
        fileName: null,
        result: null,
        status: "failed",
      }),
    ).toBe("Save failed");
  });

  it("hydrates when the requested source is not already on the timeline", () => {
    const project = createEditorTestProject();
    const emptyTimelineProject = {
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        clips: [],
      })),
    };

    expect(
      shouldHydrateEditorProject({
        project,
        sourceId: "asset-1",
        sourceKind: "clip",
      }),
    ).toBe(false);
    expect(
      shouldHydrateEditorProject({
        project,
        sourceId: "missing",
        sourceKind: "clip",
      }),
    ).toBe(true);
    expect(
      shouldHydrateEditorProject({
        project: emptyTimelineProject,
        sourceId: "asset-1",
        sourceKind: "clip",
      }),
    ).toBe(true);
    expect(
      shouldHydrateEditorProject({
        project,
        sourceId: undefined,
        sourceKind: undefined,
      }),
    ).toBe(false);
  });

  it("detects delete shortcuts", () => {
    expect(
      isEditorDeleteShortcut(
        new KeyboardEvent("keydown", { code: "Delete", key: "Del" }),
      ),
    ).toBe(true);
    expect(
      isEditorDeleteShortcut(new KeyboardEvent("keydown", { key: "Delete" })),
    ).toBe(true);
    expect(
      isEditorDeleteShortcut(
        new KeyboardEvent("keydown", { key: "Backspace" }),
      ),
    ).toBe(false);
  });

  it("resolves frame stepping against the active source clip", () => {
    const project = createEditorTestProject();
    const track = project.tracks[0];
    const clip = track?.clips[0];
    if (!track || !clip) {
      throw new Error("Expected editor test track and clip");
    }
    const timedProject = {
      ...project,
      durationSeconds: 20,
      tracks: [
        {
          ...track,
          clips: [
            {
              ...clip,
              inSeconds: 3,
              playbackRate: 2 as const,
              startSeconds: 10,
            },
          ],
        },
      ],
    };

    expect(
      resolveEditorFrameStepSeconds({
        direction: 1,
        playbackSeconds: 12,
        project: timedProject,
      }),
    ).toBeCloseTo(12 + 1 / 120);
    expect(
      resolveEditorFrameStepSeconds({
        direction: 1,
        playbackSeconds: 0,
        project: timedProject,
      }),
    ).toBeNull();
    expect(
      resolveEditorFrameStepSeconds({
        direction: 1,
        playbackSeconds: 12,
        project: {
          ...timedProject,
          assets: timedProject.assets.map((asset) => ({
            ...asset,
            framesPerSecond: null,
          })),
        },
      }),
    ).toBeNull();
  });

  it("uses the destination clip frame grid across contiguous boundaries", () => {
    const project = createEditorTestProject();
    const firstAsset = {
      ...project.assets[0]!,
      framesPerSecond: 30,
    };
    const secondAsset = {
      ...firstAsset,
      assetKey: "clip:asset-2",
      framesPerSecond: 60,
      id: "asset-2",
    };
    const firstClip = {
      ...project.tracks[0]!.clips[0]!,
      assetKey: firstAsset.assetKey,
      durationSeconds: 1.01,
      inSeconds: 0,
      playbackRate: 1 as const,
      startSeconds: 0,
    };
    const secondClip = {
      ...firstClip,
      assetKey: secondAsset.assetKey,
      id: "timeline-2",
      playbackRate: 2 as const,
      startSeconds: 1.01,
    };
    const mixedFrameRateProject = {
      ...project,
      assets: [firstAsset, secondAsset],
      durationSeconds: 2.02,
      tracks: [{ ...project.tracks[0]!, clips: [firstClip, secondClip] }],
    };

    expect(
      resolveEditorFrameStepSeconds({
        direction: 1,
        playbackSeconds: 1,
        project: mixedFrameRateProject,
      }),
    ).toBe(1.01);
    expect(
      resolveEditorFrameStepSeconds({
        direction: -1,
        playbackSeconds: 1.01,
        project: mixedFrameRateProject,
      }),
    ).toBe(1);
  });
});
