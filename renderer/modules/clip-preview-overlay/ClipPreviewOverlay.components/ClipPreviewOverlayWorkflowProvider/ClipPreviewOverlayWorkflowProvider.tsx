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
    <ClipPreviewOverlayControlsProvider>
      <ClipPreviewOverlayMediaProvider>
        {children}
      </ClipPreviewOverlayMediaProvider>
    </ClipPreviewOverlayControlsProvider>
  );
}

export {
  ClipPreviewOverlayWorkflowProvider,
  useClipPreviewOverlayControlsContext,
  useClipPreviewOverlayMediaContext,
};
