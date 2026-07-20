import { describe, expect, it } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestTimelineClip,
} from "../../Editor.slice/Editor.slice.test-utils";
import {
  createEditorExportPreviewClips,
  resolveEditorExportPreviewClipEndSeconds,
} from "./EditorExportBackgroundPreview.utils";

describe("EditorExportBackgroundPreview utils", () => {
  it("sorts playable timeline clips and excludes unavailable media", () => {
    const asset = createEditorTestAsset();
    const project = createEditorTestProject(asset);
    const laterClip = createEditorTestTimelineClip(asset, {
      id: "timeline-later",
      startSeconds: 4,
    });
    const unavailableClip = createEditorTestTimelineClip(asset, {
      id: "timeline-unavailable",
      mediaUrl: null,
      startSeconds: 2,
    });
    const firstClip = createEditorTestTimelineClip(asset, {
      id: "timeline-first",
      startSeconds: 0,
    });

    expect(
      createEditorExportPreviewClips({
        ...project,
        tracks: [
          {
            ...project.tracks[0]!,
            clips: [laterClip, unavailableClip, firstClip],
          },
        ],
      }).map((clip) => clip.id),
    ).toEqual(["timeline-first", "timeline-later"]);
    expect(createEditorExportPreviewClips(null)).toEqual([]);
  });

  it("limits preview playback to the rendered source range", () => {
    const clip = createEditorTestTimelineClip(undefined, {
      durationSeconds: 2,
      inSeconds: 3,
      outSeconds: 10,
      playbackRate: 2,
    });

    expect(resolveEditorExportPreviewClipEndSeconds(clip)).toBe(7);
    expect(
      resolveEditorExportPreviewClipEndSeconds({
        ...clip,
        durationSeconds: 10,
      }),
    ).toBe(10);
  });
});
