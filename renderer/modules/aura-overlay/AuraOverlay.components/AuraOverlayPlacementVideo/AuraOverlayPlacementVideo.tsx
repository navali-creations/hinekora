import type { CSSProperties, SyntheticEvent } from "react";

import {
  AuraPlacementContentZoomSettings,
  type CropRegion,
  type OverlayPlacement,
} from "~/types";
import {
  type AuraSize,
  type AuraVideoSize,
  createAuraCropClipPath,
  createAuraVideoStyle,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import { resolveAuraPlacementClipPath } from "../AuraOverlayPlacement/AuraOverlayPlacement.utils";
import { AuraPointStackVideo } from "../AuraPointStackVideo/AuraPointStackVideo";
import { AuraStraightenedArcVideo } from "../AuraStraightenedArcVideo/AuraStraightenedArcVideo";

interface AuraOverlayPlacementVideoProps {
  bindAuraVideo: (element: HTMLVideoElement | null) => void;
  contentStyle: CSSProperties;
  crop: CropRegion;
  displaySize: AuraSize;
  isStraightenedArc: boolean;
  placement: OverlayPlacement;
  referenceViewport: AuraVideoSize | null;
  videoSize: AuraVideoSize;
  visibleThickness: number | undefined;
  onVideoSizeChange: (event: SyntheticEvent<HTMLVideoElement>) => void;
}

function AuraOverlayPlacementVideo({
  bindAuraVideo,
  contentStyle,
  crop,
  displaySize,
  isStraightenedArc,
  placement,
  referenceViewport,
  videoSize,
  visibleThickness,
  onVideoSizeChange,
}: AuraOverlayPlacementVideoProps) {
  if (isStraightenedArc && visibleThickness !== undefined) {
    return (
      <AuraStraightenedArcVideo
        bindAuraVideo={bindAuraVideo}
        contentStyle={contentStyle}
        crop={crop}
        displaySize={displaySize}
        referenceViewport={referenceViewport}
        videoSize={videoSize}
        visibleThickness={visibleThickness}
        onVideoSizeChange={onVideoSizeChange}
      />
    );
  }

  if (crop.shape === "points" && crop.points?.length) {
    return (
      <AuraPointStackVideo
        bindAuraVideo={bindAuraVideo}
        contentStyle={contentStyle}
        crop={crop}
        displaySize={displaySize}
        placement={placement}
        referenceViewport={referenceViewport}
        videoSize={videoSize}
        onVideoSizeChange={onVideoSizeChange}
      />
    );
  }

  const cropClipPath = createAuraCropClipPath(
    crop,
    visibleThickness,
    displaySize,
  );
  const placementClipPath =
    crop.shape === undefined || crop.shape === "rect"
      ? resolveAuraPlacementClipPath(placement.clipShape)
      : undefined;
  const clipPath = cropClipPath ?? placementClipPath;
  const supportsIconControls =
    crop.shape === undefined || crop.shape === "rect";
  const contentZoomScale =
    (supportsIconControls
      ? (placement.contentZoomPercent ??
        AuraPlacementContentZoomSettings.defaultPercent)
      : AuraPlacementContentZoomSettings.defaultPercent) / 100;
  const iconOffsetX = supportsIconControls ? (placement.iconOffsetX ?? 0) : 0;
  const iconOffsetY = supportsIconControls ? (placement.iconOffsetY ?? 0) : 0;

  return (
    <div
      className={styles.videoClip}
      style={{
        ...contentStyle,
        ...(clipPath ? { clipPath } : {}),
        ...(placementClipPath && placement.clipShape === "circle"
          ? { borderRadius: "50%" }
          : {}),
      }}
    >
      <div
        className={styles.videoContent}
        data-aura-content-zoom={contentZoomScale * 100}
        data-aura-icon-x={iconOffsetX}
        data-aura-icon-y={iconOffsetY}
        style={{
          transform: `translate(${iconOffsetX}px, ${iconOffsetY}px) scale(${contentZoomScale})`,
        }}
      >
        <video
          aria-label={crop.label}
          className={styles.video}
          muted
          playsInline
          ref={bindAuraVideo}
          style={createAuraVideoStyle(
            crop,
            placement,
            videoSize,
            referenceViewport,
          )}
          onLoadedMetadata={onVideoSizeChange}
          onResize={onVideoSizeChange}
        />
      </div>
    </div>
  );
}

export { AuraOverlayPlacementVideo };
