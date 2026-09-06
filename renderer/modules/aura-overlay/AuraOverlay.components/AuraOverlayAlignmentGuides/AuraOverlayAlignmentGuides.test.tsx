import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  showCenterGuides: false,
}));

vi.mock("~/renderer/store", () => ({
  useSettingsSelector: (selector: unknown) =>
    (selector as (settings: unknown) => unknown)({
      value: { auraOverlayShowCenterGuides: storeMocks.showCenterGuides },
    }),
}));

import type { AuraOverlayDragState } from "../AuraOverlayPlacement/AuraOverlayPlacement.utils";
import { AuraOverlayAlignmentGuides } from "./AuraOverlayAlignmentGuides";

describe("AuraOverlayAlignmentGuides", () => {
  beforeEach(() => {
    storeMocks.showCenterGuides = false;
  });

  it("stays hidden when center lines and peer alignment guides are absent", () => {
    expect(
      renderToStaticMarkup(<AuraOverlayAlignmentGuides dragState={null} />),
    ).toBe("");
  });

  it("shows the center cross and active peer-aura alignment guides", () => {
    storeMocks.showCenterGuides = true;
    const dragState: AuraOverlayDragState = {
      deltaX: 0,
      deltaY: 0,
      initialDisplayX: 30,
      initialDisplayY: 40,
      isReleased: false,
      placementId: "placement-1",
      snapContext: null,
      snapGuideX: { anchor: "center", kind: "placement", position: 250 },
      snapGuideY: {
        anchor: "center",
        kind: "viewport-center",
        position: 380,
      },
      startX: 30,
      startY: 40,
    };
    const html = renderToStaticMarkup(
      <AuraOverlayAlignmentGuides dragState={dragState} />,
    );

    expect(html).toContain('data-aura-center-guide="x"');
    expect(html).toContain('data-aura-center-guide="y"');
    expect(html).toContain('data-aura-alignment-guide="x"');
    expect(html).toContain("left:250px");
    expect(html).not.toContain('data-aura-alignment-guide="y"');
  });

  it("shows a horizontal peer-aura alignment guide", () => {
    const dragState = {
      deltaX: 0,
      deltaY: 0,
      initialDisplayX: 30,
      initialDisplayY: 40,
      isReleased: false,
      placementId: "placement-1",
      snapContext: null,
      snapGuideX: null,
      snapGuideY: {
        anchor: "start" as const,
        kind: "placement" as const,
        position: 240,
      },
      startX: 30,
      startY: 40,
    };
    const html = renderToStaticMarkup(
      <AuraOverlayAlignmentGuides dragState={dragState} />,
    );

    expect(html).toContain('data-aura-alignment-guide="y"');
    expect(html).toContain("top:240px");
    expect(html).not.toContain("data-aura-center-guide");
  });
});
