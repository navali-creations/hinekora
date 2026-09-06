import { useEffect, useMemo, useState } from "react";

import { resolveAuraSelectionGridCellSize } from "~/renderer/modules/aura-selection/AuraSelection.utils/AuraSelection.utils";

import type { AuraVideoSize } from "../../AuraOverlay.page/AuraOverlay.page.utils";

function useAuraOverlayEditingGeometry(fallbackViewport: AuraVideoSize): {
  gridCellSize: AuraVideoSize;
  viewport: AuraVideoSize;
} {
  const { height: fallbackHeight, width: fallbackWidth } = fallbackViewport;
  const [viewport, setViewport] = useState(() =>
    readAuraOverlayEditingViewport(fallbackHeight, fallbackWidth),
  );

  useEffect(() => {
    const handleResize = () => {
      const nextViewport = readAuraOverlayEditingViewport(
        fallbackHeight,
        fallbackWidth,
      );
      setViewport((currentViewport) =>
        currentViewport.width === nextViewport.width &&
        currentViewport.height === nextViewport.height
          ? currentViewport
          : nextViewport,
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [fallbackHeight, fallbackWidth]);

  const gridCellSize = useMemo(
    () => resolveAuraSelectionGridCellSize(viewport),
    [viewport],
  );

  return { gridCellSize, viewport };
}

function readAuraOverlayEditingViewport(
  fallbackHeight: number,
  fallbackWidth: number,
): AuraVideoSize {
  return {
    height: window.innerHeight || fallbackHeight,
    width: window.innerWidth || fallbackWidth,
  };
}

export { useAuraOverlayEditingGeometry };
