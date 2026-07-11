import type { ReactNode } from "react";

import { ClipPreviewOverlayControlsProvider } from "../ClipPreviewOverlayControlsProvider/ClipPreviewOverlayControlsProvider";
import { ClipPreviewOverlayMediaProvider } from "../ClipPreviewOverlayMediaProvider/ClipPreviewOverlayMediaProvider";
import {
  useClipPreviewOverlayControlsContext,
  useClipPreviewOverlayMediaContext,
} from "./ClipPreviewOverlayWorkflowProvider.context";

interface ClipPreviewOverlayWorkflowProviderProps {
  children: ReactNode;
}

function ClipPreviewOverlayWorkflowProvider({
  children,
}: ClipPreviewOverlayWorkflowProviderProps) {
  return (
    <ClipPreviewOverlayMediaProvider>
      <ClipPreviewOverlayControlsProvider>
        {children}
      </ClipPreviewOverlayControlsProvider>
    </ClipPreviewOverlayMediaProvider>
  );
}

export {
  ClipPreviewOverlayWorkflowProvider,
  useClipPreviewOverlayControlsContext,
  useClipPreviewOverlayMediaContext,
};
