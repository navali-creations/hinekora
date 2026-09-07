import type { CSSProperties } from "react";

import type { AuraPlacementClipShape } from "~/types";
import type {
  AuraArcBoundaryPaths,
  AuraSize,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import { AuraPlacementShapeFocus } from "../AuraPlacementShapeFocus/AuraPlacementShapeFocus";

interface AuraOverlayPlacementGuidesProps {
  arcBoundaryPaths: AuraArcBoundaryPaths | null;
  clipShape: AuraPlacementClipShape | undefined;
  contentStyle: CSSProperties;
  displaySize: AuraSize;
  showShapeFocus: boolean;
}

function AuraOverlayPlacementGuides({
  arcBoundaryPaths,
  clipShape,
  contentStyle,
  displaySize,
  showShapeFocus,
}: AuraOverlayPlacementGuidesProps) {
  return (
    <>
      {showShapeFocus && clipShape && (
        <AuraPlacementShapeFocus
          clipShape={clipShape}
          contentStyle={contentStyle}
          displaySize={displaySize}
        />
      )}
      {arcBoundaryPaths && (
        <svg
          aria-hidden="true"
          className={styles.arcBoundaryOverlay}
          style={contentStyle}
          viewBox={`0 0 ${displaySize.width} ${displaySize.height}`}
        >
          <path className={styles.arcBoundaryPath} d={arcBoundaryPaths.outer} />
          <path className={styles.arcBoundaryPath} d={arcBoundaryPaths.inner} />
        </svg>
      )}
    </>
  );
}

export { AuraOverlayPlacementGuides };
