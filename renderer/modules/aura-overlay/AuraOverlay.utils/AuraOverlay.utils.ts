interface ArcGeometryPoint {
  x: number;
  y: number;
}

interface ArcGeometryCircle extends ArcGeometryPoint {
  radius: number;
}

const defaultArcSampleCount = 40;
const collinearPointEpsilon = 0.001;

function createArcCurvePoints(
  start: ArcGeometryPoint,
  end: ArcGeometryPoint,
  control: ArcGeometryPoint,
  sampleCount = defaultArcSampleCount,
): ArcGeometryPoint[] {
  const circle = createCircleFromThreePoints(start, control, end);
  if (!circle) {
    return createQuadraticCurvePoints(start, end, control, sampleCount);
  }

  const startAngle = Math.atan2(start.y - circle.y, start.x - circle.x);
  const endAngle = Math.atan2(end.y - circle.y, end.x - circle.x);
  const controlAngle = Math.atan2(control.y - circle.y, control.x - circle.x);
  const sweepCounterClockwise =
    getCounterClockwiseDelta(startAngle, controlAngle) <=
    getCounterClockwiseDelta(startAngle, endAngle);
  const sweep = sweepCounterClockwise
    ? getCounterClockwiseDelta(startAngle, endAngle)
    : -getCounterClockwiseDelta(endAngle, startAngle);

  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const angle = startAngle + sweep * (index / sampleCount);

    return {
      x: circle.x + Math.cos(angle) * circle.radius,
      y: circle.y + Math.sin(angle) * circle.radius,
    };
  });
}

function createArcControlNormal(
  start: ArcGeometryPoint,
  end: ArcGeometryPoint,
  control: ArcGeometryPoint,
): ArcGeometryPoint {
  const circle = createCircleFromThreePoints(start, control, end);

  if (circle) {
    return normalizeArcGeometryPoint({
      x: control.x - circle.x,
      y: control.y - circle.y,
    });
  }

  const tangent = normalizeArcGeometryPoint({
    x: end.x - start.x,
    y: end.y - start.y,
  });
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const normal = normalizeArcGeometryPoint({ x: -tangent.y, y: tangent.x });
  const controlSide =
    (control.x - midpoint.x) * normal.x + (control.y - midpoint.y) * normal.y;

  return controlSide >= 0
    ? normal
    : {
        x: -normal.x,
        y: -normal.y,
      };
}

function createQuadraticCurvePoints(
  start: ArcGeometryPoint,
  end: ArcGeometryPoint,
  control: ArcGeometryPoint,
  sampleCount: number,
): ArcGeometryPoint[] {
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const t = index / sampleCount;
    const inverseT = 1 - t;

    return {
      x:
        inverseT * inverseT * start.x +
        2 * inverseT * t * control.x +
        t * t * end.x,
      y:
        inverseT * inverseT * start.y +
        2 * inverseT * t * control.y +
        t * t * end.y,
    };
  });
}

function createCircleFromThreePoints(
  first: ArcGeometryPoint,
  second: ArcGeometryPoint,
  third: ArcGeometryPoint,
): ArcGeometryCircle | null {
  const determinant =
    2 *
    (first.x * (second.y - third.y) +
      second.x * (third.y - first.y) +
      third.x * (first.y - second.y));
  if (Math.abs(determinant) < collinearPointEpsilon) {
    return null;
  }

  const firstMagnitude = first.x * first.x + first.y * first.y;
  const secondMagnitude = second.x * second.x + second.y * second.y;
  const thirdMagnitude = third.x * third.x + third.y * third.y;
  const x =
    (firstMagnitude * (second.y - third.y) +
      secondMagnitude * (third.y - first.y) +
      thirdMagnitude * (first.y - second.y)) /
    determinant;
  const y =
    (firstMagnitude * (third.x - second.x) +
      secondMagnitude * (first.x - third.x) +
      thirdMagnitude * (second.x - first.x)) /
    determinant;

  return {
    x,
    y,
    radius: Math.hypot(first.x - x, first.y - y),
  };
}

function getCounterClockwiseDelta(fromAngle: number, toAngle: number): number {
  return (toAngle - fromAngle + Math.PI * 2) % (Math.PI * 2);
}

function normalizeArcGeometryPoint(point: ArcGeometryPoint): ArcGeometryPoint {
  const length = Math.hypot(point.x, point.y);
  if (length <= 0) {
    return { x: 0, y: 1 };
  }

  return {
    x: point.x / length,
    y: point.y / length,
  };
}

export type { ArcGeometryPoint };
export { createArcControlNormal, createArcCurvePoints };
