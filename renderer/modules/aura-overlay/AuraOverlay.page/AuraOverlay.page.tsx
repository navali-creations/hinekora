import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

import { OverlayExitNotice } from "~/renderer/components/OverlayExitNotice/OverlayExitNotice";
import { AuraEditingNotice } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraEditingNotice/AuraEditingNotice";
import { AuraLockHandoffNotice } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraLockHandoffNotice/AuraLockHandoffNotice";
import { AuraOverlayAlignmentGuides } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraOverlayAlignmentGuides/AuraOverlayAlignmentGuides";
import { AuraOverlayAreaSelection } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraOverlayAreaSelection/AuraOverlayAreaSelection";
import { AuraOverlayAreaSelectionDraft } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraOverlayAreaSelectionDraft/AuraOverlayAreaSelectionDraft";
import { AuraOverlayPlacement } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraOverlayPlacement/AuraOverlayPlacement";
import { AuraPlacementFocusStrip } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraPlacementFocusStrip/AuraPlacementFocusStrip";
import { useAuraOverlayAddAuraSelection } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayAddAuraSelection/useAuraOverlayAddAuraSelection";
import { useAuraOverlayCaptureStream } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayCaptureStream/useAuraOverlayCaptureStream";
import { useAuraOverlayEditingGeometry } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayEditingGeometry/useAuraOverlayEditingGeometry";
import { useAuraOverlayEditingHistory } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayEditingHistory/useAuraOverlayEditingHistory";
import { useAuraOverlayLockState } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayLockState/useAuraOverlayLockState";
import { useAuraOverlayPlacementEditor } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayPlacementEditor/useAuraOverlayPlacementEditor";
import { useAuraOverlayVideoSizing } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayVideoSizing/useAuraOverlayVideoSizing";
import auraSelectionGridStyles from "~/renderer/modules/aura-selection/AuraSelectionGrid.module.css";
import { getSelectedProfile } from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import { ProfileMutationError } from "~/renderer/modules/profiles/Profiles.components/ProfileMutationError/ProfileMutationError";
import { useProfilesShallow, useSettingsShallow } from "~/renderer/store";

import {
  readAuraRouteParams,
  resolveAuraProfileReferenceViewport,
  selectAuraOverlayPageSettings,
} from "./AuraOverlay.page.utils";
import styles from "./AuraOverlayPage.module.css";

function AuraOverlayPage() {
  const { profileItems, selectedProfileId } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
    }),
  );
  const [routeParams, setRouteParams] = useState(readAuraRouteParams);
  const routeProfileId = routeParams.get("profileId");
  const routeStartAddingAura = routeParams.get("startAddingAura") === "1";
  const routeAddAuraRequestId = routeParams.get("addAuraRequestId");
  const auraSettings = useSettingsShallow(selectAuraOverlayPageSettings);
  const profile =
    (routeProfileId
      ? profileItems.find((item) => item.id === routeProfileId)
      : null) ??
    getSelectedProfile(
      profileItems,
      selectedProfileId,
      auraSettings.activeGame,
    );
  const { auraOverlayLocked, lockAuraOverlay, showLockHandoffHint } =
    useAuraOverlayLockState();

  const profileReferenceViewport = resolveAuraProfileReferenceViewport(profile);

  const emptyMessage = !profile
    ? "No profile loaded"
    : profile.overlayPlacements.length === 0
      ? "No aura positions configured"
      : null;
  const {
    captureSourceId,
    fallbackVideoSize: captureSourceVideoSize,
    stream,
  } = useAuraOverlayCaptureStream({
    enabled: emptyMessage === null,
    profile,
  });
  const canEditAuras = !auraOverlayLocked;
  useAuraOverlayEditingHistory({
    canEditAuras,
    profile,
  });
  const { bindAuraVideo, effectiveVideoSize, handleVideoSizeChange } =
    useAuraOverlayVideoSizing({
      captureSourceId,
      fallbackVideoSize: captureSourceVideoSize,
      stream,
    });
  const { gridCellSize, viewport: editingViewport } =
    useAuraOverlayEditingGeometry(effectiveVideoSize);
  const {
    arcThicknessResizeState,
    areaSelectionDraftRef,
    dragState,
    handleAreaContextMenu,
    handleAreaPointerCancel,
    handleAreaPointerDown,
    handleAreaPointerMove,
    handleAreaPointerUp,
    handleAuraClick,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePlacementPropertiesChange,
    handleResizePointerCancel,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
    handleThicknessPointerCancel,
    handleThicknessPointerDown,
    handleThicknessPointerMove,
    handleThicknessPointerUp,
    resizeState,
  } = useAuraOverlayPlacementEditor({
    canEditAuras,
    gridCellSize,
    guideViewport: editingViewport,
    profile,
    referenceViewport: profileReferenceViewport,
    snapEnabled: auraSettings.enableSnapping,
    targetViewport: effectiveVideoSize,
  });
  const cropRegionsById = useMemo(
    () =>
      new Map(
        profile?.cropRegions.map((crop) => [crop.id, crop] as const) ?? [],
      ),
    [profile?.cropRegions],
  );

  useEffect(() => {
    const handleHashChange = () => {
      setRouteParams(readAuraRouteParams());
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const handleLockAurasClick = () => {
    void lockAuraOverlay();
  };

  const { startAddAuraSelection } = useAuraOverlayAddAuraSelection({
    lockAuraOverlay,
    profile,
    routeAddAuraRequestId,
    routeStartAddingAura,
  });

  const handleAddAuraClick = () => startAddAuraSelection({ shape: "rect" });

  const handleAddArcClick = () => startAddAuraSelection({ shape: "arc" });

  const addPointAura = () => startAddAuraSelection({ shape: "points" });

  return (
    <main
      aria-label="Aura overlay"
      className={clsx(
        styles.overlay,
        canEditAuras && auraSettings.showFrame && styles.overlayEditing,
        canEditAuras &&
          auraSettings.showGrid &&
          auraSelectionGridStyles.auraSelectionGrid,
        canEditAuras && auraSettings.hideLabels && styles.overlayHideLabels,
        canEditAuras &&
          auraSettings.hideProperties &&
          styles.overlayHideProperties,
      )}
      role="application"
      style={{
        backgroundSize: `${gridCellSize.width}px ${gridCellSize.height}px`,
      }}
      onContextMenu={handleAreaContextMenu}
      onPointerCancel={handleAreaPointerCancel}
      onPointerDown={handleAreaPointerDown}
      onPointerMove={handleAreaPointerMove}
      onPointerUp={handleAreaPointerUp}
    >
      <ProfileMutationError className={styles.profileError ?? ""} />
      {profile?.overlayPlacements.map((placement) => {
        const crop = cropRegionsById.get(placement.cropRegionId);
        if (!crop) {
          return null;
        }

        return (
          <AuraOverlayPlacement
            arcThicknessResizeState={arcThicknessResizeState}
            auraOverlayLocked={auraOverlayLocked}
            bindAuraVideo={bindAuraVideo}
            canEditAuras={canEditAuras}
            crop={crop}
            dragState={dragState}
            effectiveVideoSize={effectiveVideoSize}
            key={placement.id}
            placement={placement}
            referenceViewport={profileReferenceViewport}
            resizeState={resizeState}
            stream={stream}
            onAuraClick={handleAuraClick}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPlacementPropertiesChange={handlePlacementPropertiesChange}
            onResizePointerCancel={handleResizePointerCancel}
            onResizePointerDown={handleResizePointerDown}
            onResizePointerMove={handleResizePointerMove}
            onResizePointerUp={handleResizePointerUp}
            onThicknessPointerCancel={handleThicknessPointerCancel}
            onThicknessPointerDown={handleThicknessPointerDown}
            onThicknessPointerMove={handleThicknessPointerMove}
            onThicknessPointerUp={handleThicknessPointerUp}
            onVideoSizeChange={handleVideoSizeChange}
          />
        );
      })}
      {canEditAuras && (
        <AuraOverlayAreaSelectionDraft ref={areaSelectionDraftRef} />
      )}
      {canEditAuras && (
        <AuraOverlayAreaSelection
          dragState={dragState}
          onPointerCancel={handlePointerCancel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}
      <AuraPlacementFocusStrip
        cropRegions={profile?.cropRegions ?? []}
        placements={canEditAuras ? (profile?.overlayPlacements ?? []) : []}
      />
      {canEditAuras && (
        <>
          <AuraOverlayAlignmentGuides dragState={dragState} />
          <OverlayExitNotice overlayName="aura overlay" />
          <AuraEditingNotice
            canAddAura={!!profile}
            onAddAura={handleAddAuraClick}
            onAddArchedAura={handleAddArcClick}
            onAddPointerAura={addPointAura}
            onLockAuras={handleLockAurasClick}
          />
        </>
      )}
      {showLockHandoffHint && auraOverlayLocked && <AuraLockHandoffNotice />}
    </main>
  );
}

export { AuraOverlayPage };
