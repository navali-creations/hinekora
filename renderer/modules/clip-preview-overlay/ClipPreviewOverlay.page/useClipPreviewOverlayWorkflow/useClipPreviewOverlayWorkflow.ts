import type { ChangeEvent, SyntheticEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ReplayClipDetail } from "~/main/modules/replay-clips";
import { trackEvent } from "~/renderer/modules/umami";
import { useReplayClipsShallow } from "~/renderer/store";

import {
  type ClipPreviewTrimRange,
  clampClipPreviewPlaybackSeconds,
  createClipPreviewMediaUrl,
  getClipPreviewFileTitle,
  resolveClipPreviewRouteClipId,
  roundClipPreviewSeconds,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

const initialTrimRange: ClipPreviewTrimRange = {
  inSeconds: 0,
  outSeconds: 0.1,
};

function useClipPreviewOverlayWorkflow() {
  const animationFrameRef = useRef<number | null>(null);
  const copiedTimeoutRef = useRef<number | null>(null);
  const hasUserAdjustedTrimRef = useRef(false);
  const initializedClipIdRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { activeClip, copyClip, items, openClip, revealClip, updateClip } =
    useReplayClipsShallow((replayClips) => ({
      activeClip: replayClips.activeClip,
      copyClip: replayClips.copyClip,
      items: replayClips.items,
      openClip: replayClips.openClip,
      revealClip: replayClips.revealClip,
      updateClip: replayClips.updateClip,
    }));
  const clipId = useMemo(
    () => resolveClipPreviewRouteClipId(window.location.hash),
    [],
  );
  const [detail, setDetail] = useState<ReplayClipDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [durationOverrideSeconds, setDurationOverrideSeconds] = useState<
    number | null
  >(null);
  const [hasCopied, setCopied] = useState(false);
  const [isCopying, setCopying] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [mediaVersion, setMediaVersion] = useState(0);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [saveMessage, setSaveMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [trim, setTrim] = useState<ClipPreviewTrimRange>(initialTrimRange);
  const fallbackClip =
    items.find((item) => item.id === clipId) ??
    (activeClip?.id === clipId ? activeClip : null);
  const clip = detail?.clip ?? fallbackClip;
  const clipPath = clip?.processedClipPath ?? clip?.originalObsPath ?? null;
  const baseVideoSrc = useMemo(
    () => (clip?.id && clipPath ? createClipPreviewMediaUrl(clip.id) : null),
    [clip?.id, clipPath],
  );
  const videoSrc = baseVideoSrc ? `${baseVideoSrc}?v=${mediaVersion}` : null;
  const fileTitle = useMemo(
    () => getClipPreviewFileTitle(clipPath),
    [clipPath],
  );
  const durationSeconds = Math.max(
    0,
    detail?.durationSeconds ??
      durationOverrideSeconds ??
      clip?.durationSeconds ??
      clip?.targetDurationSeconds ??
      0,
  );
  const title = clip ? "Replay Ready" : "Loading Replay";
  const subtitle = clip
    ? `${clip.sourceGame.toUpperCase()} - ${new Date(clip.createdAt).toLocaleTimeString()}`
    : detailError || "Waiting for clip metadata";
  const hasTrimChanges =
    durationSeconds > 0 &&
    (Math.abs(trim.inSeconds) > 0.001 ||
      Math.abs(trim.outSeconds - durationSeconds) > 0.001);
  const trimmedTitle = titleDraft.trim();
  const hasTitleChange =
    trimmedTitle.length > 0 && trimmedTitle !== fileTitle.trim();
  const hasChanges = hasTrimChanges || hasTitleChange;
  const canUseClip = Boolean(clip && clipPath && durationSeconds > 0);
  const canCopy = Boolean(clip && clipPath) && !isCopying;
  const canSave = canUseClip && hasChanges && !isSaving;

  const resetCopiedState = useCallback(() => {
    if (copiedTimeoutRef.current !== null) {
      clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    }
    setCopied(false);
  }, []);

  useEffect(() => {
    if (!clipId) {
      return;
    }

    let isActive = true;
    setDetail(null);
    setDetailError(null);
    window.electron.replayClips
      .get(clipId)
      .then((nextDetail) => {
        if (isActive) {
          setDetail(nextDetail);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setDetailError(
            error instanceof Error ? error.message : "Clip metadata failed",
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [clipId]);

  useEffect(
    () => () => {
      if (copiedTimeoutRef.current !== null) {
        clearTimeout(copiedTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const updatePlaybackTime = () => {
      const video = videoRef.current;
      if (!video) {
        animationFrameRef.current = null;
        return;
      }

      if (video.currentTime >= trim.outSeconds) {
        video.pause();
        video.currentTime = trim.inSeconds;
        setPlaybackSeconds(trim.inSeconds);
        setPlaying(false);
        animationFrameRef.current = null;
        return;
      }

      setPlaybackSeconds(roundClipPreviewSeconds(video.currentTime));
      animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
    };

    animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, trim.inSeconds, trim.outSeconds]);

  useEffect(() => {
    if (
      !clip?.id ||
      durationSeconds <= 0 ||
      initializedClipIdRef.current === clip.id
    ) {
      return;
    }

    initializedClipIdRef.current = clip.id;
    setTrim({
      inSeconds: 0,
      outSeconds: roundClipPreviewSeconds(durationSeconds),
    });
    hasUserAdjustedTrimRef.current = false;
    setPlaybackSeconds(0);
    resetCopiedState();
    setTitleDraft("");
    setSaveMessage(null);
  }, [clip?.id, durationSeconds, resetCopiedState]);

  const handleClose = () => {
    trackEvent("clip-preview-overlay-closed");
    void window.electron.overlayWindows.hideClipPreview();
  };

  const handleOpenClip = () => {
    if (clip) {
      void openClip(clip.id);
    }
  };

  const handleEditClip = () => {
    if (!clip) {
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
  };

  const handleRevealClip = () => {
    if (clip) {
      void revealClip(clip.id);
    }
  };

  const handleCopyClip = () => {
    if (!clip || !canCopy) {
      return;
    }

    setCopying(true);
    resetCopiedState();
    setSaveMessage(null);
    void copyClip({
      id: clip.id,
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
        if (result.ok) {
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
        setSaveMessage({
          text: error instanceof Error ? error.message : "Could not copy clip.",
          tone: "error",
        });
      })
      .finally(() => {
        setCopying(false);
      });
  };

  const handleVideoError = (event: SyntheticEvent<HTMLVideoElement>) => {
    const mediaError = event.currentTarget.error;
    console.warn("[clip-preview] Replay video failed to load", {
      clipId: clip?.id ?? null,
      code: mediaError?.code ?? null,
      message: mediaError?.message ?? null,
      src: videoSrc,
    });
  };

  const seekPreview = (seconds: number) => {
    const nextSeconds = clampClipPreviewPlaybackSeconds(
      seconds,
      durationSeconds,
    );
    const video = videoRef.current;
    if (video) {
      video.currentTime = nextSeconds;
    }
    setPlaybackSeconds(nextSeconds);
  };

  const handleTogglePlayback = () => {
    const video = videoRef.current;
    if (!video || !canUseClip) {
      return;
    }

    if (!video.paused) {
      video.pause();
      setPlaying(false);
      return;
    }

    if (
      video.currentTime < trim.inSeconds ||
      video.currentTime >= trim.outSeconds
    ) {
      video.currentTime = trim.inSeconds;
      setPlaybackSeconds(trim.inSeconds);
    }
    void video.play().catch((error: unknown) => {
      console.warn("[clip-preview] Could not play preview", { error });
      setPlaying(false);
    });
  };

  const handleToggleMuted = () => {
    setMuted((currentMuted) => {
      const nextMuted = !currentMuted;
      if (videoRef.current) {
        videoRef.current.muted = nextMuted;
      }
      return nextMuted;
    });
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      return;
    }

    const nextDurationSeconds = roundClipPreviewSeconds(video.duration);
    setDurationOverrideSeconds(nextDurationSeconds);
    if (!hasUserAdjustedTrimRef.current) {
      setTrim({ inSeconds: 0, outSeconds: nextDurationSeconds });
    }
  };

  const handlePause = () => {
    setPlaying(false);
    const video = videoRef.current;
    if (video) {
      setPlaybackSeconds(roundClipPreviewSeconds(video.currentTime));
    }
  };

  const handlePlay = () => {
    setPlaying(true);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!isPlaying && video.currentTime >= trim.outSeconds) {
      video.pause();
      video.currentTime = trim.inSeconds;
      setPlaybackSeconds(trim.inSeconds);
      setPlaying(false);
      return;
    }

    if (!isPlaying) {
      setPlaybackSeconds(roundClipPreviewSeconds(video.currentTime));
    }
  };

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitleDraft(event.currentTarget.value.replace(/\.mp4$/i, ""));
    resetCopiedState();
    setSaveMessage(null);
  };

  const handleTrimChange = (nextTrim: ClipPreviewTrimRange) => {
    hasUserAdjustedTrimRef.current = true;
    resetCopiedState();
    setTrim(nextTrim);
    setSaveMessage(null);
    if (
      playbackSeconds < nextTrim.inSeconds ||
      playbackSeconds > nextTrim.outSeconds
    ) {
      seekPreview(nextTrim.inSeconds);
    }
  };

  const handleSaveClip = () => {
    if (!clip || !canSave) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    void updateClip({
      id: clip.id,
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
        setDetail(result.detail);
        setDurationOverrideSeconds(result.detail.durationSeconds);
        setMediaVersion((version) => version + 1);
        hasUserAdjustedTrimRef.current = false;
        resetCopiedState();
        setPlaybackSeconds(0);
        setTitleDraft("");
        setTrim({ inSeconds: 0, outSeconds: nextDurationSeconds });
        setSaveMessage({ text: "Clip saved.", tone: "success" });
      })
      .catch((error: unknown) => {
        setSaveMessage({
          text: error instanceof Error ? error.message : "Could not save clip.",
          tone: "error",
        });
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return {
    canCopy,
    canSave,
    canUseClip,
    clip,
    clipPath,
    durationSeconds,
    handleClose,
    handleCopyClip,
    handleEditClip,
    handleLoadedMetadata,
    handleOpenClip,
    handlePause,
    handlePlay,
    handleRevealClip,
    handleSaveClip,
    handleTimeUpdate,
    handleTitleChange,
    handleToggleMuted,
    handleTogglePlayback,
    handleTrimChange,
    handleVideoError,
    hasCopied,
    isCopying,
    isMuted,
    isPlaying,
    isSaving,
    playbackSeconds,
    saveMessage,
    seekPreview,
    subtitle,
    title,
    titleDraft,
    titlePlaceholder: fileTitle || "2026-07-08 01-18-40",
    trim,
    videoRef,
    videoSrc,
  };
}

export { useClipPreviewOverlayWorkflow };
