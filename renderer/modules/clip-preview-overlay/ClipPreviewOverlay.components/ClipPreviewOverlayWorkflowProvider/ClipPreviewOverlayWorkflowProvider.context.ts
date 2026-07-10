import { createContext, useContext } from "react";

import type { ClipPreviewOverlayMediaWorkflow } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayMediaWorkflow/useClipPreviewOverlayMediaWorkflow";
import type { ClipPreviewOverlayWorkflow } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayWorkflow/useClipPreviewOverlayWorkflow";

type ClipPreviewOverlayControlsWorkflow = Pick<
  ClipPreviewOverlayWorkflow,
  | "canCopy"
  | "canOpenSavedClip"
  | "canEdit"
  | "canSave"
  | "handleClose"
  | "handleCopyClip"
  | "handleEditClip"
  | "handleOpenSavedClipInEditor"
  | "handleSaveClip"
  | "handleTitleChange"
  | "hasCopied"
  | "isCopying"
  | "isProcessing"
  | "isSaving"
  | "operationProgress"
  | "saveMessage"
  | "subtitle"
  | "title"
  | "titleDraft"
  | "titlePlaceholder"
>;

const ClipPreviewOverlayControlsContext =
  createContext<ClipPreviewOverlayControlsWorkflow | null>(null);
const ClipPreviewOverlayMediaContext =
  createContext<ClipPreviewOverlayMediaWorkflow | null>(null);

function useClipPreviewOverlayControlsContext() {
  const workflow = useContext(ClipPreviewOverlayControlsContext);
  if (!workflow) {
    throw new Error(
      "useClipPreviewOverlayControlsContext must be used inside ClipPreviewOverlayWorkflowProvider",
    );
  }

  return workflow;
}

function useClipPreviewOverlayMediaContext() {
  const workflow = useContext(ClipPreviewOverlayMediaContext);
  if (!workflow) {
    throw new Error(
      "useClipPreviewOverlayMediaContext must be used inside ClipPreviewOverlayWorkflowProvider",
    );
  }

  return workflow;
}

export type { ClipPreviewOverlayControlsWorkflow };
export {
  ClipPreviewOverlayControlsContext,
  ClipPreviewOverlayMediaContext,
  useClipPreviewOverlayControlsContext,
  useClipPreviewOverlayMediaContext,
};
