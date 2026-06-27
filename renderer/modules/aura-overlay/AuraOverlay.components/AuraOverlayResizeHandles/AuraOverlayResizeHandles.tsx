import clsx from "clsx";
import type { PointerEventHandler } from "react";

import {
  type AuraResizeCorner,
  auraResizeCorners,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";

interface AuraOverlayResizeHandlesProps {
  placementId: string;
  onPointerCancel: PointerEventHandler<HTMLElement>;
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
}

const auraResizeCornerClassNames: Record<AuraResizeCorner, string> = {
  nw: styles.resizeHandleNw ?? "",
  ne: styles.resizeHandleNe ?? "",
  sw: styles.resizeHandleSw ?? "",
  se: styles.resizeHandleSe ?? "",
};

function AuraOverlayResizeHandles({
  placementId,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: AuraOverlayResizeHandlesProps) {
  return (
    <>
      {auraResizeCorners.map((corner) => (
        <span
          aria-hidden="true"
          className={clsx(
            styles.resizeHandle,
            auraResizeCornerClassNames[corner],
          )}
          data-corner={corner}
          data-placement-id={placementId}
          key={corner}
          onPointerCancel={onPointerCancel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      ))}
    </>
  );
}

export { AuraOverlayResizeHandles };
