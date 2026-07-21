import { useCallback, useEffect, useRef, useState } from "react";

import type { EditorExportPreviewClip } from "~/main/modules/editor";

import { resolveEditorExportPreviewClipEndSeconds } from "../EditorExportBackgroundPreview.utils";

const clipEndToleranceSeconds = 0.02;

function useEditorExportBackgroundPreview(clips: EditorExportPreviewClip[]) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const advancingClipIdRef = useRef<string | null>(null);
  const isWindowFocusedRef = useRef(document.hasFocus());
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const requestedClipIndex = clips.findIndex(
    (clip) => clip.id === activeClipId,
  );
  const activeClipIndex = Math.max(requestedClipIndex, 0);
  const activeClip = clips[activeClipIndex] ?? null;

  const prepareActiveClip = useCallback(() => {
    const video = videoRef.current;
    if (
      !video ||
      !activeClip ||
      document.visibilityState === "hidden" ||
      !isWindowFocusedRef.current
    ) {
      return;
    }

    video.muted = true;
    video.playbackRate = activeClip.playbackRate;
    video.currentTime = activeClip.inSeconds;
    void video.play().catch(() => undefined);
  }, [activeClip]);

  const advanceClip = useCallback(() => {
    if (!activeClip || advancingClipIdRef.current === activeClip.id) {
      return;
    }

    advancingClipIdRef.current = activeClip.id;
    videoRef.current?.pause();
    const nextClipIndex =
      clips.length > 0 ? (activeClipIndex + 1) % clips.length : 0;
    const nextClip = clips[nextClipIndex] ?? null;
    if (nextClip?.id === activeClip.id) {
      advancingClipIdRef.current = null;
      prepareActiveClip();
      return;
    }

    setActiveClipId(nextClip?.id ?? null);
  }, [activeClip, activeClipIndex, clips, prepareActiveClip]);

  useEffect(() => {
    advancingClipIdRef.current = null;
    prepareActiveClip();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        videoRef.current?.pause();
        return;
      }
      prepareActiveClip();
    };
    const handleWindowBlur = () => {
      isWindowFocusedRef.current = false;
      videoRef.current?.pause();
    };
    const handleWindowFocus = () => {
      isWindowFocusedRef.current = true;
      prepareActiveClip();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      videoRef.current?.pause();
    };
  }, [prepareActiveClip]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (
      !video ||
      !activeClip ||
      video.currentTime <
        resolveEditorExportPreviewClipEndSeconds(activeClip) -
          clipEndToleranceSeconds
    ) {
      return;
    }

    advanceClip();
  };

  return {
    activeClip,
    advanceClip,
    handleLoadedMetadata: prepareActiveClip,
    handleTimeUpdate,
    videoRef,
  };
}

export { useEditorExportBackgroundPreview };
