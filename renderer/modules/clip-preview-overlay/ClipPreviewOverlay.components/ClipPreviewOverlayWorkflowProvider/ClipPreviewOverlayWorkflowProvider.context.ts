import { createContext, useContext } from "react";

import type { ClipPreviewOverlayMediaWorkflow } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayMediaWorkflow/useClipPreviewOverlayMediaWorkflow";
import type { ClipPreviewOverlayWorkflow } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayWorkflow/useClipPreviewOverlayWorkflow";

type ClipPreviewOverlayControlsCommands = Pick<
  ClipPreviewOverlayWorkflow,
  | "handleClose"
  | "handleCopyClip"
  | "handleEditClip"
  | "handleOpenSavedClip"
  | "handleSaveClip"
  | "handleTitleChange"
>;

type ClipPreviewOverlayMediaCommands = Pick<
  ClipPreviewOverlayMediaWorkflow,
  | "handleCanPlay"
  | "handleCanPlayThrough"
  | "handleEnterFullscreen"
  | "handleLoadedData"
  | "handleLoadedMetadata"
  | "handleLoadStart"
  | "handlePause"
  | "handlePlay"
  | "handleRevealClip"
  | "handleRetryMedia"
  | "handleSeeked"
  | "handleSeeking"
  | "handleTimeUpdate"
  | "handleToggleMuted"
  | "handleTogglePlayback"
  | "handleTrimCommit"
  | "handleTrimPreview"
  | "handleVideoError"
  | "prepareForFileMutation"
  | "reloadAfterFileMutation"
  | "seekPreview"
  | "setPlaybackTimeElement"
  | "setPlayheadElement"
  | "videoRef"
>;

const ClipPreviewOverlayControlsContext =
  createContext<ClipPreviewOverlayControlsCommands | null>(null);
const ClipPreviewOverlayMediaContext =
  createContext<ClipPreviewOverlayMediaCommands | null>(null);

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

export type {
  ClipPreviewOverlayControlsCommands,
  ClipPreviewOverlayMediaCommands,
};
export {
  ClipPreviewOverlayControlsContext,
  ClipPreviewOverlayMediaContext,
  useClipPreviewOverlayControlsContext,
  useClipPreviewOverlayMediaContext,
};
