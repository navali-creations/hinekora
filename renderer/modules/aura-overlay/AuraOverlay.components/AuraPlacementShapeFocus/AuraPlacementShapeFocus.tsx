import type { CSSProperties } from "react";

import type { AuraPlacementClipShape } from "~/types";
import type { AuraSize } from "../../AuraOverlay.page/AuraOverlay.page.utils";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import { createAuraPlacementClipShapePolygonPoints } from "../AuraOverlayPlacement/AuraOverlayPlacement.utils";

interface AuraPlacementShapeFocusProps {
  clipShape: AuraPlacementClipShape;
  contentStyle: CSSProperties;
  displaySize: AuraSize;
}

function AuraPlacementShapeFocus({
  clipShape,
  contentStyle,
  displaySize,
}: AuraPlacementShapeFocusProps) {
  const polygonPoints = createAuraPlacementClipShapePolygonPoints(
    clipShape,
    displaySize,
  );

  return (
    <svg
      aria-hidden="true"
      className={styles.placementShapeFocus}
      data-aura-shape-focus={clipShape}
      style={contentStyle}
      viewBox={`0 0 ${displaySize.width} ${displaySize.height}`}
    >
      {clipShape === "circle" ? (
        <ellipse
          className={styles.placementShapeFocusGeometry}
          cx={displaySize.width / 2}
          cy={displaySize.height / 2}
          rx={displaySize.width / 2}
          ry={displaySize.height / 2}
        />
      ) : (
        <polygon
          className={styles.placementShapeFocusGeometry}
          points={polygonPoints ?? ""}
        />
      )}
    </svg>
  );
}

export { AuraPlacementShapeFocus };
