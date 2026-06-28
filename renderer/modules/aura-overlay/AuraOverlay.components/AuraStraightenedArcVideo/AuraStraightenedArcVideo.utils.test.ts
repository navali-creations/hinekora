import { describe, expect, it, vi } from "vitest";

import {
  createCanvasContextMock,
  mockCreatedCanvasContext,
} from "../AuraVideoCanvasTest.test-utils";
import {
  createStraightenedArcVideoGeometry,
  drawStraightenedArcVideoFrame,
  shouldDrawStraightenedArcFrame,
} from "./AuraStraightenedArcVideo.utils";

describe("AuraStraightenedArcVideo utils", () => {
  it("draws arc samples into a straightened canvas", () => {
    const canvas = document.createElement("canvas");
    const video = document.createElement("video");
    const context = createCanvasContextMock();
    const sourceContext = createCanvasContextMock();
    vi.spyOn(canvas, "getContext").mockReturnValue(context);
    Object.defineProperty(video, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    });

    const geometry = createStraightenedArcVideoGeometry({
      crop: {
        id: "crop-1",
        label: "Shield",
        shape: "arc",
        x: 90,
        y: 90,
        width: 140,
        height: 80,
        arc: {
          startX: 10,
          startY: 70,
          endX: 130,
          endY: 70,
          controlX: 70,
          controlY: 10,
          thickness: 20,
        },
      },
      displaySize: { width: 240, height: 48 },
      referenceViewport: null,
      videoSize: { width: 1920, height: 1080 },
      visibleThickness: 32,
    });
    if (!geometry) {
      throw new Error("Expected straightened arc geometry");
    }

    const createElement = mockCreatedCanvasContext(sourceContext);
    drawStraightenedArcVideoFrame({ canvas, geometry, video });
    createElement.mockRestore();

    expect(canvas.width).toBe(240);
    expect(canvas.height).toBe(48);
    expect(sourceContext.drawImage).toHaveBeenCalledOnce();
    expect(context.drawImage).toHaveBeenCalled();
    expect(context.setTransform).toHaveBeenCalled();
    const drawCall = vi.mocked(context.drawImage).mock.calls[0];
    expect(drawCall).toHaveLength(9);
    expect(drawCall?.[3]).toBeLessThan(1920);
    expect(drawCall?.[4]).toBeLessThan(1080);
  });

  it("falls back to the source video when the bounded source canvas would be too large", () => {
    const canvas = document.createElement("canvas");
    const video = document.createElement("video");
    const context = createCanvasContextMock();
    const sourceContext = createCanvasContextMock();
    vi.spyOn(canvas, "getContext").mockReturnValue(context);
    Object.defineProperty(video, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    });

    const geometry = createStraightenedArcVideoGeometry({
      crop: {
        id: "crop-1",
        label: "Huge shield",
        shape: "arc",
        x: 0,
        y: 0,
        width: 5_000,
        height: 5_000,
        arc: {
          startX: 0,
          startY: 4_900,
          endX: 4_900,
          endY: 4_900,
          controlX: 2_450,
          controlY: 0,
          thickness: 120,
        },
      },
      displaySize: { width: 5_000, height: 120 },
      referenceViewport: null,
      videoSize: { width: 5_000, height: 5_000 },
      visibleThickness: 80,
    });
    if (!geometry) {
      throw new Error("Expected straightened arc geometry");
    }

    const sourcePixels = geometry.sourceBounds
      ? geometry.sourceBounds.width * geometry.sourceBounds.height
      : 0;
    expect(sourcePixels).toBeGreaterThan(4_194_304);

    const createElement = mockCreatedCanvasContext(sourceContext);
    drawStraightenedArcVideoFrame({ canvas, geometry, video });
    createElement.mockRestore();

    expect(sourceContext.drawImage).not.toHaveBeenCalled();
    expect(vi.mocked(context.drawImage).mock.calls[0]?.[0]).toBe(video);
  });

  it("skips drawing when the video frame is not ready", () => {
    const canvas = document.createElement("canvas");
    const video = document.createElement("video");
    const context = createCanvasContextMock();
    vi.spyOn(canvas, "getContext").mockReturnValue(context);
    Object.defineProperty(video, "readyState", {
      configurable: true,
      value: 0,
    });

    const geometry = createStraightenedArcVideoGeometry({
      crop: {
        id: "crop-1",
        label: "Shield",
        shape: "arc",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        arc: {
          startX: 0,
          startY: 100,
          endX: 100,
          endY: 100,
          controlX: 50,
          controlY: 0,
          thickness: 20,
        },
      },
      displaySize: { width: 120, height: 24 },
      referenceViewport: null,
      videoSize: { width: 1920, height: 1080 },
      visibleThickness: 20,
    });
    if (!geometry) {
      throw new Error("Expected straightened arc geometry");
    }

    drawStraightenedArcVideoFrame({ canvas, geometry, video });

    expect(context.drawImage).not.toHaveBeenCalled();
  });

  it("caps straightened arc geometry segments", () => {
    const geometry = createStraightenedArcVideoGeometry({
      crop: {
        id: "crop-1",
        label: "Shield",
        shape: "arc",
        x: 0,
        y: 0,
        width: 1_000,
        height: 700,
        arc: {
          startX: 50,
          startY: 650,
          endX: 950,
          endY: 650,
          controlX: 500,
          controlY: 20,
          thickness: 40,
        },
      },
      displaySize: { width: 2_000, height: 160 },
      referenceViewport: null,
      videoSize: { width: 1920, height: 1080 },
      visibleThickness: 80,
    });

    expect(geometry?.segments).toHaveLength(48);
  });

  it("keeps enough straightened arc segments when the output is narrow", () => {
    const geometry = createStraightenedArcVideoGeometry({
      crop: {
        id: "crop-1",
        label: "Shield",
        shape: "arc",
        x: 0,
        y: 0,
        width: 1_000,
        height: 700,
        arc: {
          startX: 50,
          startY: 650,
          endX: 950,
          endY: 650,
          controlX: 500,
          controlY: 20,
          thickness: 40,
        },
      },
      displaySize: { width: 80, height: 40 },
      referenceViewport: null,
      videoSize: { width: 1920, height: 1080 },
      visibleThickness: 20,
    });

    expect(geometry?.segments.length).toBeGreaterThan(10);
  });

  it("gates straightened arc redraws to the frame budget", () => {
    expect(shouldDrawStraightenedArcFrame(1_000, null)).toBe(true);
    expect(shouldDrawStraightenedArcFrame(1_016, 1_000)).toBe(false);
    expect(shouldDrawStraightenedArcFrame(1_017, 1_000)).toBe(true);
  });
});
