import type { RefObject } from "react";
import { useEffect } from "react";

import { writeClipPreviewDiagnostic } from "../useClipPreviewOverlayDiagnostics/useClipPreviewOverlayDiagnostics.utils";

function useClipPreviewOverlayDocumentDiagnostics(input: {
  clipIdRef: RefObject<string | null>;
  enabled: boolean;
}): void {
  useEffect(() => {
    if (!input.enabled) {
      return;
    }

    const logDocumentState = (reason: string) => {
      writeClipPreviewDiagnostic("document-state", {
        clipId: input.clipIdRef.current,
        focused: document.hasFocus(),
        reason,
        visibilityState: document.visibilityState,
      });
    };
    const handleVisibilityChange = () => logDocumentState("visibilitychange");
    const handleFocus = () => logDocumentState("focus");
    const handleBlur = () => logDocumentState("blur");

    writeClipPreviewDiagnostic("overlay-mounted", {
      focused: document.hasFocus(),
      visibilityState: document.visibilityState,
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      writeClipPreviewDiagnostic("overlay-unmounted", {
        clipId: input.clipIdRef.current,
      });
    };
  }, [input.clipIdRef, input.enabled]);
}

export { useClipPreviewOverlayDocumentDiagnostics };
