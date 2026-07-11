import { useCallback } from "react";

import type { ReplayClipView } from "~/main/modules/replay-clips";
import { trackEvent } from "~/renderer/modules/umami";
import { useClipPreviewOverlayShallow } from "~/renderer/store";

import {
  type ClipPreviewTrimRange,
  roundClipPreviewSeconds,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayOperation } from "../useClipPreviewOverlayOperation/useClipPreviewOverlayOperation";

function useClipPreviewOverlaySaveOperation(input: {
  canSave: boolean;
  clip: ReplayClipView | null;
  durationSeconds: number;
  hasTitleChange: boolean;
  hasTrimChanges: boolean;
  isMuted: boolean;
  prepareForFileMutation: () => void;
  reloadAfterFileMutation: () => void;
  resetCopiedState: () => void;
  trim: ClipPreviewTrimRange;
  trimmedTitle: string;
}) {
  const {
    resetLoadedClipState,
    setDetail,
    setDurationOverrideSeconds,
    setHasSavedClip,
    setOperationProgress,
    setSaveMessage,
    setSaving,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    resetLoadedClipState: clipPreviewOverlay.resetLoadedClipState,
    setDetail: clipPreviewOverlay.setDetail,
    setDurationOverrideSeconds: clipPreviewOverlay.setDurationOverrideSeconds,
    setHasSavedClip: clipPreviewOverlay.setHasSavedClip,
    setOperationProgress: clipPreviewOverlay.setOperationProgress,
    setSaveMessage: clipPreviewOverlay.setSaveMessage,
    setSaving: clipPreviewOverlay.setSaving,
  }));
  const { runOperation } = useClipPreviewOverlayOperation({
    setActive: setSaving,
    setOperationProgress,
    setSaveMessage,
  });

  const handleSaveClip = useCallback(() => {
    if (!input.clip || !input.canSave) {
      return;
    }

    runOperation({
      execute: (requestId) => {
        input.prepareForFileMutation();
        return window.electron.replayClips.update({
          id: input.clip?.id ?? "",
          operationRequestId: requestId,
          ...(input.isMuted ? { muteAudio: true } : {}),
          ...(input.hasTitleChange ? { name: input.trimmedTitle } : {}),
          ...(input.hasTrimChanges
            ? {
                trim: {
                  inSeconds: input.trim.inSeconds,
                  outSeconds: input.trim.outSeconds,
                },
              }
            : {}),
        });
      },
      fallbackError: "Could not save clip.",
      getResultError: (result) =>
        result.ok && result.detail
          ? null
          : (result.error ?? "Could not save clip."),
      onSuccess: (result) => {
        if (!result.detail) {
          return;
        }
        const nextDurationSeconds = roundClipPreviewSeconds(
          result.detail.durationSeconds ?? input.durationSeconds,
        );
        trackEvent("clip-updated");
        setOperationProgress(1);
        setHasSavedClip(true);
        setDetail(result.detail);
        setDurationOverrideSeconds(result.detail.durationSeconds);
        input.resetCopiedState();
        resetLoadedClipState({ inSeconds: 0, outSeconds: nextDurationSeconds });
        setSaveMessage({ text: "Clip saved.", tone: "success" });
      },
      onSettled: input.reloadAfterFileMutation,
    });
  }, [
    input.canSave,
    input.clip,
    input.durationSeconds,
    input.hasTitleChange,
    input.hasTrimChanges,
    input.isMuted,
    input.prepareForFileMutation,
    input.reloadAfterFileMutation,
    input.resetCopiedState,
    input.trim.inSeconds,
    input.trim.outSeconds,
    input.trimmedTitle,
    resetLoadedClipState,
    runOperation,
    setDetail,
    setDurationOverrideSeconds,
    setHasSavedClip,
    setOperationProgress,
    setSaveMessage,
  ]);

  return { handleSaveClip };
}

export { useClipPreviewOverlaySaveOperation };
