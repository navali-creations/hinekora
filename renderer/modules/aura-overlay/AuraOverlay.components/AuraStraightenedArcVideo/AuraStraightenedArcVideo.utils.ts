import type { CropRegion } from "~/types";
import {
  type AuraPoint,
  type AuraSize,
  type AuraVideoSize,
  createAuraArcCurvePoints,
  projectAuraCropRegion,
  resolveAuraArcSourceThickness,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

interface CreateStraightenedArcVideoGeometryInput {
  crop: CropRegion;
  displaySize: AuraSize;
  referenceViewport: AuraVideoSize | null;
  videoSize: AuraVideoSize;
  visibleThickness: number;
}

interface DrawStraightenedArcVideoFrameInput {
  canvas: HTMLCanvasElement;
  geometry: StraightenedArcVideoGeometry;
  video: HTMLVideoElement;
}

interface SampledArcPoint extends AuraPoint {
  length: number;
}

interface StraightenedArcVideoSegment {
  destinationCenterX: number;
  destinationCenterY: number;
  normal: AuraPoint;
  point: AuraPoint;
  tangent: AuraPoint;
  x: number;
}

interface StraightenedArcVideoGeometry {
  height: number;
  normalScale: number;
  segmentWidth: number;
  segments: StraightenedArcVideoSegment[];
  tangentScale: number;
  targetThickness: number;
  targetY: number;
  width: number;
}

const maxSegmentCount = 48;
const straightenedArcMaxFps = 24;
const straightenedArcFrameIntervalMs = 1_000 / straightenedArcMaxFps;

function createStraightenedArcVideoGeometry({
  crop,
  displaySize,
  referenceViewport,
  videoSize,
  visibleThickness,
}: CreateStraightenedArcVideoGeometryInput): StraightenedArcVideoGeometry | null {
  if (crop.shape !== "arc" || !crop.arc) {
    return null;
  }

  const width = Math.max(1, Math.round(displaySize.width));
  const height = Math.max(1, Math.round(displaySize.height));
  const arcPoints = createProjectedArcPoints(
    crop,
    videoSize,
    referenceViewport,
  );
  const sampledPoints = createSampledArcPoints(arcPoints);
  const totalLength = sampledPoints.at(-1)?.length ?? 0;
  if (sampledPoints.length < 2 || totalLength <= 0) {
    return null;
  }

  const targetThickness = clamp(Math.round(visibleThickness), 1, height);
  const targetY = (height - targetThickness) / 2;
  const segmentCount = clamp(Math.ceil(width / 18), 10, maxSegmentCount);
  const segmentWidth = width / segmentCount;
  const sourceThickness = createProjectedSourceThickness(
    crop,
    displaySize,
    videoSize,
    referenceViewport,
    targetThickness,
  );
  const tangentScale = width / totalLength;
  const normalScale = targetThickness / sourceThickness;
  const segments = Array.from({ length: segmentCount }, (_, index) => {
    const x = index * segmentWidth;
    const point = interpolateSampledArcPoint(
      sampledPoints,
      ((index + 0.5) / segmentCount) * totalLength,
    );
    const tangent = createTangentAtLength(sampledPoints, point.length);
    const normal = { x: -tangent.y, y: tangent.x };

    return {
      destinationCenterX: x + segmentWidth / 2,
      destinationCenterY: targetY + targetThickness / 2,
      normal,
      point,
      tangent,
      x,
    };
  });

  return {
    height,
    normalScale,
    segmentWidth,
    segments,
    tangentScale,
    targetThickness,
    targetY,
    width,
  };
}

function drawStraightenedArcVideoFrame({
  canvas,
  geometry,
  video,
}: DrawStraightenedArcVideoFrameInput): void {
  const context = canvas.getContext("2d");
  if (!context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  if (canvas.width !== geometry.width) {
    canvas.width = geometry.width;
  }
  if (canvas.height !== geometry.height) {
    canvas.height = geometry.height;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, geometry.width, geometry.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "medium";

  for (const segment of geometry.segments) {
    context.save();
    context.beginPath();
    context.rect(
      segment.x,
      geometry.targetY,
      geometry.segmentWidth + 1,
      geometry.targetThickness,
    );
    context.clip();
    context.setTransform(
      geometry.tangentScale * segment.tangent.x,
      geometry.normalScale * segment.normal.x,
      geometry.tangentScale * segment.tangent.y,
      geometry.normalScale * segment.normal.y,
      segment.destinationCenterX -
        geometry.tangentScale *
          (segment.tangent.x * segment.point.x +
            segment.tangent.y * segment.point.y),
      segment.destinationCenterY -
        geometry.normalScale *
          (segment.normal.x * segment.point.x +
            segment.normal.y * segment.point.y),
    );
    context.drawImage(video, 0, 0);
    context.restore();
  }
}

function shouldDrawStraightenedArcFrame(
  nowMs: number,
  lastDrawMs: number | null,
): boolean {
  return (
    lastDrawMs === null || nowMs - lastDrawMs >= straightenedArcFrameIntervalMs
  );
}

function createProjectedArcPoints(
  crop: CropRegion,
  videoSize: AuraVideoSize,
  referenceViewport: AuraVideoSize | null,
): AuraPoint[] {
  const projectedCrop = projectAuraCropRegion(
    crop,
    videoSize,
    referenceViewport,
  );

  return createAuraArcCurvePoints(crop).map((point) => ({
    x: projectedCrop.x + (point.x / crop.width) * projectedCrop.width,
    y: projectedCrop.y + (point.y / crop.height) * projectedCrop.height,
  }));
}

function createSampledArcPoints(points: AuraPoint[]): SampledArcPoint[] {
  let length = 0;

  return points.map((point, index) => {
    const previous = points[index - 1];
    if (previous) {
      length += Math.hypot(point.x - previous.x, point.y - previous.y);
    }

    return { ...point, length };
  });
}

function interpolateSampledArcPoint(
  points: SampledArcPoint[],
  targetLength: number,
): SampledArcPoint {
  const { next, previous } = resolveSamplePair(points, targetLength);
  const lengthDelta = next.length - previous.length;
  const progress =
    lengthDelta > 0 ? (targetLength - previous.length) / lengthDelta : 0;

  return {
    x: previous.x + (next.x - previous.x) * progress,
    y: previous.y + (next.y - previous.y) * progress,
    length: targetLength,
  };
}

function createTangentAtLength(
  points: SampledArcPoint[],
  targetLength: number,
): AuraPoint {
  const { next, previous } = resolveSamplePair(points, targetLength);
  const tangent = normalizePoint({
    x: next.x - previous.x,
    y: next.y - previous.y,
  });

  return tangent.x === 0 && tangent.y === 0 ? { x: 1, y: 0 } : tangent;
}

function resolveSamplePair(
  points: SampledArcPoint[],
  targetLength: number,
): { next: SampledArcPoint; previous: SampledArcPoint } {
  const fallback = points[0];
  const fallbackNext = points[1] ?? fallback;
  if (!fallback || !fallbackNext) {
    return {
      next: { length: 0, x: 1, y: 0 },
      previous: { length: 0, x: 0, y: 0 },
    };
  }

  const nextIndex = points.findIndex((point) => point.length >= targetLength);
  const index =
    nextIndex >= 1 ? nextIndex : nextIndex === 0 ? 1 : points.length - 1;
  const next = points[index] ?? fallbackNext;
  const previous = points[index - 1] ?? fallback;

  return { next, previous };
}

function createProjectedSourceThickness(
  crop: CropRegion,
  displaySize: AuraSize,
  videoSize: AuraVideoSize,
  referenceViewport: AuraVideoSize | null,
  targetThickness: number,
): number {
  const projectedCrop = projectAuraCropRegion(
    crop,
    videoSize,
    referenceViewport,
  );
  const sourceThickness = resolveAuraArcSourceThickness(
    crop,
    displaySize,
    targetThickness,
  );
  const sourceScale = Math.min(
    projectedCrop.width / crop.width,
    projectedCrop.height / crop.height,
  );

  return Math.max(1, sourceThickness * sourceScale);
}

function normalizePoint(point: AuraPoint): AuraPoint {
  const length = Math.hypot(point.x, point.y);
  if (length <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: point.x / length,
    y: point.y / length,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export {
  createStraightenedArcVideoGeometry,
  drawStraightenedArcVideoFrame,
  shouldDrawStraightenedArcFrame,
};
