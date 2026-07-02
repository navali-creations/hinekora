import clsx from "clsx";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { resolveActiveAuraCropRegionId } from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import {
  useCapturePreviewShallow,
  useCropEditorShallow,
  useProfilesShallow,
  useSettingsSelector,
} from "~/renderer/store";

import type { CropRegion } from "~/types";
import styles from "./CropLayoutPreview.module.css";
import {
  type CropPreviewBounds,
  type CropResizeCorner,
  createCropLayoutPreview,
  createCropPreviewStageStyle,
  cropResizeCorners,
  getSelectedCropLayoutProfile,
  resizeCropRegionFromCorner,
  resolveCropPreviewSourceBounds,
} from "./CropLayoutPreview.utils";
import { CropPreviewAuraVisibilityToggle } from "./CropPreviewAuraVisibilityToggle/CropPreviewAuraVisibilityToggle";
import { CropPreviewBoxLayer } from "./CropPreviewBoxLayer/CropPreviewBoxLayer";

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
  const {
    getThumbnail,
    selectedSourceId,
    sourceImageState,
    sourceImageUrl,
    sources,
  } = useCapturePreviewShallow((capturePreview) => ({
    getThumbnail: capturePreview.getThumbnail,
    selectedSourceId: capturePreview.selectedSourceId,
    sourceImageState:
      capturePreview.selectedSourceId !== null
        ? capturePreview.thumbnailsBySourceId[capturePreview.selectedSourceId]
        : null,
    sourceImageUrl:
      capturePreview.selectedSourceId !== null
        ? (capturePreview.thumbnailsBySourceId[
            capturePreview.selectedSourceId
          ] ?? null)
        : null,
    sources: capturePreview.sources,
  }));
  const { selectedAuraCropRegionId, showAllAurasInPreview } =
    useCropEditorShallow((cropEditor) => ({
      selectedAuraCropRegionId: cropEditor.selectedAuraCropRegionId,
      showAllAurasInPreview: cropEditor.showAllAurasInPreview,
    }));
  const activeGame = useSettingsSelector(
    (settings) => settings.value?.activeGame ?? "poe1",
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const profile = getSelectedCropLayoutProfile(
    profileItems,
    selectedProfileId,
    activeGame,
  );
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
      showAllAurasInPreview ? null : activeAuraCropRegionId,
    );
  }, [
    activeAuraCropRegionId,
    previewProfile,
    selectedSourceId,
    showAllAurasInPreview,
    sources,
  ]);
  useEffect(() => {
    if (!selectedSourceId || sourceImageState !== undefined) {
      return;
    }

    void getThumbnail(selectedSourceId).catch(() => undefined);
  }, [getThumbnail, selectedSourceId, sourceImageState]);

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
        <CropPreviewAuraVisibilityToggle />
      </div>
      <div
        className={styles.stage}
        ref={stageRef}
        style={createCropPreviewStageStyle(preview.bounds)}
      >
        {sourceImageUrl && (
          <img alt="" className={styles.sourceSurface} src={sourceImageUrl} />
        )}
        <CropPreviewBoxLayer
          activeAuraCropRegionId={activeAuraCropRegionId}
          preview={preview}
          sourceImageUrl={sourceImageUrl}
          onResizePointerCancel={handleResizePointerCancel}
          onResizePointerDown={handleResizePointerDown}
          onResizePointerMove={handleResizePointerMove}
          onResizePointerUp={handleResizePointerUp}
        />
      </div>
    </div>
  );
}

export { CropLayoutPreview };
