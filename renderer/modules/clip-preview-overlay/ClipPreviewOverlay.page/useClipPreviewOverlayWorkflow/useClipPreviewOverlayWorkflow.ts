import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { trackEvent } from "~/renderer/modules/umami";
import { useClipPreviewOverlayShallow } from "~/renderer/store";

import {
  getClipPreviewFileTitle,
  resolveClipPreviewDetail,
  resolveClipPreviewRouteClipId,
  roundClipPreviewSeconds,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

function useClipPreviewOverlayWorkflow() {
  const copiedTimeoutRef = useRef<number | null>(null);
  const initializedClipIdRef = useRef<string | null>(null);
  const operationRequestRef = useRef<string | null>(null);
  const clipId = useMemo(
    () => resolveClipPreviewRouteClipId(window.location.hash),
    [],
  );
  const {
    detail,
    detailError,
    isMuted,
    durationOverrideSeconds,
    hasCopied,
    hasSavedClip,
    incrementMediaVersion,
    isCopying,
    isSaving,
    operationProgress,
    reset,
    resetLoadedClipState,
    saveMessage,
    setCopied,
    setHasSavedClip,
    setCopying,
    setDetail,
    setDetailError,
    setDurationOverrideSeconds,
    setOperationProgress,
    setSaveMessage,
    setSaving,
    setTitleDraft,
    titleDraft,
    trim,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    detail: clipPreviewOverlay.detail,
    detailError: clipPreviewOverlay.detailError,
    isMuted: clipPreviewOverlay.isMuted,
    durationOverrideSeconds: clipPreviewOverlay.durationOverrideSeconds,
    hasCopied: clipPreviewOverlay.hasCopied,
    hasSavedClip: clipPreviewOverlay.hasSavedClip,
    incrementMediaVersion: clipPreviewOverlay.incrementMediaVersion,
    isCopying: clipPreviewOverlay.isCopying,
    isSaving: clipPreviewOverlay.isSaving,
    operationProgress: clipPreviewOverlay.operationProgress,
    reset: clipPreviewOverlay.reset,
    resetLoadedClipState: clipPreviewOverlay.resetLoadedClipState,
    saveMessage: clipPreviewOverlay.saveMessage,
    setCopied: clipPreviewOverlay.setCopied,
    setHasSavedClip: clipPreviewOverlay.setHasSavedClip,
    setCopying: clipPreviewOverlay.setCopying,
    setDetail: clipPreviewOverlay.setDetail,
    setDetailError: clipPreviewOverlay.setDetailError,
    setDurationOverrideSeconds: clipPreviewOverlay.setDurationOverrideSeconds,
    setOperationProgress: clipPreviewOverlay.setOperationProgress,
    setSaveMessage: clipPreviewOverlay.setSaveMessage,
    setSaving: clipPreviewOverlay.setSaving,
    setTitleDraft: clipPreviewOverlay.setTitleDraft,
    titleDraft: clipPreviewOverlay.titleDraft,
    trim: clipPreviewOverlay.trim,
  }));
  const { clip, clipFileName, durationSeconds } = resolveClipPreviewDetail(
    detail,
    durationOverrideSeconds,
  );
  const fileTitle = useMemo(
    () => getClipPreviewFileTitle(clipFileName),
    [clipFileName],
  );
  const isClipReady = clip?.hasMediaFile === true;
  let title = "Loading Replay";
  let subtitle = detailError || "Waiting for clip metadata";
  if (clip) {
    if (clip.status === "failed") {
      title = "Replay Failed";
      subtitle = clip.error ?? "Replay save failed";
    } else {
      title = isClipReady ? "Replay Ready" : "Preparing Replay";
      subtitle = isClipReady
        ? `${clip.sourceGame.toUpperCase()} - ${new Date(clip.createdAt).toLocaleTimeString()}`
        : "Saving replay file";
    }
  }
  const hasTrimChanges =
    durationSeconds > 0 &&
    (Math.abs(trim.inSeconds) > 0.001 ||
      Math.abs(trim.outSeconds - durationSeconds) > 0.001);
  const trimmedTitle = titleDraft.trim();
  const hasTitleChange =
    trimmedTitle.length > 0 && trimmedTitle !== fileTitle.trim();
  const hasChanges = hasTrimChanges || hasTitleChange;
  const canUseClip = Boolean(clip?.hasMediaFile && durationSeconds > 0);
  const isProcessing = isCopying || isSaving;
  const canCopy = Boolean(clip?.hasMediaFile) && !isProcessing;
  const canEdit = canUseClip && !isProcessing;
  const canSave = canUseClip && hasChanges && !isProcessing;
  const canOpenSavedClip = Boolean(clip) && hasSavedClip && !isProcessing;

  const resetCopiedState = useCallback(() => {
    if (copiedTimeoutRef.current !== null) {
      clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    }
    setCopied(false);
  }, [setCopied]);

  useEffect(() => {
    reset();

    if (!clipId) {
      return;
    }

    let isActive = true;
    const loadClipDetail = () =>
      window.electron.replayClips
        .get(clipId)
        .then((nextDetail) => {
          if (isActive) {
            setDetail(nextDetail);
            setDetailError(null);
          }
        })
        .catch((error: unknown) => {
          if (isActive) {
            setDetailError(
              error instanceof Error ? error.message : "Clip metadata failed",
            );
          }
        });

    void loadClipDetail();
    const unsubscribeStatus = window.electron.replayClips.onStatusChanged(
      (nextClip) => {
        if (nextClip.id !== clipId || !isActive) {
          return;
        }

        if (nextClip.hasMediaFile) {
          void loadClipDetail();
          return;
        }

        setDetail({
          clip: nextClip,
          durationSeconds: nextClip.durationSeconds,
          mediaUrl: null,
        });
        setDetailError(null);
      },
    );

    return () => {
      isActive = false;
      unsubscribeStatus();
    };
  }, [clipId, reset, setDetail, setDetailError]);

  useEffect(
    () => () => {
      if (copiedTimeoutRef.current !== null) {
        clearTimeout(copiedTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !clip?.id ||
      durationSeconds <= 0 ||
      initializedClipIdRef.current === clip.id
    ) {
      return;
    }

    initializedClipIdRef.current = clip.id;
    setHasSavedClip(false);
    resetLoadedClipState({
      inSeconds: 0,
      outSeconds: roundClipPreviewSeconds(durationSeconds),
    });
    resetCopiedState();
  }, [
    clip?.id,
    durationSeconds,
    resetCopiedState,
    resetLoadedClipState,
    setHasSavedClip,
  ]);

  const handleClose = useCallback(() => {
    trackEvent("clip-preview-overlay-closed");
    void window.electron.overlayWindows.hideClipPreview();
  }, []);

  const handleEditClip = useCallback(() => {
    if (!clip || !canEdit) {
      return;
    }

    void window.electron.mainWindow
      .openEditorClip(clip.id, {
        ...(trimmedTitle.length > 0 ? { title: trimmedTitle } : {}),
        ...(durationSeconds > 0
          ? {
              trim: {
                inSeconds: trim.inSeconds,
                outSeconds: trim.outSeconds,
              },
            }
          : {}),
      })
      .then(async () => {
        trackEvent("clip-preview-overlay-edit-opened");
        await window.electron.overlayWindows.hideClipPreview();
      })
      .catch((error: unknown) => {
        console.warn("[clip-preview] Could not open clip in editor", {
          clipId: clip.id,
          error,
        });
      });
  }, [
    canEdit,
    clip,
    durationSeconds,
    trim.inSeconds,
    trim.outSeconds,
    trimmedTitle,
  ]);

  const handleCopyClip = useCallback(() => {
    if (!clip || !canCopy) {
      return;
    }

    setCopying(true);
    setOperationProgress(0.02);
    resetCopiedState();
    setSaveMessage(null);
    const requestId = globalThis.crypto.randomUUID();
    operationRequestRef.current = requestId;
    const unsubscribeProgress = window.electron.replayClips.onOperationProgress(
      ({ operationRequestId, progress }) => {
        if (operationRequestId !== requestId) {
          return;
        }

        setOperationProgress(Math.min(Math.max(progress, 0), 0.98));
      },
    );
    void window.electron.replayClips
      .copy({
        id: clip.id,
        operationRequestId: requestId,
        ...(isMuted ? { muteAudio: true } : {}),
        ...(hasTrimChanges
          ? {
              trim: {
                inSeconds: trim.inSeconds,
                outSeconds: trim.outSeconds,
              },
            }
          : {}),
      })
      .then((result) => {
        if (operationRequestRef.current !== requestId) {
          return;
        }

        if (result.ok) {
          trackEvent("clip-copied");
          setOperationProgress(1);
          setCopied(true);
          copiedTimeoutRef.current = window.setTimeout(() => {
            setCopied(false);
            copiedTimeoutRef.current = null;
          }, 3_000);
          return;
        }

        setSaveMessage({
          text: result.error ?? "Could not copy clip.",
          tone: "error",
        });
      })
      .catch((error: unknown) => {
        if (operationRequestRef.current !== requestId) {
          return;
        }

        setSaveMessage({
          text: error instanceof Error ? error.message : "Could not copy clip.",
          tone: "error",
        });
      })
      .finally(() => {
        unsubscribeProgress();
        if (operationRequestRef.current === requestId) {
          operationRequestRef.current = null;
          setCopying(false);
        }
      });
  }, [
    canCopy,
    clip,
    isMuted,
    hasTrimChanges,
    resetCopiedState,
    setCopied,
    setCopying,
    setOperationProgress,
    setSaveMessage,
    trim.inSeconds,
    trim.outSeconds,
  ]);

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

  const handleSaveClip = useCallback(() => {
    if (!clip || !canSave) {
      return;
    }

    setSaving(true);
    setOperationProgress(0.02);
    setSaveMessage(null);
    const requestId = globalThis.crypto.randomUUID();
    operationRequestRef.current = requestId;
    const unsubscribeProgress = window.electron.replayClips.onOperationProgress(
      ({ operationRequestId, progress }) => {
        if (operationRequestId !== requestId) {
          return;
        }

        setOperationProgress(Math.min(Math.max(progress, 0), 0.98));
      },
    );
    void window.electron.replayClips
      .update({
        id: clip.id,
        operationRequestId: requestId,
        ...(isMuted ? { muteAudio: true } : {}),
        ...(hasTitleChange ? { name: trimmedTitle } : {}),
        ...(hasTrimChanges
          ? {
              trim: {
                inSeconds: trim.inSeconds,
                outSeconds: trim.outSeconds,
              },
            }
          : {}),
      })
      .then((result) => {
        if (operationRequestRef.current !== requestId) {
          return;
        }

        if (!result.ok || !result.detail) {
          setSaveMessage({
            text: result.error ?? "Could not save clip.",
            tone: "error",
          });
          return;
        }

        const nextDurationSeconds = roundClipPreviewSeconds(
          result.detail.durationSeconds ?? durationSeconds,
        );
        trackEvent("clip-updated");
        setOperationProgress(1);
        setHasSavedClip(true);
        setDetail(result.detail);
        setDurationOverrideSeconds(result.detail.durationSeconds);
        incrementMediaVersion();
        resetCopiedState();
        resetLoadedClipState({ inSeconds: 0, outSeconds: nextDurationSeconds });
        setSaveMessage({ text: "Clip saved.", tone: "success" });
      })
      .catch((error: unknown) => {
        if (operationRequestRef.current !== requestId) {
          return;
        }

        setSaveMessage({
          text: error instanceof Error ? error.message : "Could not save clip.",
          tone: "error",
        });
      })
      .finally(() => {
        unsubscribeProgress();
        if (operationRequestRef.current === requestId) {
          operationRequestRef.current = null;
          setSaving(false);
        }
      });
  }, [
    canSave,
    clip,
    isMuted,
    durationSeconds,
    hasTitleChange,
    hasTrimChanges,
    incrementMediaVersion,
    resetCopiedState,
    resetLoadedClipState,
    setDetail,
    setDurationOverrideSeconds,
    setHasSavedClip,
    setOperationProgress,
    setSaveMessage,
    setSaving,
    trim.inSeconds,
    trim.outSeconds,
    trimmedTitle,
  ]);

  const handleOpenSavedClipInEditor = useCallback(() => {
    if (!clip || !canOpenSavedClip) {
      return;
    }

    void window.electron.mainWindow
      .openClip(clip.id)
      .then(async () => {
        trackEvent("clip-preview-overlay-edit-saved-opened");
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
    canOpenSavedClip,
    canEdit,
    canSave,
    canUseClip,
    handleClose,
    handleCopyClip,
    handleEditClip,
    handleOpenSavedClipInEditor,
    handleSaveClip,
    handleTitleChange,
    hasCopied,
    isCopying,
    isProcessing,
    isSaving,
    operationProgress,
    saveMessage,
    subtitle,
    title,
    titleDraft,
    titlePlaceholder: fileTitle || "2026-07-08 01-18-40",
    trim,
  };
}

type ClipPreviewOverlayWorkflow = ReturnType<
  typeof useClipPreviewOverlayWorkflow
>;

export type { ClipPreviewOverlayWorkflow };
export { useClipPreviewOverlayWorkflow };
