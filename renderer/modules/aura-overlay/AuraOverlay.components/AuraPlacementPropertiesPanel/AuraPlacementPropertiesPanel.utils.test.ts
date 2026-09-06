import { describe, expect, it } from "vitest";

import { resolveAuraPlacementPropertiesPanelLayout } from "./AuraPlacementPropertiesPanel.utils";

describe("resolveAuraPlacementPropertiesPanelLayout", () => {
  it("prefers the right side when the measured panel fits", () => {
    expect(
      resolveAuraPlacementPropertiesPanelLayout(
        { height: 60, left: 100, top: 100, width: 60 },
        { height: 200, width: 164 },
        { height: 1080, width: 1920 },
      ),
    ).toEqual({ left: 68, maxHeight: 1064, top: 0 });
  });

  it("uses another side when the preferred side would overflow", () => {
    expect(
      resolveAuraPlacementPropertiesPanelLayout(
        { height: 60, left: 1700, top: 100, width: 60 },
        { height: 200, width: 164 },
        { height: 1080, width: 1920 },
      ),
    ).toEqual({ left: -172, maxHeight: 1064, top: 0 });
  });

  it("clamps a tall panel completely inside a constrained viewport", () => {
    const anchor = { height: 40, left: 80, top: 80, width: 40 };
    const layout = resolveAuraPlacementPropertiesPanelLayout(
      anchor,
      { height: 320, width: 164 },
      { height: 200, width: 200 },
    );

    expect(layout).toEqual({ left: -52, maxHeight: 184, top: -72 });
    expect(anchor.left + layout.left).toBeGreaterThanOrEqual(8);
    expect(anchor.left + layout.left + 164).toBeLessThanOrEqual(192);
    expect(anchor.top + layout.top).toBeGreaterThanOrEqual(8);
    expect(anchor.top + layout.top + layout.maxHeight).toBeLessThanOrEqual(192);
  });
});
