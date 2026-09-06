import { useSettingsSelector } from "~/renderer/store";

import type { AuraOverlayDragState } from "../AuraOverlayPlacement/AuraOverlayPlacement.utils";
import styles from "./AuraOverlayAlignmentGuides.module.css";

interface AuraOverlayAlignmentGuidesProps {
  dragState: AuraOverlayDragState | null;
}

function AuraOverlayAlignmentGuides({
  dragState,
}: AuraOverlayAlignmentGuidesProps) {
  const showCenterGuides = useSettingsSelector(
    (settings) => settings.value?.auraOverlayShowCenterGuides ?? false,
  );
  const alignmentGuideX =
    dragState?.snapGuideX?.kind === "placement"
      ? dragState.snapGuideX.position
      : null;
  const alignmentGuideY =
    dragState?.snapGuideY?.kind === "placement"
      ? dragState.snapGuideY.position
      : null;
  if (
    !showCenterGuides &&
    alignmentGuideX === null &&
    alignmentGuideY === null
  ) {
    return null;
  }

  return (
    <div aria-hidden="true" className={styles.guideLayer}>
      {showCenterGuides && (
        <>
          <span
            className={`${styles.guide} ${styles.verticalGuide} ${styles.centerGuide}`}
            data-aura-center-guide="x"
          />
          <span
            className={`${styles.guide} ${styles.horizontalGuide} ${styles.centerGuide}`}
            data-aura-center-guide="y"
          />
        </>
      )}
      {alignmentGuideX !== null && (
        <span
          className={`${styles.guide} ${styles.verticalGuide} ${styles.alignmentGuide}`}
          data-aura-alignment-guide="x"
          style={{ left: `${alignmentGuideX}px` }}
        />
      )}
      {alignmentGuideY !== null && (
        <span
          className={`${styles.guide} ${styles.horizontalGuide} ${styles.alignmentGuide}`}
          data-aura-alignment-guide="y"
          style={{ top: `${alignmentGuideY}px` }}
        />
      )}
    </div>
  );
}

export { AuraOverlayAlignmentGuides };
