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

export type { AuraSelectionTypeHelp };
export {
  auraSelectionShapes,
  auraSelectionTypeHelpByShape,
  getAuraSelectionTypeHelp,
};
