import { describe, expect, it } from "vitest";

import { getTooltipPosition } from "./TooltipLayer.utils";

const defaults = {
  anchor: {
    left: 140,
    right: 160,
    top: 140,
    bottom: 160,
    width: 20,
    height: 20,
  },
  height: 40,
  placement: "bottom" as const,
  viewportHeight: 300,
  viewportWidth: 400,
  width: 200,
};

describe("getTooltipPosition", () => {
  it.each([
    { placement: "top", left: 50, top: 92 },
    { placement: "bottom", left: 50, top: 168 },
    { placement: "right", left: 168, top: 130 },
  ] as const)(
    "keeps the requested $placement side when there is room",
    ({ placement, left, top }) => {
      expect(getTooltipPosition({ ...defaults, placement })).toEqual({
        left,
        top,
      });
    },
  );

  it("flips a sidebar warning to the right when the left would be outside the window", () => {
    expect(getTooltipPosition({ ...defaults, placement: "left" })).toEqual({
      left: 168,
      top: 130,
    });
  });

  it("shifts help text away from the right edge", () => {
    expect(
      getTooltipPosition({
        ...defaults,
        anchor: { ...defaults.anchor, left: 370, right: 390 },
      }),
    ).toEqual({ left: 192, top: 168 });
  });

  it("flips help above a control at the bottom of the viewport", () => {
    expect(
      getTooltipPosition({
        ...defaults,
        anchor: { ...defaults.anchor, top: 270, bottom: 290 },
      }),
    ).toEqual({ left: 50, top: 222 });
  });

  it("keeps large tooltips within a small viewport when no side fits", () => {
    expect(
      getTooltipPosition({ ...defaults, height: 284, width: 384 }),
    ).toEqual({ left: 8, top: 8 });
  });
});
