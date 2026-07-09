import { type ReactNode, useMemo } from "react";

import { useClipPreviewOverlayWorkflow } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayWorkflow/useClipPreviewOverlayWorkflow";
import {
  ClipPreviewOverlayControlsContext,
  type ClipPreviewOverlayControlsWorkflow,
} from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider.context";

interface ClipPreviewOverlayControlsProviderProps {
  children: ReactNode;
}

function ClipPreviewOverlayControlsProvider({
  children,
}: ClipPreviewOverlayControlsProviderProps) {
  const workflow = useClipPreviewOverlayWorkflow();
  const controlsWorkflow = useMemo<ClipPreviewOverlayControlsWorkflow>(
    () => ({
      canCopy: workflow.canCopy,
      canEdit: workflow.canEdit,
      canSave: workflow.canSave,
      handleClose: workflow.handleClose,
      handleCopyClip: workflow.handleCopyClip,
      handleEditClip: workflow.handleEditClip,
      handleSaveClip: workflow.handleSaveClip,
      handleTitleChange: workflow.handleTitleChange,
      hasCopied: workflow.hasCopied,
      isCopying: workflow.isCopying,
      isProcessing: workflow.isProcessing,
      isSaving: workflow.isSaving,
      operationProgress: workflow.operationProgress,
      saveMessage: workflow.saveMessage,
      subtitle: workflow.subtitle,
      title: workflow.title,
      titleDraft: workflow.titleDraft,
      titlePlaceholder: workflow.titlePlaceholder,
    }),
    [
      workflow.canCopy,
      workflow.canEdit,
      workflow.canSave,
      workflow.handleClose,
      workflow.handleCopyClip,
      workflow.handleEditClip,
      workflow.handleSaveClip,
      workflow.handleTitleChange,
      workflow.hasCopied,
      workflow.isCopying,
      workflow.isProcessing,
      workflow.isSaving,
      workflow.operationProgress,
      workflow.saveMessage,
      workflow.subtitle,
      workflow.title,
      workflow.titleDraft,
      workflow.titlePlaceholder,
    ],
  );

  return (
    <ClipPreviewOverlayControlsContext.Provider value={controlsWorkflow}>
      {children}
    </ClipPreviewOverlayControlsContext.Provider>
  );
}

export { ClipPreviewOverlayControlsProvider };
