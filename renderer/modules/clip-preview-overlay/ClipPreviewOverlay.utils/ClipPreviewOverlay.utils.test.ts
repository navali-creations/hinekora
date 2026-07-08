import { describe, expect, it } from "vitest";

import {
  clampClipPreviewTrimRange,
  createClipPreviewMediaUrl,
  formatClipPreviewTimestamp,
  getClipPreviewFileTitle,
  moveClipPreviewTrimRange,
  resolveClipPreviewRouteClipId,
} from "./ClipPreviewOverlay.utils";

describe("ClipPreviewOverlay utils", () => {
  it("creates the replay media URL for a clip id", () => {
    expect(createClipPreviewMediaUrl("clip 1")).toBe(
      "hinekora-media://replay-clip/clip%201",
    );
  });

  it("parses the clip id from the overlay route hash", () => {
    expect(
      resolveClipPreviewRouteClipId("#/clip-preview-overlay?clipId=abc-123"),
    ).toBe("abc-123");
  });

  it("clamps trim ranges and formats clip metadata", () => {
    expect(
      clampClipPreviewTrimRange({
        durationSeconds: 10,
        inSeconds: -5,
        outSeconds: 20,
      }),
    ).toEqual({ inSeconds: 0, outSeconds: 10 });
    expect(
      clampClipPreviewTrimRange({
        durationSeconds: 10,
        inSeconds: 9.99,
        outSeconds: 10,
      }),
    ).toEqual({ inSeconds: 9.9, outSeconds: 10 });
    expect(formatClipPreviewTimestamp(0)).toBe("00.00");
    expect(formatClipPreviewTimestamp(5.432)).toBe("05.43");
    expect(formatClipPreviewTimestamp(65.432)).toBe("65.43");
    expect(getClipPreviewFileTitle("C:\\clips\\my-clip.mp4")).toBe("my-clip");
  });

  it("moves trim ranges while preserving selected duration", () => {
    expect(
      moveClipPreviewTrimRange({
        durationSeconds: 10,
        inSeconds: 4,
        trimDurationSeconds: 3,
      }),
    ).toEqual({ inSeconds: 4, outSeconds: 7 });
    expect(
      moveClipPreviewTrimRange({
        durationSeconds: 10,
        inSeconds: 9,
        trimDurationSeconds: 3,
      }),
    ).toEqual({ inSeconds: 7, outSeconds: 10 });
    expect(
      moveClipPreviewTrimRange({
        durationSeconds: 10,
        inSeconds: -2,
        trimDurationSeconds: 3,
      }),
    ).toEqual({ inSeconds: 0, outSeconds: 3 });
  });
});
