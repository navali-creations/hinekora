import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

import { AuraEditingNotice } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraEditingNotice/AuraEditingNotice";
import { AuraLockHandoffNotice } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraLockHandoffNotice/AuraLockHandoffNotice";
import { AuraOverlayPlacement } from "~/renderer/modules/aura-overlay/AuraOverlay.components/AuraOverlayPlacement/AuraOverlayPlacement";
import { useAuraOverlayAddAuraSelection } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayAddAuraSelection/useAuraOverlayAddAuraSelection";
import { useAuraOverlayEditingHistory } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayEditingHistory/useAuraOverlayEditingHistory";
import { useAuraOverlayLockState } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayLockState/useAuraOverlayLockState";
import { useAuraOverlayPlacementEditor } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayPlacementEditor/useAuraOverlayPlacementEditor";
import { useAuraOverlayVideoSizing } from "~/renderer/modules/aura-overlay/AuraOverlay.hooks/useAuraOverlayVideoSizing/useAuraOverlayVideoSizing";
import { useDesktopCaptureStream } from "~/renderer/modules/capture-preview/CapturePreview.hooks/useDesktopCaptureStream/useDesktopCaptureStream";
import { resolveCapturePreviewSourceId } from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import { getSelectedCropLayoutProfile } from "~/renderer/modules/crop-editor/CropEditor.components/CropLayoutPreview/CropLayoutPreview.utils";
import { useCapturePreviewShallow, useProfilesShallow } from "~/renderer/store";

import {
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
  const { selectedSourceId, sources } = useCapturePreviewShallow(
    (capturePreview) => ({
      selectedSourceId: capturePreview.selectedSourceId,
      sources: capturePreview.sources,
    }),
  );
  const [routeParams, setRouteParams] = useState(readAuraRouteParams);
  const routeProfileId = routeParams.get("profileId");
  const routeStartAddingAura = routeParams.get("startAddingAura") === "1";
  const routeAddAuraRequestId = routeParams.get("addAuraRequestId");
  const profile =
    (routeProfileId
      ? profileItems.find((item) => item.id === routeProfileId)
      : null) ?? getSelectedCropLayoutProfile(profileItems, selectedProfileId);
  const { auraOverlayLocked, lockAuraOverlay, showLockHandoffHint } =
    useAuraOverlayLockState();

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
  const {
    dragState,
    handleAuraClick,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleResizePointerCancel,
    handleResizePointerDown,
    handleResizePointerMove,
    handleResizePointerUp,
    resizeState,
  } = useAuraOverlayPlacementEditor({
    profile,
    recordAuraHistory,
    selectPlacement,
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

  const { addingAura, startAddAuraSelection } = useAuraOverlayAddAuraSelection({
    lockAuraOverlay,
    profile,
    recordAuraHistory,
    routeAddAuraRequestId,
    routeStartAddingAura,
    updateProfile,
  });

  const handleAddAuraClick = () => {
    startAddAuraSelection();
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
            auraOverlayLocked={auraOverlayLocked}
            bindAuraVideo={bindAuraVideo}
            canEditAuras={canEditAuras}
            crop={crop}
            dragState={dragState}
            effectiveVideoSize={effectiveVideoSize}
            key={placement.id}
            placement={placement}
            resizeState={resizeState}
            selectedPlacementId={selectedPlacementId}
            stream={stream}
            onAuraClick={handleAuraClick}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onResizePointerCancel={handleResizePointerCancel}
            onResizePointerDown={handleResizePointerDown}
            onResizePointerMove={handleResizePointerMove}
            onResizePointerUp={handleResizePointerUp}
            onVideoSizeChange={handleVideoSizeChange}
          />
        );
      })}
      {canEditAuras && (
        <AuraEditingNotice
          addingAura={addingAura}
          canAddAura={!!profile}
          onAddAura={handleAddAuraClick}
          onLockAuras={handleLockAurasClick}
        />
      )}
      {showLockHandoffHint && auraOverlayLocked && <AuraLockHandoffNotice />}
    </main>
  );
}

export { AuraOverlayPage };
