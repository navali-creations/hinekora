import type { CropRegion } from "~/types";
import {
  type AuraPoint,
  type AuraSize,
  type AuraVideoSize,
  clamp,
  createAuraArcCurvePoints,
  projectAuraCropRegion,
  resolveAuraArcSourceThickness,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import {
  createPathSampleVideoGeometry,
  drawPathSampleVideoFrame,
  type PathSampleVideoGeometry,
  shouldDrawPathSampleVideoFrame,
} from "../../AuraOverlay.utils/AuraOverlay.utils";

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

type StraightenedArcVideoGeometry = PathSampleVideoGeometry;

const maxSegmentCount = 48;
const minSegmentCount = 10;
const targetSegmentLength = 18;

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
  const targetThickness = clamp(Math.round(visibleThickness), 1, height);
  const sourceThickness = createProjectedSourceThickness(
    crop,
    displaySize,
    videoSize,
    referenceViewport,
    targetThickness,
  );

  return createPathSampleVideoGeometry({
    height,
    maxSegmentCount,
    minSegmentCount,
    outputAxis: "x",
    pathPoints: arcPoints,
    sourceThickness,
    targetOutputSegmentLength: targetSegmentLength,
    targetThickness,
    videoSize,
    width,
  });
}

function drawStraightenedArcVideoFrame({
  canvas,
  geometry,
  video,
}: DrawStraightenedArcVideoFrameInput): void {
  drawPathSampleVideoFrame({ canvas, geometry, video });
}

function shouldDrawStraightenedArcFrame(
  nowMs: number,
  lastDrawMs: number | null,
): boolean {
  return shouldDrawPathSampleVideoFrame(nowMs, lastDrawMs);
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

export {
  createStraightenedArcVideoGeometry,
  drawStraightenedArcVideoFrame,
  shouldDrawStraightenedArcFrame,
};
