import { type RefObject, useEffect } from "react";

type VideoFrameCallback = (now: number, metadata: unknown) => void;
type RequestVideoFrameCallback = (callback: VideoFrameCallback) => number;
type CancelVideoFrameCallback = (handle: number) => void;

interface UseAuraVideoCanvasFrameInput<Geometry> {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  drawFrame: (input: {
    canvas: HTMLCanvasElement;
    geometry: Geometry;
    video: HTMLVideoElement;
  }) => void;
  fallbackFrameIntervalMs?: number;
  geometry: Geometry | null;
  shouldDrawFrame: (nowMs: number, lastDrawMs: number | null) => boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}

const defaultFallbackFrameIntervalMs = 1_000 / 60;

function useAuraVideoCanvasFrame<Geometry>({
  canvasRef,
  drawFrame,
  fallbackFrameIntervalMs = defaultFallbackFrameIntervalMs,
  geometry,
  shouldDrawFrame,
  videoRef,
}: UseAuraVideoCanvasFrameInput<Geometry>): void {
  useEffect(() => {
    const drawCurrentFrame = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && geometry && video) {
        drawFrame({ canvas, geometry, video });
      }
    };

    const video = videoRef.current;
    const requestVideoFrameCallback = video
      ? (
          Reflect.get(video, "requestVideoFrameCallback") as
            | RequestVideoFrameCallback
            | undefined
        )?.bind(video)
      : null;
    const cancelVideoFrameCallback = video
      ? (
          Reflect.get(video, "cancelVideoFrameCallback") as
            | CancelVideoFrameCallback
            | undefined
        )?.bind(video)
      : null;

    if (requestVideoFrameCallback && cancelVideoFrameCallback) {
      let callbackId = 0;
      let isActive = true;
      let lastDrawMs: number | null = null;
      const drawVideoFrame: VideoFrameCallback = (nowMs) => {
        if (!isActive) {
          return;
        }
        if (shouldDrawFrame(nowMs, lastDrawMs)) {
          lastDrawMs = nowMs;
          drawCurrentFrame();
        }
        if (isActive) {
          callbackId = requestVideoFrameCallback(drawVideoFrame);
        }
      };

      lastDrawMs = performance.now();
      drawCurrentFrame();
      callbackId = requestVideoFrameCallback(drawVideoFrame);

      return () => {
        isActive = false;
        cancelVideoFrameCallback(callbackId);
      };
    }

    let timeoutId = 0;
    let isActive = true;
    let lastDrawMs: number | null = null;
    const drawTimedFrame = () => {
      if (!isActive) {
        return;
      }
      const nowMs = performance.now();
      if (shouldDrawFrame(nowMs, lastDrawMs)) {
        lastDrawMs = nowMs;
        drawCurrentFrame();
      }
      if (isActive) {
        timeoutId = window.setTimeout(drawTimedFrame, fallbackFrameIntervalMs);
      }
    };

    lastDrawMs = performance.now();
    drawCurrentFrame();
    timeoutId = window.setTimeout(drawTimedFrame, fallbackFrameIntervalMs);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    canvasRef,
    drawFrame,
    fallbackFrameIntervalMs,
    geometry,
    shouldDrawFrame,
    videoRef,
  ]);
}

export { useAuraVideoCanvasFrame };
