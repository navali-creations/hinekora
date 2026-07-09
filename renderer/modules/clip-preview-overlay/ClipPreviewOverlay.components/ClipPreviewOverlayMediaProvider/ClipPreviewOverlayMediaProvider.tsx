import { type ReactNode, useMemo } from "react";

import {
  type ClipPreviewOverlayMediaWorkflow,
  useClipPreviewOverlayMediaWorkflow,
} from "../../ClipPreviewOverlay.page/useClipPreviewOverlayMediaWorkflow/useClipPreviewOverlayMediaWorkflow";
import { ClipPreviewOverlayMediaContext } from "../ClipPreviewOverlayWorkflowProvider/ClipPreviewOverlayWorkflowProvider.context";

interface ClipPreviewOverlayMediaProviderProps {
  children: ReactNode;
}

function ClipPreviewOverlayMediaProvider({
  children,
}: ClipPreviewOverlayMediaProviderProps) {
  const workflow = useClipPreviewOverlayMediaWorkflow();
  const mediaWorkflow = useMemo<ClipPreviewOverlayMediaWorkflow>(
    () => ({
      canUseClip: workflow.canUseClip,
      clipPath: workflow.clipPath,
      durationSeconds: workflow.durationSeconds,
      handleCanPlay: workflow.handleCanPlay,
      handleCanPlayThrough: workflow.handleCanPlayThrough,
      handleLoadedData: workflow.handleLoadedData,
      handleEnterFullscreen: workflow.handleEnterFullscreen,
      handleLoadedMetadata: workflow.handleLoadedMetadata,
      handleLoadStart: workflow.handleLoadStart,
      handlePause: workflow.handlePause,
      handlePlay: workflow.handlePlay,
      handleRevealClip: workflow.handleRevealClip,
      handleSeeked: workflow.handleSeeked,
      handleSeeking: workflow.handleSeeking,
      handleTimeUpdate: workflow.handleTimeUpdate,
      handleToggleMuted: workflow.handleToggleMuted,
      handleTogglePlayback: workflow.handleTogglePlayback,
      handleWaiting: workflow.handleWaiting,
      handleTrimChange: workflow.handleTrimChange,
      handleVideoError: workflow.handleVideoError,
      isMuted: workflow.isMuted,
      isPlaying: workflow.isPlaying,
      isPreparingClip: workflow.isPreparingClip,
      isProcessing: workflow.isProcessing,
      operationProgress: workflow.operationProgress,
      playbackSeconds: workflow.playbackSeconds,
      seekPreview: workflow.seekPreview,
      setPlaybackTimeElement: workflow.setPlaybackTimeElement,
      setPlayheadElement: workflow.setPlayheadElement,
      trim: workflow.trim,
      videoRef: workflow.videoRef,
      videoSrc: workflow.videoSrc,
    }),
    [
      workflow.canUseClip,
      workflow.clipPath,
      workflow.durationSeconds,
      workflow.handleCanPlay,
      workflow.handleCanPlayThrough,
      workflow.handleLoadedData,
      workflow.handleEnterFullscreen,
      workflow.handleLoadedMetadata,
      workflow.handleLoadStart,
      workflow.handlePause,
      workflow.handlePlay,
      workflow.handleRevealClip,
      workflow.handleSeeked,
      workflow.handleSeeking,
      workflow.handleTimeUpdate,
      workflow.handleToggleMuted,
      workflow.handleTogglePlayback,
      workflow.handleWaiting,
      workflow.handleTrimChange,
      workflow.handleVideoError,
      workflow.isMuted,
      workflow.isPlaying,
      workflow.isPreparingClip,
      workflow.isProcessing,
      workflow.operationProgress,
      workflow.playbackSeconds,
      workflow.seekPreview,
      workflow.setPlaybackTimeElement,
      workflow.setPlayheadElement,
      workflow.trim,
      workflow.videoRef,
      workflow.videoSrc,
    ],
  );

  return (
    <ClipPreviewOverlayMediaContext.Provider value={mediaWorkflow}>
      {children}
    </ClipPreviewOverlayMediaContext.Provider>
  );
}

export { ClipPreviewOverlayMediaProvider };
