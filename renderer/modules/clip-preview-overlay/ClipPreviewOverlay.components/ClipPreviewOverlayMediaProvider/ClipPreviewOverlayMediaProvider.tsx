import { type ReactNode, useMemo } from "react";

import { useClipPreviewOverlayMediaWorkflow } from "../../ClipPreviewOverlay.page/useClipPreviewOverlayMediaWorkflow/useClipPreviewOverlayMediaWorkflow";
import type { ClipPreviewOverlayMediaCommands } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider.context";
import { ClipPreviewOverlayMediaContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider.context";

interface ClipPreviewOverlayMediaProviderProps {
  children: ReactNode;
}

function ClipPreviewOverlayMediaProvider({
  children,
}: ClipPreviewOverlayMediaProviderProps) {
  const workflow = useClipPreviewOverlayMediaWorkflow();
  const mediaCommands = useMemo<ClipPreviewOverlayMediaCommands>(
    () => ({
      handleCanPlay: workflow.handleCanPlay,
      handleCanPlayThrough: workflow.handleCanPlayThrough,
      handleLoadedData: workflow.handleLoadedData,
      handleEnterFullscreen: workflow.handleEnterFullscreen,
      handleLoadedMetadata: workflow.handleLoadedMetadata,
      handleLoadStart: workflow.handleLoadStart,
      handlePause: workflow.handlePause,
      handlePlay: workflow.handlePlay,
      handleRevealClip: workflow.handleRevealClip,
      handleRetryMedia: workflow.handleRetryMedia,
      handleSeeked: workflow.handleSeeked,
      handleSeeking: workflow.handleSeeking,
      handleTimeUpdate: workflow.handleTimeUpdate,
      handleToggleMuted: workflow.handleToggleMuted,
      handleTogglePlayback: workflow.handleTogglePlayback,
      handleTrimCommit: workflow.handleTrimCommit,
      handleTrimPreview: workflow.handleTrimPreview,
      handleVideoError: workflow.handleVideoError,
      prepareForFileMutation: workflow.prepareForFileMutation,
      reloadAfterFileMutation: workflow.reloadAfterFileMutation,
      seekPreview: workflow.seekPreview,
      setPlaybackTimeElement: workflow.setPlaybackTimeElement,
      setPlayheadElement: workflow.setPlayheadElement,
      videoRef: workflow.videoRef,
    }),
    [
      workflow.handleCanPlay,
      workflow.handleCanPlayThrough,
      workflow.handleLoadedData,
      workflow.handleEnterFullscreen,
      workflow.handleLoadedMetadata,
      workflow.handleLoadStart,
      workflow.handlePause,
      workflow.handlePlay,
      workflow.handleRevealClip,
      workflow.handleRetryMedia,
      workflow.handleSeeked,
      workflow.handleSeeking,
      workflow.handleTimeUpdate,
      workflow.handleToggleMuted,
      workflow.handleTogglePlayback,
      workflow.handleTrimCommit,
      workflow.handleTrimPreview,
      workflow.handleVideoError,
      workflow.prepareForFileMutation,
      workflow.reloadAfterFileMutation,
      workflow.seekPreview,
      workflow.setPlaybackTimeElement,
      workflow.setPlayheadElement,
      workflow.videoRef,
    ],
  );

  return (
    <ClipPreviewOverlayMediaContext.Provider value={mediaCommands}>
      {children}
    </ClipPreviewOverlayMediaContext.Provider>
  );
}

export { ClipPreviewOverlayMediaProvider };
