import type { RefObject } from "react";
import { useEffect } from "react";

import {
  createMediaSnapshot,
  readVideoFrameCounts,
  roundDiagnosticNumber,
  writeClipPreviewDiagnostic,
} from "../useClipPreviewOverlayDiagnostics/useClipPreviewOverlayDiagnostics.utils";
import type { ClipPreviewPlaybackPresentationMetrics } from "../useClipPreviewOverlayPlayback/useClipPreviewOverlayPlayback";

const playbackHealthIntervalMs = 1_000;
const mediaDiagnosticThrottleMs = 500;
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

function useClipPreviewOverlayMediaDiagnostics(input: {
  clipId: string | null;
  clipIdRef: RefObject<string | null>;
  consumePlaybackPresentationMetrics: () => ClipPreviewPlaybackPresentationMetrics;
  enabled: boolean;
  hasMediaSource: boolean;
  isPlayingRef: RefObject<boolean>;
  videoRef: RefObject<HTMLVideoElement | null>;
}): void {
  useMediaEventDiagnostics(input);
  usePlaybackHealthDiagnostics(input);
}

function useMediaEventDiagnostics(input: {
  clipId: string | null;
  clipIdRef: RefObject<string | null>;
  enabled: boolean;
  hasMediaSource: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}): void {
  useEffect(() => {
    if (!input.enabled) {
      return;
    }

    const video = input.videoRef.current;
    if (!input.hasMediaSource || !video) {
      writeClipPreviewDiagnostic("media-source", {
        attached: false,
        clipId: input.clipId,
      });
      return;
    }

    const lastMediaEventAt = new Map<string, number>();
    const handleMediaEvent = (event: Event) => {
      const now = performance.now();
      const previousEventAt = lastMediaEventAt.get(event.type);
      if (
        previousEventAt !== undefined &&
        now - previousEventAt < mediaDiagnosticThrottleMs
      ) {
        return;
      }
      lastMediaEventAt.set(event.type, now);
      writeClipPreviewDiagnostic("media-event", {
        ...createMediaSnapshot(video, input.clipIdRef.current),
        mediaEvent: event.type,
      });
    };
    for (const eventName of mediaDiagnosticEvents) {
      video.addEventListener(eventName, handleMediaEvent);
    }
    writeClipPreviewDiagnostic("media-source", {
      ...createMediaSnapshot(video, input.clipId),
      attached: true,
    });

    return () => {
      for (const eventName of mediaDiagnosticEvents) {
        video.removeEventListener(eventName, handleMediaEvent);
      }
      writeClipPreviewDiagnostic("media-source", {
        attached: false,
        clipId: input.clipIdRef.current,
      });
    };
  }, [
    input.clipId,
    input.clipIdRef,
    input.enabled,
    input.hasMediaSource,
    input.videoRef,
  ]);
}

function usePlaybackHealthDiagnostics(input: {
  clipIdRef: RefObject<string | null>;
  consumePlaybackPresentationMetrics: () => ClipPreviewPlaybackPresentationMetrics;
  enabled: boolean;
  hasMediaSource: boolean;
  isPlayingRef: RefObject<boolean>;
  videoRef: RefObject<HTMLVideoElement | null>;
}): void {
  useEffect(() => {
    if (!input.enabled) {
      return;
    }
    const video = input.videoRef.current;
    if (!input.hasMediaSource || !video) {
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
      const presentation = input.consumePlaybackPresentationMetrics();
      const isPlaybackActive =
        input.isPlayingRef.current ||
        !video.paused ||
        video.seeking ||
        presentation.frameCallbacks > 0;

      if (isPlaybackActive) {
        writeClipPreviewDiagnostic("playback-health", {
          ...createMediaSnapshot(video, input.clipIdRef.current),
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
          stateIsPlaying: input.isPlayingRef.current,
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
    input.clipIdRef,
    input.consumePlaybackPresentationMetrics,
    input.enabled,
    input.hasMediaSource,
    input.isPlayingRef,
    input.videoRef,
  ]);
}

export { useClipPreviewOverlayMediaDiagnostics };
