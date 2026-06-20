import { describe, expect, it } from "vitest";

import {
  createClipPreviewMediaUrl,
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
});
