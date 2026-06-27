import type { PointerEventHandler } from "react";

import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";

interface AuraArcThicknessHandleProps {
  controlXPercent: number;
  controlYPercent: number;
  placementId: string;
  onPointerCancel: PointerEventHandler<HTMLElement>;
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
}

function AuraArcThicknessHandle({
  controlXPercent,
  controlYPercent,
  placementId,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: AuraArcThicknessHandleProps) {
  return (
    <span
      aria-hidden="true"
      className={styles.thicknessHandle}
      data-placement-id={placementId}
      style={{
        left: `${controlXPercent}%`,
        top: `${controlYPercent}%`,
      }}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

export { AuraArcThicknessHandle };
