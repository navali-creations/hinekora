import { describe, expect, it } from "vitest";

import { createDesktopPreviewConstraints } from "./CapturePreviewPanel.utils";

describe("CapturePreviewPanel utils", () => {
  it("allows live preview streams above 1080p", () => {
    expect(createDesktopPreviewConstraints("screen:1:0")).toEqual({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: "screen:1:0",
          maxWidth: 3840,
          maxHeight: 2160,
          maxFrameRate: 30,
        },
      },
    });
  });
});
