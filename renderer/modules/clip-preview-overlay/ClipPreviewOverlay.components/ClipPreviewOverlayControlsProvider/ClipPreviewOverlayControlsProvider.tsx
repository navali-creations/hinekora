import { type ReactNode, useMemo } from "react";

import { useClipPreviewOverlayWorkflow } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayWorkflow/useClipPreviewOverlayWorkflow";
import {
  type ClipPreviewOverlayControlsCommands,
  ClipPreviewOverlayControlsContext,
  useClipPreviewOverlayMediaContext,
} from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider.context";

interface ClipPreviewOverlayControlsProviderProps {
  children: ReactNode;
}

function ClipPreviewOverlayControlsProvider({
  children,
}: ClipPreviewOverlayControlsProviderProps) {
  const mediaWorkflow = useClipPreviewOverlayMediaContext();
  const workflow = useClipPreviewOverlayWorkflow({
    prepareForFileMutation: mediaWorkflow.prepareForFileMutation,
    reloadAfterFileMutation: mediaWorkflow.reloadAfterFileMutation,
  });
  const controlsCommands = useMemo<ClipPreviewOverlayControlsCommands>(
    () => ({
      handleClose: workflow.handleClose,
      handleCopyClip: workflow.handleCopyClip,
      handleEditClip: workflow.handleEditClip,
      handleOpenSavedClip: workflow.handleOpenSavedClip,
      handleSaveClip: workflow.handleSaveClip,
      handleTitleChange: workflow.handleTitleChange,
    }),
    [
      workflow.handleClose,
      workflow.handleCopyClip,
      workflow.handleEditClip,
      workflow.handleOpenSavedClip,
      workflow.handleSaveClip,
      workflow.handleTitleChange,
    ],
  );

  return (
    <ClipPreviewOverlayControlsContext.Provider value={controlsCommands}>
      {children}
    </ClipPreviewOverlayControlsContext.Provider>
  );
}

export { ClipPreviewOverlayControlsProvider };
