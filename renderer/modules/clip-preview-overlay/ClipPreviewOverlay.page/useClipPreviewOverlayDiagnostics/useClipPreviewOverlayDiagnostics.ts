import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import type { ClipPreviewTrimRange } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import { useClipPreviewOverlayDocumentDiagnostics } from "../useClipPreviewOverlayDocumentDiagnostics/useClipPreviewOverlayDocumentDiagnostics";
import { useClipPreviewOverlayMediaDiagnostics } from "../useClipPreviewOverlayMediaDiagnostics/useClipPreviewOverlayMediaDiagnostics";
import type { ClipPreviewPlaybackPresentationMetrics } from "../useClipPreviewOverlayPlayback/useClipPreviewOverlayPlayback";
import {
  roundDiagnosticNumber,
  writeClipPreviewDiagnostic,
} from "./useClipPreviewOverlayDiagnostics.utils";

const trimDiagnosticDelayMs = 250;

function areClipPreviewDiagnosticsEnabled(): boolean {
  const query = window.location.hash.split("?", 2)[1];
  const diagnostics = new URLSearchParams(query ?? "").get("diagnostics");
  if (diagnostics !== null) {
    return diagnostics === "1";
  }

  if (import.meta.env.MODE === "test") {
    return true;
  }

  return false;
}

interface UseClipPreviewOverlayDiagnosticsInput {
  clipId: string | null;
  clipKind: string | null;
  clipStatus: string | null;
  consumePlaybackPresentationMetrics: () => ClipPreviewPlaybackPresentationMetrics;
  durationSeconds: number;
  hasMediaSource: boolean;
  isMediaReady: boolean;
  isPlaying: boolean;
  isPreparingClip: boolean;
  isProcessing: boolean;
  trim: ClipPreviewTrimRange;
  videoRef: RefObject<HTMLVideoElement | null>;
}

function useClipPreviewOverlayDiagnostics({
  clipId,
  clipKind,
  clipStatus,
  consumePlaybackPresentationMetrics,
  durationSeconds,
  hasMediaSource,
  isMediaReady,
  isPlaying,
  isPreparingClip,
  isProcessing,
  trim,
  videoRef,
}: UseClipPreviewOverlayDiagnosticsInput): void {
  const diagnosticsEnabled = areClipPreviewDiagnosticsEnabled();
  const clipIdRef = useRef(clipId);
  const isPlayingRef = useRef(isPlaying);
  clipIdRef.current = clipId;
  isPlayingRef.current = isPlaying;
  useClipPreviewOverlayDocumentDiagnostics({
    clipIdRef,
    enabled: diagnosticsEnabled,
  });
  useClipPreviewOverlayMediaDiagnostics({
    clipId,
    clipIdRef,
    consumePlaybackPresentationMetrics,
    enabled: diagnosticsEnabled,
    hasMediaSource,
    isPlayingRef,
    videoRef,
  });

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return;
    }

    writeClipPreviewDiagnostic("clip-state", {
      clipId,
      clipKind,
      clipStatus,
      duration: roundDiagnosticNumber(durationSeconds),
      hasMediaSource,
    });
  }, [
    clipId,
    clipKind,
    clipStatus,
    diagnosticsEnabled,
    durationSeconds,
    hasMediaSource,
  ]);

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return;
    }

    const video = videoRef.current;
    writeClipPreviewDiagnostic("workflow-state", {
      clipId,
      isMediaReady,
      isPlaying,
      isPreparingClip,
      isProcessing,
      videoPaused: video?.paused ?? null,
      videoSeeking: video?.seeking ?? null,
    });
  }, [
    clipId,
    diagnosticsEnabled,
    isMediaReady,
    isPlaying,
    isPreparingClip,
    isProcessing,
    videoRef,
  ]);

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      writeClipPreviewDiagnostic("trim-state", {
        clipId: clipIdRef.current,
        inSeconds: roundDiagnosticNumber(trim.inSeconds),
        outSeconds: roundDiagnosticNumber(trim.outSeconds),
      });
    }, trimDiagnosticDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [diagnosticsEnabled, trim.inSeconds, trim.outSeconds]);
}

export { useClipPreviewOverlayDiagnostics };
