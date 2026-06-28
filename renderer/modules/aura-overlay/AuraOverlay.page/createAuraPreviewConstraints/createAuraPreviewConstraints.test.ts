import { describe, expect, it } from "vitest";

import { createAuraPreviewConstraints } from "./createAuraPreviewConstraints";

describe("createAuraPreviewConstraints", () => {
  it("requests a 60fps desktop capture stream for aura overlays", () => {
    expect(createAuraPreviewConstraints("screen:1")).toEqual({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: "screen:1",
          maxWidth: 7680,
          maxHeight: 4320,
          maxFrameRate: 60,
        },
      },
    });
  });
});
