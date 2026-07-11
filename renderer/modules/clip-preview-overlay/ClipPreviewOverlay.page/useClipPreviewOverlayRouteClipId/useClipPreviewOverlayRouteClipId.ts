import { useEffect, useState } from "react";

import { resolveClipPreviewRouteClipId } from "./useClipPreviewOverlayRouteClipId.utils";

function useClipPreviewOverlayRouteClipId(): string | null {
  const [clipId, setClipId] = useState(() =>
    resolveClipPreviewRouteClipId(window.location.hash),
  );

  useEffect(() => {
    const handleHashChange = () => {
      setClipId(resolveClipPreviewRouteClipId(window.location.hash));
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return clipId;
}

export { useClipPreviewOverlayRouteClipId };
