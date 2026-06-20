import { describe, expect, it } from "vitest";

import {
  detectPathOfExileWindowTitle,
  normalizeCapturePreviewSources,
} from "../CapturePreview.sources";

describe("CapturePreview sources", () => {
  it("keeps screens and Path of Exile windows only", () => {
    expect(
      normalizeCapturePreviewSources([
        {
          id: "screen:1:0",
          name: "Entire Screen",
          displayId: "1",
          width: 2560,
          height: 1440,
          thumbnailDataUrl: null,
        },
        {
          id: "screen:2:1",
          name: "Entire Screen",
          displayId: "2",
          width: 1920,
          height: 1080,
          thumbnailDataUrl: null,
        },
        {
          id: "window:chrome:1",
          name: "Google Chrome",
          displayId: null,
          width: null,
          height: null,
          thumbnailDataUrl: null,
        },
        {
          id: "window:poe1:2",
          name: "Path of Exile",
          displayId: null,
          width: null,
          height: null,
          thumbnailDataUrl: null,
        },
        {
          id: "window:poe2:3",
          name: "Path of Exile 2",
          displayId: null,
          width: null,
          height: null,
          thumbnailDataUrl: null,
        },
        {
          id: "window:poe2:4",
          name: "Path of Exile 2",
          displayId: null,
          width: null,
          height: null,
          thumbnailDataUrl: null,
        },
        {
          id: "window:poe1:5",
          name: "Path   of   Exile",
          displayId: null,
          width: null,
          height: null,
          thumbnailDataUrl: null,
        },
        {
          id: "window:chrome:6",
          name: "Path of Exile - Google Chrome",
          displayId: null,
          width: null,
          height: null,
          thumbnailDataUrl: null,
        },
        {
          id: "window:process:7",
          name: "PathOfExileSteam.exe",
          displayId: null,
          width: null,
          height: null,
          thumbnailDataUrl: null,
        },
        {
          id: "window:short:8",
          name: "PoE 2",
          displayId: null,
          width: null,
          height: null,
          thumbnailDataUrl: null,
        },
      ]),
    ).toEqual([
      {
        id: "screen:1:0",
        name: "Screen 1",
        kind: "screen",
        displayId: "1",
        width: 2560,
        height: 1440,
        thumbnailDataUrl: null,
      },
      {
        id: "screen:2:1",
        name: "Screen 2",
        kind: "screen",
        displayId: "2",
        width: 1920,
        height: 1080,
        thumbnailDataUrl: null,
      },
      {
        id: "window:poe1:2",
        name: "Path of Exile 1",
        kind: "window",
        displayId: null,
        width: null,
        height: null,
        thumbnailDataUrl: null,
      },
      {
        id: "window:poe2:3",
        name: "Path of Exile 2",
        kind: "window",
        displayId: null,
        width: null,
        height: null,
        thumbnailDataUrl: null,
      },
    ]);
  });

  it("detects only exact Path of Exile game window titles", () => {
    expect(detectPathOfExileWindowTitle("Path of Exile")).toBe("poe1");
    expect(detectPathOfExileWindowTitle("Path   of   Exile 2")).toBe("poe2");
    expect(detectPathOfExileWindowTitle("Path of Exile 2 - Chrome")).toBeNull();
    expect(detectPathOfExileWindowTitle("PathOfExileSteam.exe")).toBeNull();
  });
});
