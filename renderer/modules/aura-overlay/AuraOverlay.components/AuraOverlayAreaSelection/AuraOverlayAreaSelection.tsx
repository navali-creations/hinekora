import type {
  CSSProperties,
  MouseEventHandler,
  PointerEventHandler,
} from "react";

import { useAuraOverlayShallow } from "~/renderer/store";

import type { AuraOverlayDragState } from "../AuraOverlayPlacement/AuraOverlayPlacement.utils";
import styles from "./AuraOverlayAreaSelection.module.css";

interface AuraOverlayAreaSelectionProps {
  dragState: AuraOverlayDragState | null;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
}

function AuraOverlayAreaSelection({
  dragState,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: AuraOverlayAreaSelectionProps) {
  const { clearAreaSelection, selection } = useAuraOverlayShallow(
    (auraOverlay) => ({
      clearAreaSelection: auraOverlay.clearAreaSelection,
      selection: auraOverlay.areaSelection,
    }),
  );
  const handleClick: MouseEventHandler<HTMLButtonElement> = () => {
    if (!dragState?.areaSelectionDrag) {
      clearAreaSelection();
    }
  };

  if (!selection) {
    return null;
  }

  const isGroupDrag =
    dragState?.areaSelectionDrag === true &&
    selection.placementIds.includes(dragState.placementId);
  const deltaX = isGroupDrag ? dragState.deltaX : 0;
  const deltaY = isGroupDrag ? dragState.deltaY : 0;
  const boxStyle: CSSProperties = {
    height: `${selection.height}px`,
    left: `${selection.x + deltaX}px`,
    top: `${selection.y + deltaY}px`,
    width: `${selection.width}px`,
  };
  const labelStyle: CSSProperties = {
    left: `min(${selection.x + deltaX}px, calc(100vw - 6rem))`,
    top:
      selection.y + deltaY >= 32
        ? `${selection.y + deltaY}px`
        : `${selection.y + selection.height + deltaY}px`,
    transform:
      selection.y + deltaY >= 32
        ? "translateY(calc(-100% - 6px))"
        : "translateY(6px)",
  };
  return (
    <>
      <button
        aria-label={`${selection.placementIds.length} ${
          selection.placementIds.length === 1 ? "aura" : "auras"
        } selected`}
        className={styles.selectionBox}
        data-aura-area-selection
        data-placement-id={selection.placementIds[0]}
        style={boxStyle}
        type="button"
        onClick={handleClick}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <span className={styles.selectionLabel} style={labelStyle}>
        {`${selection.placementIds.length} selected`}
      </span>
    </>
  );
}

export { AuraOverlayAreaSelection };
