import { type ReactNode, useMemo } from "react";

import { useClipPreviewOverlayWorkflow } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayWorkflow/useClipPreviewOverlayWorkflow";
import {
  type ClipPreviewOverlayControlsCommands,
  ClipPreviewOverlayControlsContext,
} from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider.context";

interface ClipPreviewOverlayControlsProviderProps {
  children: ReactNode;
}

function ClipPreviewOverlayControlsProvider({
  children,
}: ClipPreviewOverlayControlsProviderProps) {
  const workflow = useClipPreviewOverlayWorkflow();
  const controlsCommands = useMemo<ClipPreviewOverlayControlsCommands>(
    () => ({
      handleClose: workflow.handleClose,
      handleCopyClip: workflow.handleCopyClip,
      handleEditClip: workflow.handleEditClip,
      handleOpenSavedClipInEditor: workflow.handleOpenSavedClipInEditor,
      handleSaveClip: workflow.handleSaveClip,
      handleTitleChange: workflow.handleTitleChange,
    }),
    [
      workflow.handleClose,
      workflow.handleCopyClip,
      workflow.handleEditClip,
      workflow.handleOpenSavedClipInEditor,
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
