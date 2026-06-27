import { describe, expect, it, vi } from "vitest";

import {
  createStraightenedArcVideoGeometry,
  drawStraightenedArcVideoFrame,
  shouldDrawStraightenedArcFrame,
} from "./AuraStraightenedArcVideo.utils";

function createCanvasContextMock(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    setTransform: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
  } as unknown as CanvasRenderingContext2D;
}

describe("AuraStraightenedArcVideo utils", () => {
  it("draws arc samples into a straightened canvas", () => {
    const canvas = document.createElement("canvas");
    const video = document.createElement("video");
    const context = createCanvasContextMock();
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

    drawStraightenedArcVideoFrame({ canvas, geometry, video });

    expect(canvas.width).toBe(240);
    expect(canvas.height).toBe(48);
    expect(context.drawImage).toHaveBeenCalled();
    expect(context.setTransform).toHaveBeenCalled();
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

  it("gates straightened arc redraws to the frame budget", () => {
    expect(shouldDrawStraightenedArcFrame(1_000, null)).toBe(true);
    expect(shouldDrawStraightenedArcFrame(1_010, 1_000)).toBe(false);
    expect(shouldDrawStraightenedArcFrame(1_050, 1_000)).toBe(true);
  });
});
