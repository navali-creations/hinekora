import { describe, expect, it } from "vitest";

import {
  findCapturePreviewSourceForTarget,
  resolveCapturePreviewSourceId,
  sourceMatchesCaptureTarget,
} from "./CapturePreview.utils";

const sources = [
  {
    id: "screen:primary:0",
    name: "Screen 1",
    kind: "screen" as const,
    displayId: "display-primary",
    width: 2560,
    height: 1440,
    thumbnailDataUrl: null,
  },
  {
    id: "window:poe:1",
    name: "Path of Exile 1",
    kind: "window" as const,
    displayId: null,
    width: null,
    height: null,
    thumbnailDataUrl: null,
  },
];
const screenSource = sources[0]!;
const windowSource = sources[1]!;

describe("CapturePreview utils", () => {
  it("matches display targets by stable display id", () => {
    expect(
      sourceMatchesCaptureTarget(screenSource, {
        kind: "display",
        id: "display-primary",
        label: "Screen 1",
      }),
    ).toBe(true);
  });

  it("matches older persisted screen source ids", () => {
    expect(
      sourceMatchesCaptureTarget(screenSource, {
        kind: "display",
        id: "screen:primary:0",
        label: "Screen 1",
      }),
    ).toBe(true);
  });

  it("finds the source for a capture target", () => {
    expect(
      findCapturePreviewSourceForTarget(
        {
          kind: "window",
          id: "window:poe:1",
          label: "Path of Exile 1",
        },
        sources,
      ),
    ).toBe(windowSource);
  });

  it("resolves the current source id from profile target before selected source", () => {
    expect(
      resolveCapturePreviewSourceId(
        {
          kind: "display",
          id: "display-primary",
          label: "Screen 1",
        },
        sources,
        "window:poe:1",
      ),
    ).toBe("screen:primary:0");
  });

  it("waits for sources before resolving a stale persisted source id", () => {
    expect(
      resolveCapturePreviewSourceId(
        {
          kind: "display",
          id: "screen:primary:0",
          label: "Screen 1",
        },
        [],
        null,
      ),
    ).toBeNull();
  });
});
