import { describe, expect, it } from "vitest";

import { createReplayClipView } from "~/main/test/factories/replayClip";

import { getClipPreviewFileTitle } from "../ClipPreviewOverlay.page/useClipPreviewOverlayDetail/useClipPreviewOverlayDetail.utils";
import { resolveClipPreviewMediaState } from "../ClipPreviewOverlay.page/useClipPreviewOverlayMediaWorkflow/useClipPreviewOverlayMediaWorkflow.utils";
import { resolveClipPreviewRouteClipId } from "../ClipPreviewOverlay.page/useClipPreviewOverlayRouteClipId/useClipPreviewOverlayRouteClipId.utils";
import {
  clampClipPreviewTrimRange,
  formatClipPreviewTimestamp,
  moveClipPreviewTrimRange,
} from "./ClipPreviewOverlay.utils";

describe("ClipPreviewOverlay utils", () => {
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

  it("prefers the lightweight preview proxy without replacing source media", () => {
    const state = resolveClipPreviewMediaState({
      detail: {
        clip: createReplayClipView({
          durationSeconds: 10,
          hasMediaFile: true,
        }),
        durationSeconds: 10,
        mediaUrl: "hinekora-media://replay-clip/clip-1",
        previewMediaUrl: "hinekora-media://clip-preview/clip-1",
      },
      durationOverrideSeconds: null,
      isCopying: false,
      isMediaReady: true,
      isSaving: false,
      mediaError: null,
      mediaVersion: 2,
    });

    expect(state.videoSrc).toBe("hinekora-media://clip-preview/clip-1?v=2");
    expect(state.clip?.id).toBe("clip-1");
  });
});
