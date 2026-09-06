import clsx from "clsx";
import { type MouseEvent, useMemo } from "react";

import { useAuraOverlayShallow } from "~/renderer/store";

import type { CropRegion, OverlayPlacement } from "~/types";
import styles from "./AuraPlacementFocusStrip.module.css";

interface AuraPlacementFocusStripProps {
  cropRegions: CropRegion[];
  placements: OverlayPlacement[];
}

function AuraPlacementFocusStrip({
  cropRegions,
  placements,
}: AuraPlacementFocusStripProps) {
  const { selectPlacement, selectedPlacementId } = useAuraOverlayShallow(
    (auraOverlay) => ({
      selectPlacement: auraOverlay.selectPlacement,
      selectedPlacementId: auraOverlay.selectedPlacementId,
    }),
  );
  const cropLabelById = useMemo(
    () => new Map(cropRegions.map((crop) => [crop.id, crop.label])),
    [cropRegions],
  );

  const handlePlacementClick = (event: MouseEvent<HTMLButtonElement>) => {
    const placementId = event.currentTarget.dataset.placementId;
    if (placementId) {
      selectPlacement(placementId);
    }
  };

  if (placements.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Aura placements" className={styles.focusStrip}>
      {placements.map((placement, index) => {
        const label =
          cropLabelById.get(placement.cropRegionId) ?? `Aura ${index + 1}`;

        return (
          <button
            aria-pressed={placement.id === selectedPlacementId}
            className={clsx(
              styles.focusButton,
              placement.id === selectedPlacementId && styles.focusButtonActive,
            )}
            data-placement-id={placement.id}
            key={placement.id}
            title={label}
            type="button"
            onClick={handlePlacementClick}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export { AuraPlacementFocusStrip };
