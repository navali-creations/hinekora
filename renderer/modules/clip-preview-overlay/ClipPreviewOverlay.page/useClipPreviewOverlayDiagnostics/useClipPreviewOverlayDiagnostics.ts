import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import type {
  ClipPreviewDiagnosticEvent,
  ClipPreviewDiagnosticFieldValue,
} from "~/main/modules/diag-log/DiagLog.dto";

import type { ClipPreviewTrimRange } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";
import type { ClipPreviewPlaybackPresentationMetrics } from "../useClipPreviewOverlayPlayback/useClipPreviewOverlayPlayback";

const playbackHealthIntervalMs = 1_000;
const trimDiagnosticDelayMs = 250;
const mediaDiagnosticEvents = [
  "abort",
  "canplay",
  "canplaythrough",
  "emptied",
  "ended",
  "error",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "pause",
  "play",
  "playing",
  "ratechange",
  "seeked",
  "seeking",
  "stalled",
  "suspend",
  "waiting",
] as const;

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

interface VideoFrameCounts {
  dropped: number | null;
  total: number | null;
}

function roundDiagnosticNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function writeClipPreviewDiagnostic(
  event: ClipPreviewDiagnosticEvent,
  fields?: Record<string, ClipPreviewDiagnosticFieldValue>,
): void {
  try {
    window.electron.diagLog.writeClipPreviewEvent({
      event,
      ...(fields ? { fields } : {}),
    });
  } catch {
    // Diagnostics must never interfere with preview playback.
  }
}

function readVideoFrameCounts(video: HTMLVideoElement): VideoFrameCounts {
  try {
    if (typeof video.getVideoPlaybackQuality === "function") {
      const quality = video.getVideoPlaybackQuality();
      return {
        dropped: quality.droppedVideoFrames,
        total: quality.totalVideoFrames,
      };
    }

    const dropped = Reflect.get(video, "webkitDroppedFrameCount");
    const total = Reflect.get(video, "webkitDecodedFrameCount");
    return {
      dropped: typeof dropped === "number" ? dropped : null,
      total: typeof total === "number" ? total : null,
    };
  } catch {
    return { dropped: null, total: null };
  }
}

function readBufferedAheadMs(video: HTMLVideoElement): number {
  try {
    const currentTime = video.currentTime;
    for (let index = 0; index < video.buffered.length; index += 1) {
      if (
        currentTime >= video.buffered.start(index) - 0.05 &&
        currentTime <= video.buffered.end(index) + 0.05
      ) {
        return roundDiagnosticNumber(
          Math.max(0, video.buffered.end(index) - currentTime) * 1_000,
        );
      }
    }
  } catch {
    return 0;
  }

  return 0;
}

function createMediaSnapshot(
  video: HTMLVideoElement,
  clipId: string | null,
): Record<string, ClipPreviewDiagnosticFieldValue> {
  const frames = readVideoFrameCounts(video);
  return {
    bufferedAheadMs: readBufferedAheadMs(video),
    bufferedRanges: video.buffered.length,
    clipId,
    currentTime: roundDiagnosticNumber(video.currentTime),
    droppedFrames: frames.dropped,
    duration: Number.isFinite(video.duration)
      ? roundDiagnosticNumber(video.duration)
      : null,
    ended: video.ended,
    errorCode: video.error?.code ?? null,
    errorMessage: video.error?.message ?? null,
    networkState: video.networkState,
    paused: video.paused,
    playbackRate: video.playbackRate,
    readyState: video.readyState,
    seeking: video.seeking,
    totalFrames: frames.total,
    videoHeight: video.videoHeight,
    videoWidth: video.videoWidth,
  };
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

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return;
    }

    const logDocumentState = (reason: string) => {
      writeClipPreviewDiagnostic("document-state", {
        clipId: clipIdRef.current,
        focused: document.hasFocus(),
        reason,
        visibilityState: document.visibilityState,
      });
    };
    const handleVisibilityChange = () => logDocumentState("visibilitychange");
    const handleFocus = () => logDocumentState("focus");
    const handleBlur = () => logDocumentState("blur");

    writeClipPreviewDiagnostic("overlay-mounted", {
      focused: document.hasFocus(),
      visibilityState: document.visibilityState,
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      writeClipPreviewDiagnostic("overlay-unmounted", {
        clipId: clipIdRef.current,
      });
    };
  }, [diagnosticsEnabled]);

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

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return;
    }

    const video = videoRef.current;
    if (!hasMediaSource || !video) {
      writeClipPreviewDiagnostic("media-source", {
        attached: false,
        clipId,
      });
      return;
    }

    const handleMediaEvent = (event: Event) => {
      writeClipPreviewDiagnostic("media-event", {
        ...createMediaSnapshot(video, clipIdRef.current),
        mediaEvent: event.type,
      });
    };
    for (const eventName of mediaDiagnosticEvents) {
      video.addEventListener(eventName, handleMediaEvent);
    }
    writeClipPreviewDiagnostic("media-source", {
      ...createMediaSnapshot(video, clipId),
      attached: true,
    });

    return () => {
      for (const eventName of mediaDiagnosticEvents) {
        video.removeEventListener(eventName, handleMediaEvent);
      }
      writeClipPreviewDiagnostic("media-source", {
        attached: false,
        clipId: clipIdRef.current,
      });
    };
  }, [clipId, diagnosticsEnabled, hasMediaSource, videoRef]);

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return;
    }

    const video = videoRef.current;
    if (!hasMediaSource || !video) {
      return;
    }

    let previousSampleTimeMs = performance.now();
    let previousMediaTime = video.currentTime;
    let previousFrames = readVideoFrameCounts(video);
    const intervalId = window.setInterval(() => {
      const sampleTimeMs = performance.now();
      const wallElapsedMs = sampleTimeMs - previousSampleTimeMs;
      const mediaTime = video.currentTime;
      const mediaAdvancedMs = (mediaTime - previousMediaTime) * 1_000;
      const frames = readVideoFrameCounts(video);
      const presentation = consumePlaybackPresentationMetrics();
      const isPlaybackActive =
        isPlayingRef.current ||
        !video.paused ||
        video.seeking ||
        presentation.frameCallbacks > 0;

      if (isPlaybackActive) {
        writeClipPreviewDiagnostic("playback-health", {
          ...createMediaSnapshot(video, clipIdRef.current),
          frameCallbacks: presentation.frameCallbacks,
          droppedFrameDelta:
            frames.dropped !== null && previousFrames.dropped !== null
              ? frames.dropped - previousFrames.dropped
              : null,
          focused: document.hasFocus(),
          maxFrameCallbackGapMs: roundDiagnosticNumber(
            presentation.maxFrameCallbackGapMs,
          ),
          mediaAdvancedMs: roundDiagnosticNumber(mediaAdvancedMs),
          mediaToWallRatio:
            wallElapsedMs > 0
              ? roundDiagnosticNumber(mediaAdvancedMs / wallElapsedMs)
              : null,
          presentationUpdates: presentation.presentationUpdates,
          stateIsPlaying: isPlayingRef.current,
          totalFrameDelta:
            frames.total !== null && previousFrames.total !== null
              ? frames.total - previousFrames.total
              : null,
          visibilityState: document.visibilityState,
          wallElapsedMs: roundDiagnosticNumber(wallElapsedMs),
        });
      }

      previousSampleTimeMs = sampleTimeMs;
      previousMediaTime = mediaTime;
      previousFrames = frames;
    }, playbackHealthIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [
    consumePlaybackPresentationMetrics,
    diagnosticsEnabled,
    hasMediaSource,
    videoRef,
  ]);
}

export { useClipPreviewOverlayDiagnostics };
