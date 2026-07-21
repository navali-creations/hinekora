import { describe, expect, it } from "vitest";

import { createEditorTestTimelineClip } from "../../Editor.slice/Editor.slice.test-utils";
import { resolveEditorExportPreviewClipEndSeconds } from "./EditorExportBackgroundPreview.utils";

describe("EditorExportBackgroundPreview utils", () => {
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
