import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  type AuraPlacementPropertiesPanelBounds,
  resolveAuraPlacementPropertiesPanelLayout,
} from "../../AuraOverlay.components/AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel.utils";
import type { AuraSize } from "../../AuraOverlay.page/AuraOverlay.page.utils";

type PropertiesPanelStyle = CSSProperties & {
  "--aura-properties-panel-viewport-max-height"?: string;
};

interface UseAuraPlacementPropertiesPanelLayoutResult {
  panelRef: RefObject<HTMLDetailsElement | null>;
  panelStyle: PropertiesPanelStyle;
}

interface AuraPlacementPropertiesPanelMeasurements {
  panel: AuraSize;
  viewport: AuraSize;
}

function useAuraPlacementPropertiesPanelLayout(
  anchorBounds: AuraPlacementPropertiesPanelBounds,
): UseAuraPlacementPropertiesPanelLayoutResult {
  const panelRef = useRef<HTMLDetailsElement>(null);
  const [measurements, setMeasurements] =
    useState<AuraPlacementPropertiesPanelMeasurements | null>(null);

  const updateMeasurements = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const nextMeasurements = {
      panel: { height: panelRect.height, width: panelRect.width },
      viewport: { height: window.innerHeight, width: window.innerWidth },
    };
    setMeasurements((currentMeasurements) =>
      currentMeasurements?.panel.height === nextMeasurements.panel.height &&
      currentMeasurements.panel.width === nextMeasurements.panel.width &&
      currentMeasurements.viewport.height ===
        nextMeasurements.viewport.height &&
      currentMeasurements.viewport.width === nextMeasurements.viewport.width
        ? currentMeasurements
        : nextMeasurements,
    );
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    updateMeasurements();
    window.addEventListener("resize", updateMeasurements);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateMeasurements);
    resizeObserver?.observe(panel);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateMeasurements);
    };
  }, [updateMeasurements]);

  const layout = measurements
    ? resolveAuraPlacementPropertiesPanelLayout(
        anchorBounds,
        measurements.panel,
        measurements.viewport,
      )
    : null;

  const panelStyle: PropertiesPanelStyle = layout
    ? {
        "--aura-properties-panel-viewport-max-height": `${layout.maxHeight}px`,
        left: `${layout.left}px`,
        top: `${layout.top}px`,
      }
    : { visibility: "hidden" };

  return { panelRef, panelStyle };
}

export { useAuraPlacementPropertiesPanelLayout };
