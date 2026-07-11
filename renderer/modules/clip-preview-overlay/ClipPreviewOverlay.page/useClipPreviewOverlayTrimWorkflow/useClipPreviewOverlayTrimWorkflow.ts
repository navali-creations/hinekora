import { useCallback } from "react";

import type { ClipPreviewTrimRange } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

interface ClipPreviewOverlayTrimWorkflowInput {
  getPlaybackSeconds: () => number;
  hasUserAdjustedTrimRef: { current: boolean };
  isProcessing: boolean;
  seekPreview: (seconds: number) => void;
  setCopied: (copied: boolean) => void;
  setHasSavedClip: (hasSavedClip: boolean) => void;
  setSaveMessage: (message: null) => void;
  setTrim: (trim: ClipPreviewTrimRange) => void;
}

function useClipPreviewOverlayTrimWorkflow({
  getPlaybackSeconds,
  hasUserAdjustedTrimRef,
  isProcessing,
  seekPreview,
  setCopied,
  setHasSavedClip,
  setSaveMessage,
  setTrim,
}: ClipPreviewOverlayTrimWorkflowInput) {
  const handleTrimPreview = useCallback(
    (_nextTrim: ClipPreviewTrimRange, options: { previewSeconds: number }) => {
      if (isProcessing) {
        return;
      }

      hasUserAdjustedTrimRef.current = true;
      seekPreview(options.previewSeconds);
    },
    [hasUserAdjustedTrimRef, isProcessing, seekPreview],
  );

  const handleTrimCommit = useCallback(
    (nextTrim: ClipPreviewTrimRange) => {
      if (isProcessing) {
        return;
      }

      hasUserAdjustedTrimRef.current = true;
      setCopied(false);
      setHasSavedClip(false);
      setTrim(nextTrim);
      setSaveMessage(null);
      const currentPlaybackSeconds = getPlaybackSeconds();
      if (currentPlaybackSeconds < nextTrim.inSeconds) {
        seekPreview(nextTrim.inSeconds);
      } else if (currentPlaybackSeconds > nextTrim.outSeconds) {
        seekPreview(nextTrim.outSeconds);
      }
    },
    [
      getPlaybackSeconds,
      hasUserAdjustedTrimRef,
      isProcessing,
      seekPreview,
      setCopied,
      setHasSavedClip,
      setSaveMessage,
      setTrim,
    ],
  );

  return { handleTrimCommit, handleTrimPreview };
}

export { useClipPreviewOverlayTrimWorkflow };
