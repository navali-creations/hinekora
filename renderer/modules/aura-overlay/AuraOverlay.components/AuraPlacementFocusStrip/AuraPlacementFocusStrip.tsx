import clsx from "clsx";
import { type MouseEvent, useMemo } from "react";

import type { CropRegion, OverlayPlacement } from "~/types";
import styles from "./AuraPlacementFocusStrip.module.css";

interface AuraPlacementFocusStripProps {
  cropRegions: CropRegion[];
  placements: OverlayPlacement[];
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
}

function AuraPlacementFocusStrip({
  cropRegions,
  placements,
  selectedPlacementId,
  onSelectPlacement,
}: AuraPlacementFocusStripProps) {
  const cropLabelById = useMemo(
    () => new Map(cropRegions.map((crop) => [crop.id, crop.label])),
    [cropRegions],
  );

  const handlePlacementClick = (event: MouseEvent<HTMLButtonElement>) => {
    const placementId = event.currentTarget.dataset.placementId;
    if (placementId) {
      onSelectPlacement(placementId);
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
