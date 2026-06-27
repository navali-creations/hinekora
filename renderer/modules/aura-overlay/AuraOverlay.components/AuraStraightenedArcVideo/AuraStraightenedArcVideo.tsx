import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import type { CropRegion } from "~/types";
import type {
  AuraSize,
  AuraVideoSize,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import {
  createStraightenedArcVideoGeometry,
  drawStraightenedArcVideoFrame,
  shouldDrawStraightenedArcFrame,
} from "./AuraStraightenedArcVideo.utils";

type VideoFrameCallback = (now: number, metadata: unknown) => void;
type RequestVideoFrameCallback = (callback: VideoFrameCallback) => number;
type CancelVideoFrameCallback = (handle: number) => void;

const fallbackFrameIntervalMs = 100;

interface AuraStraightenedArcVideoProps {
  bindAuraVideo: (element: HTMLVideoElement | null) => void;
  contentTransform: string;
  crop: CropRegion;
  displaySize: AuraSize;
  referenceViewport: AuraVideoSize | null;
  videoSize: AuraVideoSize;
  visibleThickness: number;
  onVideoSizeChange: (event: SyntheticEvent<HTMLVideoElement>) => void;
}

function AuraStraightenedArcVideo({
  bindAuraVideo,
  contentTransform,
  crop,
  displaySize,
  referenceViewport,
  videoSize,
  visibleThickness,
  onVideoSizeChange,
}: AuraStraightenedArcVideoProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const roundedWidth = Math.max(1, Math.round(displaySize.width));
  const roundedHeight = Math.max(1, Math.round(displaySize.height));
  const geometry = useMemo(
    () =>
      createStraightenedArcVideoGeometry({
        crop,
        displaySize: {
          height: roundedHeight,
          width: roundedWidth,
        },
        referenceViewport,
        videoSize,
        visibleThickness,
      }),
    [
      crop,
      referenceViewport,
      roundedHeight,
      roundedWidth,
      videoSize,
      visibleThickness,
    ],
  );

  const handleVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      videoRef.current = element;
      bindAuraVideo(element);
    },
    [bindAuraVideo],
  );

  useEffect(() => {
    const drawCurrentFrame = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && geometry && video) {
        drawStraightenedArcVideoFrame({
          canvas,
          geometry,
          video,
        });
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
        if (shouldDrawStraightenedArcFrame(nowMs, lastDrawMs)) {
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
    const drawTimedFrame = () => {
      if (!isActive) {
        return;
      }
      drawCurrentFrame();
      if (isActive) {
        timeoutId = window.setTimeout(drawTimedFrame, fallbackFrameIntervalMs);
      }
    };

    drawTimedFrame();

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [geometry]);

  return (
    <div
      className={styles.straightenedClip}
      style={{ transform: contentTransform }}
    >
      <video
        aria-hidden="true"
        className={styles.straightenedVideo}
        muted
        playsInline
        ref={handleVideoRef}
        onLoadedMetadata={onVideoSizeChange}
        onResize={onVideoSizeChange}
      />
      <canvas
        aria-label={crop.label}
        className={styles.straightenedCanvas}
        height={roundedHeight}
        ref={canvasRef}
        width={roundedWidth}
      />
    </div>
  );
}

export { AuraStraightenedArcVideo };
