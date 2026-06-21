import clsx from "clsx";
import type { PointerEvent } from "react";
import { useMemo, useRef, useState } from "react";

import { resolveActiveAuraCropRegionId } from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import {
  useCapturePreviewShallow,
  useCropEditorShallow,
  useProfilesShallow,
} from "~/renderer/store";

import type { CropRegion } from "~/types";
import styles from "./CropLayoutPreview.module.css";
import {
  type CropPreviewBounds,
  type CropResizeCorner,
  createCropLayoutPreview,
  createCropPreviewBoxLabelStyle,
  createCropPreviewBoxStyle,
  createCropPreviewStageStyle,
  createCropPreviewSurfaceStyle,
  cropResizeCorners,
  formatCropPreviewBoxLabel,
  getSelectedCropLayoutProfile,
  resizeCropRegionFromCorner,
  resolveCropPreviewSourceBounds,
} from "./CropLayoutPreview.utils";

const resizeCornerClassNames: Record<CropResizeCorner, string> = {
  nw: styles.resizeHandleNw ?? "",
  ne: styles.resizeHandleNe ?? "",
  sw: styles.resizeHandleSw ?? "",
  se: styles.resizeHandleSe ?? "",
};

interface ResizeState {
  regionId: string;
  corner: CropResizeCorner;
  startX: number;
  startY: number;
  bounds: CropPreviewBounds;
  initialRegion: CropRegion;
  draftRegion: CropRegion;
}

function isCropResizeCorner(
  value: string | undefined,
): value is CropResizeCorner {
  return cropResizeCorners.includes(value as CropResizeCorner);
}

function CropLayoutPreview() {
  const { profileItems, selectedProfileId, updateProfile } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      updateProfile: profiles.update,
    }),
  );
  const { selectedSourceId, sources } = useCapturePreviewShallow(
    (capturePreview) => ({
      selectedSourceId: capturePreview.selectedSourceId,
      sources: capturePreview.sources,
    }),
  );
  const selectedAuraCropRegionId = useCropEditorShallow(
    (cropEditor) => cropEditor.selectedAuraCropRegionId,
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const profile = getSelectedCropLayoutProfile(profileItems, selectedProfileId);
  const activeAuraCropRegionId = resolveActiveAuraCropRegionId(
    profile,
    selectedAuraCropRegionId,
  );
  const previewProfile = useMemo(() => {
    if (!profile || !resizeState) {
      return profile;
    }

    return {
      ...profile,
      cropRegions: profile.cropRegions.map((region) =>
        region.id === resizeState.regionId ? resizeState.draftRegion : region,
      ),
    };
  }, [profile, resizeState]);
  const preview = useMemo(() => {
    if (!previewProfile) {
      return null;
    }

    return createCropLayoutPreview(
      previewProfile,
      resolveCropPreviewSourceBounds(previewProfile, sources, selectedSourceId),
    );
  }, [previewProfile, selectedSourceId, sources]);
  const sourceImageUrl =
    sources.find((source) => source.id === selectedSourceId)
      ?.thumbnailDataUrl ?? null;

  const handleResizePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!profile || !preview || event.button !== 0) {
      return;
    }

    const regionId = event.currentTarget.dataset.regionId;
    const corner = event.currentTarget.dataset.corner;
    const initialRegion = profile.cropRegions.find(
      (region) => region.id === regionId,
    );
    if (!regionId || !isCropResizeCorner(corner) || !initialRegion) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizeState({
      regionId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      bounds: preview.bounds,
      initialRegion,
      draftRegion: initialRegion,
    });
  };

  const handleResizePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!resizeState || !stageRef.current) {
      return;
    }

    const rect = stageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const deltaX =
      ((event.clientX - resizeState.startX) / rect.width) *
      resizeState.bounds.width;
    const deltaY =
      ((event.clientY - resizeState.startY) / rect.height) *
      resizeState.bounds.height;
    const draftRegion = resizeCropRegionFromCorner(
      resizeState.initialRegion,
      resizeState.corner,
      deltaX,
      deltaY,
    );

    setResizeState({ ...resizeState, draftRegion });
  };

  const handleResizePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!profile || !resizeState) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const { draftRegion, regionId } = resizeState;
    setResizeState(null);
    void updateProfile({
      id: profile.id,
      cropRegions: profile.cropRegions.map((region) =>
        region.id === regionId ? draftRegion : region,
      ),
    });
  };

  const handleResizePointerCancel = () => {
    setResizeState(null);
  };

  if (!preview) {
    return null;
  }

  return (
    <div className={styles.layoutPreview} aria-label="Aura layout preview">
      <div className={styles.toolbar}>
        <div
          className={styles.legend}
          aria-hidden="true"
          data-onboarding="aura-source-position"
        >
          <span className={clsx(styles.legendItem, styles.sourceLegend)}>
            Source area
          </span>
          <span className={clsx(styles.legendItem, styles.auraLegend)}>
            Aura position
          </span>
        </div>
      </div>
      <div
        className={styles.stage}
        ref={stageRef}
        style={createCropPreviewStageStyle(preview.bounds)}
      >
        {sourceImageUrl && (
          <img alt="" className={styles.sourceSurface} src={sourceImageUrl} />
        )}
        {preview.boxes.map((box) => (
          <div
            className={clsx(
              styles.box,
              box.kind === "source" ? styles.sourceBox : styles.auraBox,
              box.kind === "source" &&
                box.cropRegionId === activeAuraCropRegionId &&
                styles.selectedSourceBox,
              box.kind === "aura" &&
                box.cropRegionId === activeAuraCropRegionId &&
                styles.selectedBox,
              box.kind === "aura" &&
                box.cropRegionId === activeAuraCropRegionId &&
                styles.selectedAuraBox,
            )}
            key={box.id}
            style={createCropPreviewBoxStyle(box, preview.bounds)}
          >
            {sourceImageUrl && (
              <img
                alt=""
                className={styles.boxSurface}
                src={sourceImageUrl}
                style={createCropPreviewSurfaceStyle(box, preview.bounds)}
              />
            )}
            {box.kind === "source" &&
              cropResizeCorners.map((corner) => (
                <span
                  aria-hidden="true"
                  className={clsx(
                    styles.resizeHandle,
                    resizeCornerClassNames[corner],
                  )}
                  data-corner={corner}
                  data-region-id={box.id}
                  key={corner}
                  onPointerCancel={handleResizePointerCancel}
                  onPointerDown={handleResizePointerDown}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                />
              ))}
          </div>
        ))}
        {preview.boxes.map((box) => (
          <span
            className={styles.boxLabel}
            key={`${box.id}-label`}
            style={createCropPreviewBoxLabelStyle(box, preview.bounds)}
            title={formatCropPreviewBoxLabel(box)}
          >
            {formatCropPreviewBoxLabel(box)}
          </span>
        ))}
      </div>
    </div>
  );
}

export { CropLayoutPreview };
