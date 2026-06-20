import { describe, expect, it } from "vitest";

import {
  createCaptureTargetFromPreviewSource,
  createDesktopPreviewConstraints,
} from "./CapturePreviewPanel.utils";

describe("CapturePreviewPanel utils", () => {
  it("persists the stable display id for screen sources", () => {
    expect(
      createCaptureTargetFromPreviewSource({
        id: "screen:1:0",
        name: "Screen 1",
        kind: "screen",
        displayId: "display-primary",
        width: 2560,
        height: 1440,
        thumbnailDataUrl: null,
      }),
    ).toEqual({
      kind: "display",
      id: "display-primary",
      label: "Screen 1",
      width: 2560,
      height: 1440,
    });
  });

  it("persists the current source id for window sources", () => {
    expect(
      createCaptureTargetFromPreviewSource({
        id: "window:poe:1",
        name: "Path of Exile 1",
        kind: "window",
        displayId: null,
        width: null,
        height: null,
        thumbnailDataUrl: null,
      }),
    ).toEqual({
      kind: "window",
      id: "window:poe:1",
      label: "Path of Exile 1",
      width: null,
      height: null,
    });
  });

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
