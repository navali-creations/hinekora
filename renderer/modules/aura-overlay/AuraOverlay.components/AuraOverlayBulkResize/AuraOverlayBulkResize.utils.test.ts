import { describe, expect, it } from "vitest";

import type { Profile } from "~/types";
import {
  createAuraProfileUpdateMatchingAnchorSize,
  createAuraScaleAnchorOptions,
  createAuraScaleCategoryCounts,
  isAuraScaleCategory,
} from "./AuraOverlayBulkResize.utils";

const profile: Profile = {
  id: "profile-1",
  name: "Default",
  game: "poe1",
  targetFps: 30,
  captureTarget: null,
  cropRegions: [
    { id: "crop-1", label: "Aura", x: 0, y: 0, width: 40, height: 40 },
    {
      id: "crop-2",
      label: "Aura",
      shape: "arc",
      x: 50,
      y: 0,
      width: 60,
      height: 30,
    },
    {
      id: "crop-3",
      label: "Pointer",
      points: [{ x: 10, y: 10 }],
      shape: "points",
      x: 100,
      y: 0,
      width: 40,
      height: 40,
    },
  ],
  overlayPlacements: [
    {
      id: "placement-1",
      cropRegionId: "crop-1",
      x: 10,
      y: 10,
      scale: 1,
      opacity: 1,
    },
    {
      id: "placement-2",
      cropRegionId: "crop-2",
      x: 20,
      y: 20,
      scale: 2.5,
      opacity: 1,
    },
    {
      id: "placement-3",
      cropRegionId: "crop-3",
      x: 30,
      y: 30,
      scale: 4,
      opacity: 1,
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

describe("createAuraScaleAnchorOptions", () => {
  it("uses aura names and disambiguates duplicate labels", () => {
    expect(createAuraScaleAnchorOptions(profile)).toEqual([
      { category: "rect", label: "Aura (1)", value: "placement-1" },
      { category: "arc", label: "Aura (2)", value: "placement-2" },
      { category: "points", label: "Pointer", value: "placement-3" },
    ]);
  });

  it("falls back to placement labels and handles a missing profile", () => {
    expect(
      createAuraScaleAnchorOptions({
        ...profile,
        cropRegions: profile.cropRegions.slice(0, 1),
      })[1],
    ).toEqual({ category: "rect", label: "Aura 2", value: "placement-2" });
    expect(createAuraScaleAnchorOptions(null)).toEqual([]);
  });
});

describe("createAuraProfileUpdateMatchingAnchorSize", () => {
  it("matches width and height to the rendered anchor size", () => {
    const update = createAuraProfileUpdateMatchingAnchorSize(
      profile,
      "placement-2",
      ["rect", "points"],
      { height: 1080, width: 1920 },
    );

    expect(update?.overlayPlacements?.[0]).toMatchObject({
      height: 75,
      referenceHeight: 1080,
      referenceWidth: 1920,
      scale: 1,
      width: 150,
    });
    expect(update?.overlayPlacements?.[1]).toBe(profile.overlayPlacements[1]);
    expect(update?.overlayPlacements?.[2]).toMatchObject({
      height: 75,
      referenceHeight: 1080,
      referenceWidth: 1920,
      scale: 1,
      width: 150,
    });
  });

  it("returns no update for a missing anchor, crop, or matching dimensions", () => {
    expect(
      createAuraProfileUpdateMatchingAnchorSize(profile, "missing", ["rect"], {
        height: 1080,
        width: 1920,
      }),
    ).toBeNull();
    expect(
      createAuraProfileUpdateMatchingAnchorSize(
        { ...profile, cropRegions: profile.cropRegions.slice(0, 1) },
        "placement-2",
        ["rect"],
        { height: 1080, width: 1920 },
      ),
    ).toBeNull();
    expect(
      createAuraProfileUpdateMatchingAnchorSize(
        {
          ...profile,
          overlayPlacements: profile.overlayPlacements.map(
            (placement, index) =>
              index === 1
                ? placement
                : {
                    ...placement,
                    height: 75,
                    referenceHeight: 1080,
                    referenceWidth: 1920,
                    scale: 1,
                    width: 150,
                  },
          ),
        },
        "placement-2",
        ["rect", "arc", "points"],
        { height: 1080, width: 1920 },
      ),
    ).toBeNull();
  });

  it("only resizes the selected aura categories", () => {
    const update = createAuraProfileUpdateMatchingAnchorSize(
      profile,
      "placement-2",
      ["rect"],
      { height: 1080, width: 1920 },
    );

    expect(update?.overlayPlacements?.[0]).toMatchObject({
      height: 75,
      scale: 1,
      width: 150,
    });
    expect(update?.overlayPlacements?.[1]).toBe(profile.overlayPlacements[1]);
    expect(update?.overlayPlacements?.[2]).toBe(profile.overlayPlacements[2]);
  });

  it("uses the stored capture size as the stable reference viewport", () => {
    const update = createAuraProfileUpdateMatchingAnchorSize(
      {
        ...profile,
        captureTarget: {
          height: 720,
          id: "display-1",
          kind: "display",
          label: "Display 1",
          width: 1280,
        },
      },
      "placement-2",
      ["rect"],
      { height: 1080, width: 1920 },
    );

    expect(update?.overlayPlacements?.[0]).toMatchObject({
      referenceHeight: 720,
      referenceWidth: 1280,
    });
  });

  it("normalizes a pointer anchor so every matched size remains responsive", () => {
    const update = createAuraProfileUpdateMatchingAnchorSize(
      profile,
      "placement-3",
      ["rect", "arc", "points"],
      { height: 1080, width: 1920 },
    );

    expect(update?.overlayPlacements).toEqual(
      profile.overlayPlacements.map((placement) => ({
        ...placement,
        height: 80,
        referenceHeight: 1080,
        referenceWidth: 1920,
        scale: 1,
        width: 80,
      })),
    );
  });
});

describe("createAuraScaleCategoryCounts", () => {
  it("counts every icon in each category", () => {
    expect(createAuraScaleCategoryCounts(profile)).toEqual({
      all: 3,
      arc: 1,
      points: 1,
      rect: 1,
    });
  });

  it("returns empty counts without a profile", () => {
    expect(createAuraScaleCategoryCounts(null)).toEqual({
      all: 0,
      arc: 0,
      points: 0,
      rect: 0,
    });
  });
});

describe("isAuraScaleCategory", () => {
  it("recognizes supported aura categories", () => {
    expect(isAuraScaleCategory("rect")).toBe(true);
    expect(isAuraScaleCategory("all")).toBe(false);
  });
});
