import { describe, expect, it } from "vitest";

import {
  auraSelectionShapes,
  getAuraSelectionTypeHelp,
  resolveAuraSelectionGridCellSize,
} from "./AuraSelection.utils";

describe("AuraSelection utils", () => {
  it("provides shared labels and help copy for every aura selection shape", () => {
    expect(auraSelectionShapes).toEqual(["rect", "arc", "points"]);
    expect(getAuraSelectionTypeHelp("rect").name).toBe("Default aura");
    expect(getAuraSelectionTypeHelp("arc").overlayText).toContain(
      "energy shield",
    );
    expect(getAuraSelectionTypeHelp("points").selectorText).toContain("ward");
  });

  it.each([
    { height: 1080, width: 1920 },
    { height: 1440, width: 2560 },
    { height: 1440, width: 3440 },
    { height: 2160, width: 3840 },
  ])("keeps the $width x $height viewport center on grid lines", (viewport) => {
    const cellSize = resolveAuraSelectionGridCellSize(viewport);

    expect(viewport.width / 2 / cellSize.width).toBeCloseTo(
      Math.round(viewport.width / 2 / cellSize.width),
    );
    expect(viewport.height / 2 / cellSize.height).toBeCloseTo(
      Math.round(viewport.height / 2 / cellSize.height),
    );
    expect(cellSize.width).toBeGreaterThanOrEqual(28);
    expect(cellSize.width).toBeLessThanOrEqual(36);
    expect(cellSize.height).toBeGreaterThanOrEqual(28);
    expect(cellSize.height).toBeLessThanOrEqual(36);
  });

  it("chooses the closer even grid count and normalizes invalid dimensions", () => {
    expect(
      resolveAuraSelectionGridCellSize({ height: 100, width: 100 }),
    ).toEqual({ height: 25, width: 25 });
    expect(
      resolveAuraSelectionGridCellSize({ height: Number.NaN, width: 0 }),
    ).toEqual({ height: 32, width: 32 });
  });
});
