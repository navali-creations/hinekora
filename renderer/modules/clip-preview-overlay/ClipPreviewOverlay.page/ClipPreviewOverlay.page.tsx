import { useEffect } from "react";

import { ClipPreviewOverlayContent } from "../ClipPreviewOverlay.components/ClipPreviewOverlayContent/ClipPreviewOverlayContent";
import { ClipPreviewOverlayWorkflowProvider } from "../ClipPreviewOverlay.components/ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider";

const clipPreviewRouteClassName = "is-clip-preview-route";

function ClipPreviewOverlayPage() {
  useEffect(() => {
    document.documentElement.classList.add(clipPreviewRouteClassName);
    document.body.classList.add(clipPreviewRouteClassName);

    return () => {
      document.documentElement.classList.remove(clipPreviewRouteClassName);
      document.body.classList.remove(clipPreviewRouteClassName);
    };
  }, []);

  return (
    <ClipPreviewOverlayWorkflowProvider>
      <ClipPreviewOverlayContent />
    </ClipPreviewOverlayWorkflowProvider>
  );
}

export { ClipPreviewOverlayPage };
