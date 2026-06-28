import { describe, expect, it, vi } from "vitest";

import { AuraPointPlacementSettings } from "~/types";
import {
  createCanvasContextMock,
  mockCreatedCanvasContext,
} from "../AuraVideoCanvasTest.test-utils";
import {
  createPointStackVideoGeometry,
  drawPointStackVideoFrame,
  shouldDrawPointStackFrame,
} from "./AuraPointStackVideo.utils";

describe("AuraPointStackVideo utils", () => {
  it("draws selected point samples into a vertical stack", () => {
    const canvas = document.createElement("canvas");
    const video = document.createElement("video");
    const context = createCanvasContextMock();
    const sourceContext = createCanvasContextMock();
    vi.spyOn(canvas, "getContext").mockReturnValue(context);
    Object.defineProperty(video, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    });

    const geometry = createPointStackVideoGeometry({
      crop: {
        id: "crop-1",
        label: "Pointer aura",
        shape: "points",
        x: 90,
        y: 90,
        width: 140,
        height: 80,
        points: [
          { x: 10, y: 10 },
          { x: 90, y: 40 },
        ],
      },
      displaySize: { width: 20, height: 40 },
      placement: {
        id: "placement-1",
        cropRegionId: "crop-1",
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        pointGap: AuraPointPlacementSettings.defaultGap,
        pointSampleSize: AuraPointPlacementSettings.defaultSampleSize,
      },
      referenceViewport: null,
      videoSize: { width: 1920, height: 1080 },
    });
    if (!geometry) {
      throw new Error("Expected point stack geometry");
    }

    const createElement = mockCreatedCanvasContext(sourceContext);
    drawPointStackVideoFrame({ canvas, geometry, video });
    createElement.mockRestore();

    expect(canvas.width).toBe(20);
    expect(canvas.height).toBe(40);
    expect(sourceContext.drawImage).toHaveBeenCalledOnce();
    expect(context.drawImage).toHaveBeenCalledTimes(geometry.segments.length);
    const drawCall = vi.mocked(context.drawImage).mock.calls[0];
    expect(drawCall).toHaveLength(9);
    expect(drawCall?.[3]).toBeLessThan(1920);
    expect(drawCall?.[4]).toBeLessThan(1080);
  });

  it("caps point stack geometry segments", () => {
    const geometry = createPointStackVideoGeometry({
      crop: {
        id: "crop-1",
        label: "Pointer aura",
        shape: "points",
        x: 90,
        y: 90,
        width: 140,
        height: 1_000,
        points: [
          { x: 10, y: 10 },
          { x: 90, y: 500 },
          { x: 130, y: 990 },
        ],
      },
      displaySize: { width: 24, height: 2_000 },
      placement: {
        id: "placement-1",
        cropRegionId: "crop-1",
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        pointGap: AuraPointPlacementSettings.defaultGap,
        pointSampleSize: 24,
      },
      referenceViewport: null,
      videoSize: { width: 1920, height: 1080 },
    });

    expect(geometry?.segments).toHaveLength(48);
  });

  it("keeps enough point stack segments when the output is short", () => {
    const geometry = createPointStackVideoGeometry({
      crop: {
        id: "crop-1",
        label: "Pointer aura",
        shape: "points",
        x: 0,
        y: 0,
        width: 1_000,
        height: 1_000,
        points: [
          { x: 10, y: 10 },
          { x: 500, y: 500 },
          { x: 990, y: 990 },
        ],
      },
      displaySize: { width: 20, height: 20 },
      placement: {
        id: "placement-1",
        cropRegionId: "crop-1",
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        pointGap: AuraPointPlacementSettings.defaultGap,
        pointSampleSize: AuraPointPlacementSettings.defaultSampleSize,
      },
      referenceViewport: null,
      videoSize: { width: 1920, height: 1080 },
    });

    expect(geometry?.segments.length).toBeGreaterThan(2);
  });

  it("gates point stack redraws to the frame budget", () => {
    expect(shouldDrawPointStackFrame(1_000, null)).toBe(true);
    expect(shouldDrawPointStackFrame(1_016, 1_000)).toBe(false);
    expect(shouldDrawPointStackFrame(1_017, 1_000)).toBe(true);
  });
});
