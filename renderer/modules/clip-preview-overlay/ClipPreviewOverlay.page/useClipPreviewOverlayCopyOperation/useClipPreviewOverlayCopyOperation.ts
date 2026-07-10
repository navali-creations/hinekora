import { useCallback, useEffect, useRef } from "react";

import type { ReplayClipView } from "~/main/modules/replay-clips";
import { trackEvent } from "~/renderer/modules/umami";
import { useClipPreviewOverlayShallow } from "~/renderer/store";

import type { ClipPreviewTrimRange } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayOperation } from "../useClipPreviewOverlayOperation/useClipPreviewOverlayOperation";

function useClipPreviewOverlayCopyOperation(input: {
  canCopy: boolean;
  clip: ReplayClipView | null;
  hasTrimChanges: boolean;
  isMuted: boolean;
  trim: ClipPreviewTrimRange;
}) {
  const copiedTimeoutRef = useRef<number | null>(null);
  const {
    hasCopied,
    setCopied,
    setCopying,
    setOperationProgress,
    setSaveMessage,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    hasCopied: clipPreviewOverlay.hasCopied,
    setCopied: clipPreviewOverlay.setCopied,
    setCopying: clipPreviewOverlay.setCopying,
    setOperationProgress: clipPreviewOverlay.setOperationProgress,
    setSaveMessage: clipPreviewOverlay.setSaveMessage,
  }));
  const { runOperation } = useClipPreviewOverlayOperation({
    setActive: setCopying,
    setOperationProgress,
    setSaveMessage,
  });

  const resetCopiedState = useCallback(() => {
    if (copiedTimeoutRef.current !== null) {
      clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    }
    setCopied(false);
  }, [setCopied]);

  useEffect(
    () => () => {
      if (copiedTimeoutRef.current !== null) {
        clearTimeout(copiedTimeoutRef.current);
      }
    },
    [],
  );

  const handleCopyClip = useCallback(() => {
    if (!input.clip || !input.canCopy) {
      return;
    }

    resetCopiedState();
    runOperation({
      execute: (requestId) =>
        window.electron.replayClips.copy({
          id: input.clip?.id ?? "",
          operationRequestId: requestId,
          ...(input.isMuted ? { muteAudio: true } : {}),
          ...(input.hasTrimChanges
            ? {
                trim: {
                  inSeconds: input.trim.inSeconds,
                  outSeconds: input.trim.outSeconds,
                },
              }
            : {}),
        }),
      fallbackError: "Could not copy clip.",
      onSuccess: () => {
        trackEvent("clip-copied");
        setOperationProgress(1);
        setCopied(true);
        copiedTimeoutRef.current = window.setTimeout(() => {
          setCopied(false);
          copiedTimeoutRef.current = null;
        }, 3_000);
      },
    });
  }, [
    input.canCopy,
    input.clip,
    input.hasTrimChanges,
    input.isMuted,
    input.trim.inSeconds,
    input.trim.outSeconds,
    resetCopiedState,
    runOperation,
    setCopied,
    setOperationProgress,
  ]);

  return { handleCopyClip, hasCopied, resetCopiedState };
}

export { useClipPreviewOverlayCopyOperation };
