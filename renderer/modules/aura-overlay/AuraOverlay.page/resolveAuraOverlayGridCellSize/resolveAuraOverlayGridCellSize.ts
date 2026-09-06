import type { AuraSize, AuraVideoSize } from "../AuraOverlay.page.utils.types";

const preferredAuraOverlayGridCellSize = 32;

function resolveAuraOverlayGridCellSize(viewport: AuraVideoSize): AuraSize {
  const width = normalizeAuraOverlayGridDimension(viewport.width);
  const height = normalizeAuraOverlayGridDimension(viewport.height);

  return {
    width: width / resolveAuraOverlayGridCellCount(width),
    height: height / resolveAuraOverlayGridCellCount(height),
  };
}

function resolveAuraOverlayGridCellCount(dimension: number): number {
  const approximateCount = dimension / preferredAuraOverlayGridCellSize;
  const lowerEvenCount = Math.max(2, Math.floor(approximateCount / 2) * 2);
  const upperEvenCount = Math.max(2, Math.ceil(approximateCount / 2) * 2);
  const lowerCellSize = dimension / lowerEvenCount;
  const upperCellSize = dimension / upperEvenCount;

  return Math.abs(lowerCellSize - preferredAuraOverlayGridCellSize) <=
    Math.abs(upperCellSize - preferredAuraOverlayGridCellSize)
    ? lowerEvenCount
    : upperEvenCount;
}

function normalizeAuraOverlayGridDimension(dimension: number): number {
  return Number.isFinite(dimension) && dimension > 0
    ? dimension
    : preferredAuraOverlayGridCellSize * 2;
}

export { resolveAuraOverlayGridCellSize };
