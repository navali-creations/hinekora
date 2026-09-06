import type { IconType } from "react-icons";
import { PiBezierCurve, PiSelection } from "react-icons/pi";
import { TbRouteSquare2 } from "react-icons/tb";

import type { CropRegionSelectionShape } from "~/main/modules/overlay-windows/OverlayWindows.dto";

interface AuraSelectionTypeHelp {
  Icon: IconType;
  iconClassName?: string;
  name: string;
  overlayText: string;
  selectorText: string;
}

interface AuraSelectionGridSize {
  height: number;
  width: number;
}

const preferredAuraSelectionGridCellSize = 32;

const auraSelectionTypeHelpByShape = {
  arc: {
    Icon: PiBezierCurve,
    iconClassName: "rotate-90",
    name: "Arched aura",
    overlayText:
      "Curved selection for energy shield, spirit, rage, and other arc-shaped meters.",
    selectorText:
      "Click A and B for the arc ends, then click C to bend the curve around energy shield, spirit, or rage.",
  },
  points: {
    Icon: TbRouteSquare2,
    name: "Pointer aura",
    overlayText:
      "Connected-point selection for narrow angled indicators such as ward.",
    selectorText:
      "Click connected points along a narrow indicator, then press Enter. Useful for ward and angled line-shaped resources.",
  },
  rect: {
    Icon: PiSelection,
    name: "Default aura",
    overlayText:
      "Rectangular selection for action bar cooldowns, skills near the mana globe, charms, or vertical globe resource pools.",
    selectorText:
      "Drag a rectangle around cooldowns, skills near the mana globe, charms, or vertical globe resource pools.",
  },
} satisfies Record<CropRegionSelectionShape, AuraSelectionTypeHelp>;

const auraSelectionShapes = ["rect", "arc", "points"] as const;

function getAuraSelectionTypeHelp(
  shape: CropRegionSelectionShape,
): AuraSelectionTypeHelp {
  return auraSelectionTypeHelpByShape[shape];
}

function resolveAuraSelectionGridCellSize(
  viewport: AuraSelectionGridSize,
): AuraSelectionGridSize {
  const width = normalizeAuraSelectionGridDimension(viewport.width);
  const height = normalizeAuraSelectionGridDimension(viewport.height);

  return {
    width: width / resolveAuraSelectionGridCellCount(width),
    height: height / resolveAuraSelectionGridCellCount(height),
  };
}

function resolveAuraSelectionGridCellCount(dimension: number): number {
  const approximateCount = dimension / preferredAuraSelectionGridCellSize;
  const lowerEvenCount = Math.max(2, Math.floor(approximateCount / 2) * 2);
  const upperEvenCount = Math.max(2, Math.ceil(approximateCount / 2) * 2);
  const lowerCellSize = dimension / lowerEvenCount;
  const upperCellSize = dimension / upperEvenCount;

  return Math.abs(lowerCellSize - preferredAuraSelectionGridCellSize) <=
    Math.abs(upperCellSize - preferredAuraSelectionGridCellSize)
    ? lowerEvenCount
    : upperEvenCount;
}

function normalizeAuraSelectionGridDimension(dimension: number): number {
  return Number.isFinite(dimension) && dimension > 0
    ? dimension
    : preferredAuraSelectionGridCellSize * 2;
}

export type { AuraSelectionTypeHelp };
export {
  auraSelectionShapes,
  auraSelectionTypeHelpByShape,
  getAuraSelectionTypeHelp,
  resolveAuraSelectionGridCellSize,
};
