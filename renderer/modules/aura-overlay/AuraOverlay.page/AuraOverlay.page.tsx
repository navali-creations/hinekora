import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";

import { OverlayExitNotice } from "~/renderer/components/OverlayExitNotice/OverlayExitNotice";
import { AuraEditingNotice } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraEditingNotice/AuraEditingNotice";
import { AuraLockHandoffNotice } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraLockHandoffNotice/AuraLockHandoffNotice";
import { AuraOverlayPlacement } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraOverlayPlacement/AuraOverlayPlacement";
import { AuraPlacementFocusStrip } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraPlacementFocusStrip/AuraPlacementFocusStrip";
import { useAuraOverlayAddAuraSelection } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayAddAuraSelection/useAuraOverlayAddAuraSelection";
import { useAuraOverlayEditingHistory } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayEditingHistory/useAuraOverlayEditingHistory";
import { useAuraOverlayLockState } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayLockState/useAuraOverlayLockState";
import { useAuraOverlayPlacementEditor } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayPlacementEditor/useAuraOverlayPlacementEditor";
import { useAuraOverlayVideoSizing } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayVideoSizing/useAuraOverlayVideoSizing";
import { useDesktopCaptureStream } from "~/renderer/modules/capture-preview/CapturePreview.hooks/useDesktopCaptureStream/useDesktopCaptureStream";
import { resolveCapturePreviewSourceId } from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import { getSelectedCropLayoutProfile } from "~/renderer/modules/crop-editor/CropEditor.components/CropLayoutPreview/CropLayoutPreview.utils";
import {
  useCapturePreviewShallow,
  useProfilesShallow,
  useSettingsSelector,
} from "~/renderer/store";

import {
  type AuraVideoSize,
  createAuraPreviewConstraints,
  readAuraRouteParams,
} from "./AuraOverlay.page.utils";
import styles from "./AuraOverlayPage.module.css";

const auraOverlayRouteClassName = "is-aura-overlay-route";

function AuraOverlayPage() {
  const { profileItems, selectedProfileId, updateProfile } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      updateProfile: profiles.update,
    }),
  );
  const { isLoadingSources, refreshSources, selectedSourceId, sources } =
    useCapturePreviewShallow((capturePreview) => ({
      isLoadingSources: capturePreview.isLoading,
      refreshSources: capturePreview.refresh,
      selectedSourceId: capturePreview.selectedSourceId,
      sources: capturePreview.sources,
    }));
  const hasRequestedSourcesRef = useRef(false);
  const [routeParams, setRouteParams] = useState(readAuraRouteParams);
  const routeProfileId = routeParams.get("profileId");
  const routeStartAddingAura = routeParams.get("startAddingAura") === "1";
  const routeAddAuraRequestId = routeParams.get("addAuraRequestId");
  const activeGame = useSettingsSelector(
    (settings) => settings.value?.activeGame ?? "poe1",
  );
  const profile =
    (routeProfileId
      ? profileItems.find((item) => item.id === routeProfileId)
      : null) ??
    getSelectedCropLayoutProfile(profileItems, selectedProfileId, activeGame);
  const { auraOverlayLocked, lockAuraOverlay, showLockHandoffHint } =
    useAuraOverlayLockState();

  useEffect(() => {
    if (
      hasRequestedSourcesRef.current ||
      isLoadingSources ||
      sources.length > 0
    ) {
      return;
    }

    hasRequestedSourcesRef.current = true;
    void refreshSources();
  }, [isLoadingSources, refreshSources, sources.length]);

  const captureSourceId = useMemo(
    () =>
      resolveCapturePreviewSourceId(
        profile?.captureTarget,
        sources,
        selectedSourceId,
      ),
    [profile, selectedSourceId, sources],
  );
  const captureSource =
    sources.find((source) => source.id === captureSourceId) ?? null;
  const captureSourceVideoSize =
    captureSource?.width && captureSource.height
      ? { width: captureSource.width, height: captureSource.height }
      : null;
  const profileReferenceViewport: AuraVideoSize | null =
    profile?.captureTarget?.width && profile.captureTarget.height
      ? {
          width: profile.captureTarget.width,
          height: profile.captureTarget.height,
        }
      : null;

  const emptyMessage = !profile
    ? "No profile loaded"
    : profile.overlayPlacements.length === 0
      ? "No aura positions configured"
      : null;
  const canEditAuras = !auraOverlayLocked;
  const { recordAuraHistory, selectPlacement, selectedPlacementId } =
    useAuraOverlayEditingHistory({
      canEditAuras,
      profile,
      updateProfile,
    });
  const { stream } = useDesktopCaptureStream({
    sourceId: captureSourceId,
    enabled: Boolean(captureSourceId && !emptyMessage),
    createConstraints: createAuraPreviewConstraints,
  });
  const { bindAuraVideo, effectiveVideoSize, handleVideoSizeChange } =
    useAuraOverlayVideoSizing({
      captureSourceId,
      fallbackVideoSize: captureSourceVideoSize,
      stream,
    });
  const {
    arcThicknessResizeState,
    dragState,
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
    profile,
    referenceViewport: profileReferenceViewport,
    recordAuraHistory,
    selectPlacement,
    targetViewport: effectiveVideoSize,
    updateProfile,
  });

  useEffect(() => {
    const handleHashChange = () => {
      setRouteParams(readAuraRouteParams());
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.add(auraOverlayRouteClassName);
    document.body.classList.add(auraOverlayRouteClassName);

    return () => {
      document.documentElement.classList.remove(auraOverlayRouteClassName);
      document.body.classList.remove(auraOverlayRouteClassName);
    };
  }, []);

  const handleLockAurasClick = () => {
    void lockAuraOverlay();
  };

  const { startAddAuraSelection } = useAuraOverlayAddAuraSelection({
    lockAuraOverlay,
    profile,
    recordAuraHistory,
    routeAddAuraRequestId,
    routeStartAddingAura,
    updateProfile,
  });

  const handleAddAuraClick = () => {
    startAddAuraSelection({ shape: "rect" });
  };

  const handleAddArchedAuraClick = () => {
    startAddAuraSelection({ shape: "arc" });
  };

  const handleAddPointerAuraClick = () => {
    startAddAuraSelection({ shape: "points" });
  };

  return (
    <main
      aria-label="Aura overlay"
      className={clsx(styles.overlay, canEditAuras && styles.overlayEditing)}
      role="application"
    >
      {profile?.overlayPlacements.map((placement) => {
        const crop = profile.cropRegions.find(
          (region) => region.id === placement.cropRegionId,
        );
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
            selectedPlacementId={selectedPlacementId}
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
      <AuraPlacementFocusStrip
        cropRegions={profile?.cropRegions ?? []}
        placements={canEditAuras ? (profile?.overlayPlacements ?? []) : []}
        selectedPlacementId={selectedPlacementId}
        onSelectPlacement={selectPlacement}
      />
      {canEditAuras && (
        <>
          <OverlayExitNotice overlayName="aura overlay" />
          <AuraEditingNotice
            canAddAura={!!profile}
            onAddAura={handleAddAuraClick}
            onAddArchedAura={handleAddArchedAuraClick}
            onAddPointerAura={handleAddPointerAuraClick}
            onLockAuras={handleLockAurasClick}
          />
        </>
      )}
      {showLockHandoffHint && auraOverlayLocked && <AuraLockHandoffNotice />}
    </main>
  );
}

export { AuraOverlayPage };
