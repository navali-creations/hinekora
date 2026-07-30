import type { ChangeEvent } from "react";
import { useCallback } from "react";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import { useClipPreviewOverlayCopyOperation } from "../useClipPreviewOverlayCopyOperation/useClipPreviewOverlayCopyOperation";
import type { ClipPreviewOverlayDetail } from "../useClipPreviewOverlayDetail/useClipPreviewOverlayDetail";
import { useClipPreviewOverlaySaveOperation } from "../useClipPreviewOverlaySaveOperation/useClipPreviewOverlaySaveOperation";
import { resolveClipPreviewOperationState } from "./useClipPreviewOverlayOperations.utils";

function useClipPreviewOverlayOperations(
  { clip, durationSeconds, fileTitle }: ClipPreviewOverlayDetail,
  mediaLifecycle: {
    prepareForFileMutation: () => void;
    reloadAfterFileMutation: () => void;
  },
) {
  const {
    hasSavedClip,
    applyPlaybackRateToExport,
    isCopying,
    isMuted,
    isSaving,
    operationProgress,
    playbackRate,
    saveMessage,
    setHasSavedClip,
    setSaveMessage,
    setTitleDraft,
    titleDraft,
    trim,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    applyPlaybackRateToExport: clipPreviewOverlay.applyPlaybackRateToExport,
    hasSavedClip: clipPreviewOverlay.hasSavedClip,
    isCopying: clipPreviewOverlay.isCopying,
    isMuted: clipPreviewOverlay.isMuted,
    isSaving: clipPreviewOverlay.isSaving,
    operationProgress: clipPreviewOverlay.operationProgress,
    playbackRate: clipPreviewOverlay.playbackRate,
    saveMessage: clipPreviewOverlay.saveMessage,
    setHasSavedClip: clipPreviewOverlay.setHasSavedClip,
    setSaveMessage: clipPreviewOverlay.setSaveMessage,
    setTitleDraft: clipPreviewOverlay.setTitleDraft,
    titleDraft: clipPreviewOverlay.titleDraft,
    trim: clipPreviewOverlay.trim,
  }));
  const exportPlaybackRate =
    applyPlaybackRateToExport && playbackRate !== 1 ? playbackRate : undefined;
  const {
    canCopy,
    canEdit,
    canOpenSavedClip,
    canSave,
    canUseClip,
    hasTitleChange,
    hasTrimChanges,
    isProcessing,
    titlePlaceholder,
    trimmedTitle,
  } = resolveClipPreviewOperationState({
    clip,
    durationSeconds,
    fileTitle,
    hasSavedClip,
    isCopying,
    isMuted,
    isSaving,
    titleDraft,
    trim,
    ...(exportPlaybackRate ? { playbackRate: exportPlaybackRate } : {}),
  });
  const { handleCopyClip, hasCopied, resetCopiedState } =
    useClipPreviewOverlayCopyOperation({
      canCopy,
      clip,
      hasTrimChanges,
      isMuted,
      ...(exportPlaybackRate ? { playbackRate: exportPlaybackRate } : {}),
      trim,
    });
  const { handleSaveClip } = useClipPreviewOverlaySaveOperation({
    canSave,
    clip,
    durationSeconds,
    hasTitleChange,
    hasTrimChanges,
    isMuted,
    ...(exportPlaybackRate ? { playbackRate: exportPlaybackRate } : {}),
    prepareForFileMutation: mediaLifecycle.prepareForFileMutation,
    reloadAfterFileMutation: mediaLifecycle.reloadAfterFileMutation,
    resetCopiedState,
    trim,
    trimmedTitle,
  });

  const handleClose = useCallback(() => {
    void window.electron.overlayWindows.hideClipPreview();
  }, []);

  const handleEditClip = useCallback(() => {
    if (!clip || !canEdit) {
      return;
    }

    void window.electron.mainWindow
      .openEditorClip(clip.id, {
        ...(trimmedTitle.length > 0 ? { title: trimmedTitle } : {}),
        trim: {
          inSeconds: trim.inSeconds,
          outSeconds: trim.outSeconds,
        },
      })
      .then(async () => {
        await window.electron.overlayWindows.hideClipPreview();
      })
      .catch((error: unknown) => {
        console.warn("[clip-preview] Could not open clip in editor", {
          clipId: clip.id,
          error,
        });
      });
  }, [canEdit, clip, trim.inSeconds, trim.outSeconds, trimmedTitle]);

  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (isProcessing) {
        return;
      }

      setTitleDraft(event.currentTarget.value.replace(/\.mp4$/i, ""));
      setHasSavedClip(false);
      resetCopiedState();
      setSaveMessage(null);
    },
    [
      isProcessing,
      resetCopiedState,
      setHasSavedClip,
      setSaveMessage,
      setTitleDraft,
    ],
  );

  const handleOpenSavedClip = useCallback(() => {
    if (!clip || !canOpenSavedClip) {
      return;
    }

    void window.electron.mainWindow
      .openClip(clip.id)
      .then(async () => {
        await window.electron.overlayWindows.hideClipPreview();
      })
      .catch((error: unknown) => {
        console.warn("[clip-preview] Could not open saved clip in clips view", {
          clipId: clip.id,
          error,
        });
      });
  }, [canOpenSavedClip, clip]);

  return {
    canCopy,
    canEdit,
    canOpenSavedClip,
    canSave,
    canUseClip,
    handleClose,
    handleCopyClip,
    handleEditClip,
    handleOpenSavedClip,
    handleSaveClip,
    handleTitleChange,
    hasCopied,
    isCopying,
    isProcessing,
    isSaving,
    operationProgress,
    saveMessage,
    titleDraft,
    titlePlaceholder,
    trim,
  };
}

export { useClipPreviewOverlayOperations };
