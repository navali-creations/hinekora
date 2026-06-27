import { describe, expect, it } from "vitest";

import {
  createArcControlNormal,
  createArcCurvePoints,
} from "./AuraOverlay.utils";

describe("AuraOverlay shared arc utils", () => {
  it("creates circular arc points through the control point", () => {
    const points = createArcCurvePoints(
      { x: 100, y: 160 },
      { x: 220, y: 160 },
      { x: 160, y: 100 },
      4,
    );

    expect(points[0]).toEqual({ x: 100, y: 160 });
    expect(points[2]?.x).toBeCloseTo(160);
    expect(points[2]?.y).toBeCloseTo(100);
    expect(points.at(-1)?.x).toBeCloseTo(220);
    expect(points.at(-1)?.y).toBeCloseTo(160);
  });

  it("falls back to quadratic points for collinear arc controls", () => {
    expect(
      createArcCurvePoints({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, 2),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("resolves the control normal toward the selected arc side", () => {
    const normal = createArcControlNormal(
      { x: 100, y: 160 },
      { x: 220, y: 160 },
      { x: 160, y: 100 },
    );

    expect(normal.x).toBeCloseTo(0);
    expect(normal.y).toBeCloseTo(-1);
  });
});
