import {
  type CSSProperties,
  type SyntheticEvent,
  useCallback,
  useMemo,
  useRef,
} from "react";

import type { CropRegion, OverlayPlacement } from "~/types";
import { useAuraVideoCanvasFrame } from "../../AuraOverlay.hooks/useAuraVideoCanvasFrame/useAuraVideoCanvasFrame";
import type {
  AuraSize,
  AuraVideoSize,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import {
  createPointStackVideoGeometry,
  drawPointStackVideoFrame,
  shouldDrawPointStackFrame,
} from "./AuraPointStackVideo.utils";

interface AuraPointStackVideoProps {
  bindAuraVideo: (element: HTMLVideoElement | null) => void;
  contentStyle: CSSProperties;
  crop: CropRegion;
  displaySize: AuraSize;
  placement: OverlayPlacement;
  referenceViewport: AuraVideoSize | null;
  videoSize: AuraVideoSize;
  onVideoSizeChange: (event: SyntheticEvent<HTMLVideoElement>) => void;
}

function AuraPointStackVideo({
  bindAuraVideo,
  contentStyle,
  crop,
  displaySize,
  placement,
  referenceViewport,
  videoSize,
  onVideoSizeChange,
}: AuraPointStackVideoProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const roundedWidth = Math.max(1, Math.round(displaySize.width));
  const roundedHeight = Math.max(1, Math.round(displaySize.height));
  const geometry = useMemo(
    () =>
      createPointStackVideoGeometry({
        crop,
        displaySize: { height: roundedHeight, width: roundedWidth },
        placement,
        referenceViewport,
        videoSize,
      }),
    [
      crop,
      placement,
      referenceViewport,
      roundedHeight,
      roundedWidth,
      videoSize,
    ],
  );

  const handleVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      videoRef.current = element;
      bindAuraVideo(element);
    },
    [bindAuraVideo],
  );

  useAuraVideoCanvasFrame({
    canvasRef,
    drawFrame: drawPointStackVideoFrame,
    geometry,
    shouldDrawFrame: shouldDrawPointStackFrame,
    videoRef,
  });

  return (
    <div className={styles.straightenedClip} style={contentStyle}>
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

export { AuraPointStackVideo };
