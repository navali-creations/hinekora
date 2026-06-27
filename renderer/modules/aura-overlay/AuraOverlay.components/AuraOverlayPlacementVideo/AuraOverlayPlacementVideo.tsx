import type { SyntheticEvent } from "react";

import type { CropRegion, OverlayPlacement } from "~/types";
import {
  type AuraSize,
  type AuraVideoSize,
  createAuraCropClipPath,
  createAuraVideoStyle,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";
import { AuraStraightenedArcVideo } from "../AuraStraightenedArcVideo/AuraStraightenedArcVideo";

interface AuraOverlayPlacementVideoProps {
  bindAuraVideo: (element: HTMLVideoElement | null) => void;
  contentTransform: string;
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
  contentTransform,
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
        contentTransform={contentTransform}
        crop={crop}
        displaySize={displaySize}
        referenceViewport={referenceViewport}
        videoSize={videoSize}
        visibleThickness={visibleThickness}
        onVideoSizeChange={onVideoSizeChange}
      />
    );
  }

  const cropClipPath = createAuraCropClipPath(
    crop,
    visibleThickness,
    displaySize,
  );

  return (
    <div
      className={styles.videoClip}
      style={{
        ...(cropClipPath ? { clipPath: cropClipPath } : {}),
        transform: contentTransform,
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
  );
}

export { AuraOverlayPlacementVideo };
