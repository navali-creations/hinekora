import { describe, expect, it } from "vitest";

import {
  createCropLayoutPreview,
  createCropPreviewBoxLabelStyle,
  createCropPreviewStageStyle,
  createCropPreviewSurfaceStyle,
  formatCropPreviewBoxLabel,
  resizeCropRegionFromCorner,
  resolveCropPreviewSourceBounds,
} from "./CropLayoutPreview.utils";

const crop = {
  id: "crop-1",
  label: "Flask",
  x: 100,
  y: 50,
  width: 200,
  height: 80,
};

describe("CropLayoutPreview utils", () => {
  it("resizes from the south-east corner without moving the origin", () => {
    expect(resizeCropRegionFromCorner(crop, "se", 25, 15)).toMatchObject({
      x: 100,
      y: 50,
      width: 225,
      height: 95,
    });
  });

  it("resizes from the north-west corner by moving the origin", () => {
    expect(resizeCropRegionFromCorner(crop, "nw", -20, -10)).toMatchObject({
      x: 80,
      y: 40,
      width: 220,
      height: 90,
    });
  });

  it("keeps a resized crop at least one pixel wide and high", () => {
    expect(resizeCropRegionFromCorner(crop, "nw", 500, 500)).toMatchObject({
      x: 299,
      y: 129,
      width: 1,
      height: 1,
    });
  });

  it("positions the source image behind a crop preview box", () => {
    expect(
      createCropPreviewSurfaceStyle(
        {
          ...crop,
          kind: "source",
          sourceX: crop.x,
          sourceY: crop.y,
          sourceWidth: crop.width,
          sourceHeight: crop.height,
          opacity: 1,
          toneIndex: 0,
        },
        { width: 1920, height: 1080 },
      ),
    ).toMatchObject({
      left: "-50%",
      top: "-62.5%",
      width: "960%",
      height: "1350%",
    });
  });

  it("positions crop labels outside the preview boxes", () => {
    expect(
      createCropPreviewBoxLabelStyle(
        {
          ...crop,
          kind: "source",
          sourceX: crop.x,
          sourceY: crop.y,
          sourceWidth: crop.width,
          sourceHeight: crop.height,
          opacity: 1,
          toneIndex: 0,
        },
        { width: 1000, height: 1000 },
      ),
    ).toEqual({
      "--crop-preview-accent": "var(--crop-preview-source-color)",
      left: "10%",
      top: "5%",
      transform: "translateY(calc(-100% - 4px))",
    });
  });

  it("keeps crop labels visible near top and right preview edges", () => {
    expect(
      createCropPreviewBoxLabelStyle(
        {
          ...crop,
          x: 800,
          y: 0,
          width: 100,
          height: 50,
          kind: "aura",
          sourceX: crop.x,
          sourceY: crop.y,
          sourceWidth: crop.width,
          sourceHeight: crop.height,
          opacity: 1,
          toneIndex: 0,
        },
        { width: 1000, height: 1000 },
      ),
    ).toEqual({
      "--crop-preview-accent": "var(--color-primary)",
      left: "90%",
      top: "5%",
      transform: "translateX(-100%) translateY(4px)",
    });
  });

  it("formats preview box labels with the box kind", () => {
    expect(
      formatCropPreviewBoxLabel({
        ...crop,
        kind: "source",
        sourceX: crop.x,
        sourceY: crop.y,
        sourceWidth: crop.width,
        sourceHeight: crop.height,
        opacity: 1,
        toneIndex: 0,
      }),
    ).toBe("Flask (source)");
    expect(
      formatCropPreviewBoxLabel({
        ...crop,
        kind: "aura",
        sourceX: crop.x,
        sourceY: crop.y,
        sourceWidth: crop.width,
        sourceHeight: crop.height,
        opacity: 1,
        toneIndex: 0,
      }),
    ).toBe("Flask (aura)");
  });

  it("keeps the preview stage on the source coordinate aspect ratio", () => {
    expect(createCropPreviewStageStyle({ width: 2560, height: 1440 })).toEqual({
      aspectRatio: "2560 / 1440",
    });
  });

  it("uses source bounds as the crop layout coordinate space", () => {
    expect(
      createCropLayoutPreview(
        {
          id: "profile-1",
          name: "Default",
          game: "poe1",
          targetFps: 30,
          captureTarget: null,
          cropRegions: [crop],
          overlayPlacements: [],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
        { width: 2560, height: 1440 },
      ).bounds,
    ).toEqual({ width: 2560, height: 1440 });
  });

  it("filters preview boxes to the selected aura when requested", () => {
    const preview = createCropLayoutPreview(
      {
        id: "profile-1",
        name: "Default",
        game: "poe1",
        targetFps: 30,
        captureTarget: null,
        cropRegions: [
          crop,
          {
            id: "crop-2",
            label: "Buff",
            x: 400,
            y: 120,
            width: 80,
            height: 40,
          },
        ],
        overlayPlacements: [
          {
            id: "placement-1",
            cropRegionId: "crop-1",
            x: 12,
            y: 14,
            scale: 1,
            opacity: 1,
          },
          {
            id: "placement-2",
            cropRegionId: "crop-2",
            x: 20,
            y: 24,
            scale: 1,
            opacity: 1,
          },
        ],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      { width: 2560, height: 1440 },
      "crop-2",
    );

    expect(preview.boxes).toHaveLength(2);
    expect(preview.boxes.every((box) => box.cropRegionId === "crop-2")).toBe(
      true,
    );
    expect(preview.boxes.map((box) => box.kind)).toEqual(["source", "aura"]);
  });

  it("resolves the source bounds from the active profile capture target", () => {
    expect(
      resolveCropPreviewSourceBounds(
        {
          id: "profile-1",
          name: "Default",
          game: "poe1",
          targetFps: 30,
          captureTarget: {
            kind: "display",
            id: "display-primary",
            label: "Primary",
          },
          cropRegions: [crop],
          overlayPlacements: [],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
        [
          {
            id: "screen:primary:0",
            name: "Screen 1",
            kind: "screen",
            displayId: "display-primary",
            width: 2560,
            height: 1440,
            thumbnailDataUrl: null,
          },
        ],
        null,
      ),
    ).toEqual({ width: 2560, height: 1440 });
  });
});
