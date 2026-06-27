import type { CropSelectorPoint } from "~/renderer/modules/crop-selector-overlay/CropSelectorOverlay.utils/CropSelectorOverlay.utils";
import { createCircularArcCurvePoints } from "~/renderer/modules/crop-selector-overlay/CropSelectorOverlay.utils/CropSelectorOverlay.utils";

import styles from "../../CropSelectorOverlay.page/CropSelectorOverlayPage.module.css";

interface ArcSelectionPreviewProps {
  arcEnd: CropSelectorPoint | null;
  arcStart: CropSelectorPoint | null;
  hoverPoint: CropSelectorPoint | null;
}

function createArcPath(points: CropSelectorPoint[]): string {
  return points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`,
    )
    .join(" ");
}

function createMidpoint(
  start: CropSelectorPoint,
  end: CropSelectorPoint,
): CropSelectorPoint {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function ArcSelectionPreview({
  arcEnd,
  arcStart,
  hoverPoint,
}: ArcSelectionPreviewProps) {
  const arcControlPoint =
    arcStart && arcEnd
      ? (hoverPoint ?? createMidpoint(arcStart, arcEnd))
      : null;
  const arcPreviewPoints =
    arcStart && arcEnd && arcControlPoint
      ? createCircularArcCurvePoints(arcStart, arcEnd, arcControlPoint)
      : [];
  const arcPreviewPath =
    arcPreviewPoints.length > 0 ? createArcPath(arcPreviewPoints) : null;

  return (
    <>
      <svg className={styles.arcOverlay} aria-hidden="true">
        {arcStart && hoverPoint && !arcEnd && (
          <line
            className={styles.arcGuide}
            x1={arcStart.x}
            y1={arcStart.y}
            x2={hoverPoint.x}
            y2={hoverPoint.y}
          />
        )}
        {arcPreviewPath && (
          <path className={styles.arcPreviewPath} d={arcPreviewPath} />
        )}
        {arcPreviewPoints.map((point, index) => (
          <circle
            className={styles.arcPreviewDot}
            cx={point.x}
            cy={point.y}
            key={`${index}-${point.x}-${point.y}`}
            r="1.5"
          />
        ))}
      </svg>
      {arcStart && (
        <span
          className={styles.arcPointLabel}
          style={{ left: `${arcStart.x}px`, top: `${arcStart.y}px` }}
        >
          A
        </span>
      )}
      {arcEnd && (
        <span
          className={styles.arcPointLabel}
          style={{ left: `${arcEnd.x}px`, top: `${arcEnd.y}px` }}
        >
          B
        </span>
      )}
      {arcControlPoint && (
        <span
          className={styles.arcPointLabel}
          style={{
            left: `${arcControlPoint.x}px`,
            top: `${arcControlPoint.y}px`,
          }}
        >
          C
        </span>
      )}
    </>
  );
}

export { ArcSelectionPreview };
