import { describe, expect, it } from "vitest";

import { resolveAuraOverlayGridCellSize } from "./resolveAuraOverlayGridCellSize";

describe("AuraOverlay page utilities", () => {
  it.each([
    { height: 1080, width: 1920 },
    { height: 1440, width: 2560 },
    { height: 1440, width: 3440 },
    { height: 2160, width: 3840 },
  ])("keeps the $width x $height viewport center on grid lines", (viewport) => {
    const cellSize = resolveAuraOverlayGridCellSize(viewport);

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
    expect(resolveAuraOverlayGridCellSize({ height: 100, width: 100 })).toEqual(
      { height: 25, width: 25 },
    );
    expect(
      resolveAuraOverlayGridCellSize({ height: Number.NaN, width: 0 }),
    ).toEqual({ height: 32, width: 32 });
  });
});
