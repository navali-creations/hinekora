import clsx from "clsx";
import type { PointerEvent, SyntheticEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDesktopCaptureStream } from "~/renderer/modules/capture-preview/CapturePreview.hooks/useDesktopCaptureStream/useDesktopCaptureStream";
import { resolveCapturePreviewSourceId } from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import { getSelectedCropLayoutProfile } from "~/renderer/modules/crop-editor/CropEditor.components/CropLayoutPreview/CropLayoutPreview.utils";
import { createAuraProfileUpdateFromSelection } from "~/renderer/modules/crop-editor/CropEditor.utils/CropEditor.utils";
import { useCapturePreviewShallow, useProfilesShallow } from "~/renderer/store";

import type { OverlayPlacement } from "~/types";
import {
  type AuraResizeCorner,
  type AuraVideoSize,
  auraResizeCorners,
  createAuraPreviewConstraints,
  createAuraVideoStyle,
  readAuraVideoSize,
  resizeAuraPlacementFromCorner,
} from "./AuraOverlay.page.utils";
import styles from "./AuraOverlayPage.module.css";

interface DragState {
  placementId: string;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  deltaX: number;
  deltaY: number;
}

interface ResizeState {
  placementId: string;
  corner: AuraResizeCorner;
  startX: number;
  startY: number;
  initialPlacement: OverlayPlacement;
  draftPlacement: OverlayPlacement;
}

interface VideoSizeState {
  sourceId: string | null;
  value: AuraVideoSize | null;
}

const auraOverlayRouteClassName = "is-aura-overlay-route";
const auraResizeCornerClassNames: Record<AuraResizeCorner, string> = {
  nw: styles.resizeHandleNw ?? "",
  ne: styles.resizeHandleNe ?? "",
  sw: styles.resizeHandleSw ?? "",
  se: styles.resizeHandleSe ?? "",
};

function isAuraResizeCorner(
  value: string | undefined,
): value is AuraResizeCorner {
  return auraResizeCorners.includes(value as AuraResizeCorner);
}

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
  const routeParams = useMemo(
    () => new URLSearchParams(window.location.hash.split("?")[1] ?? ""),
    [],
  );
  const routeProfileId = routeParams.get("profileId");
  const routePlacementId = routeParams.get("placementId");
  const profile =
    (routeProfileId
      ? profileItems.find((item) => item.id === routeProfileId)
      : null) ?? getSelectedCropLayoutProfile(profileItems, selectedProfileId);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [addingAura, setAddingAura] = useState(false);
  const [auraOverlayLocked, setAuraOverlayLocked] = useState(true);
  const [videoSizeState, setVideoSizeState] = useState<VideoSizeState>({
    sourceId: null,
    value: null,
  });
  const pendingPreviewRef = useRef<{
    profileId: string;
    placement: OverlayPlacement;
  } | null>(null);
  const previewFrameRef = useRef<number | null>(null);

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
  const videoSize =
    videoSizeState.sourceId === captureSourceId ? videoSizeState.value : null;
  const effectiveVideoSize = videoSize ??
    captureSourceVideoSize ?? { width: 1920, height: 1080 };

  const emptyMessage = !profile
    ? "No profile loaded"
    : profile.overlayPlacements.filter(
          (placement) => !routePlacementId || placement.id === routePlacementId,
        ).length === 0
      ? "No aura positions configured"
      : null;
  const isPlacementWindow = routePlacementId !== null;
  const canEditAuras = !auraOverlayLocked && !isPlacementWindow;
  const { stream } = useDesktopCaptureStream({
    sourceId: captureSourceId,
    enabled: Boolean(captureSourceId && !emptyMessage),
    createConstraints: createAuraPreviewConstraints,
  });

  const bindAuraVideo = useCallback(
    (element: HTMLVideoElement | null) => {
      if (!element || !stream) {
        return;
      }

      element.srcObject = stream;
      const currentSize = readAuraVideoSize(element);
      if (currentSize) {
        setVideoSizeState({ sourceId: captureSourceId, value: currentSize });
      }
      void element
        .play()
        .then(() => {
          const nextSize = readAuraVideoSize(element);
          if (nextSize) {
            setVideoSizeState({ sourceId: captureSourceId, value: nextSize });
          }
        })
        .catch(() => {});
    },
    [captureSourceId, stream],
  );

  const handleVideoSizeChange = (event: SyntheticEvent<HTMLVideoElement>) => {
    const nextSize = readAuraVideoSize(event.currentTarget);
    if (nextSize) {
      setVideoSizeState({ sourceId: captureSourceId, value: nextSize });
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!profile || resizeState || event.button !== 0) {
      return;
    }

    const placementId = event.currentTarget.dataset.placementId;
    const placement = profile.overlayPlacements.find(
      (item) => item.id === placementId,
    );

    if (!placement) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      placementId: placement.id,
      startX: event.clientX,
      startY: event.clientY,
      initialX: placement.x,
      initialY: placement.y,
      deltaX: 0,
      deltaY: 0,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragState) {
      return;
    }

    setDragState({
      ...dragState,
      deltaX: event.clientX - dragState.startX,
      deltaY: event.clientY - dragState.startY,
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!profile || !dragState) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const x = Math.max(0, Math.round(dragState.initialX + dragState.deltaX));
    const y = Math.max(0, Math.round(dragState.initialY + dragState.deltaY));
    const placementId = dragState.placementId;
    setDragState(null);

    void updateProfile({
      id: profile.id,
      overlayPlacements: profile.overlayPlacements.map((placement) =>
        placement.id === placementId ? { ...placement, x, y } : placement,
      ),
    });
  };

  const handlePointerCancel = () => {
    setDragState(null);
  };

  const queueAuraPlacementPreview = useCallback(
    (profileId: string, placement: OverlayPlacement) => {
      pendingPreviewRef.current = { profileId, placement };
      if (previewFrameRef.current !== null) {
        return;
      }

      previewFrameRef.current = window.requestAnimationFrame(() => {
        previewFrameRef.current = null;
        const pending = pendingPreviewRef.current;
        pendingPreviewRef.current = null;
        if (pending) {
          void window.electron.overlayWindows.previewAuraPlacement(
            pending.profileId,
            pending.placement,
          );
        }
      });
    },
    [],
  );

  const cancelPendingAuraPlacementPreview = useCallback(() => {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
    }
    previewFrameRef.current = null;
    pendingPreviewRef.current = null;
  }, []);

  const handleResizePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!profile || event.button !== 0) {
      return;
    }

    const placementId = event.currentTarget.dataset.placementId;
    const corner = event.currentTarget.dataset.corner;
    const placement = profile.overlayPlacements.find(
      (item) => item.id === placementId,
    );
    if (!placement || !isAuraResizeCorner(corner)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState(null);
    setResizeState({
      placementId: placement.id,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      initialPlacement: placement,
      draftPlacement: placement,
    });
  };

  const handleResizePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!profile || !resizeState) {
      return;
    }

    event.stopPropagation();
    const crop = profile.cropRegions.find(
      (region) => region.id === resizeState.initialPlacement.cropRegionId,
    );
    if (!crop) {
      return;
    }

    const draftPlacement = resizeAuraPlacementFromCorner(
      crop,
      resizeState.initialPlacement,
      resizeState.corner,
      event.clientX - resizeState.startX,
      event.clientY - resizeState.startY,
    );

    setResizeState({ ...resizeState, draftPlacement });
    if (isPlacementWindow) {
      queueAuraPlacementPreview(profile.id, draftPlacement);
    }
  };

  const handleResizePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!profile || !resizeState) {
      return;
    }

    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const placementId = resizeState.placementId;
    const draftPlacement = resizeState.draftPlacement;
    cancelPendingAuraPlacementPreview();
    setResizeState(null);

    void updateProfile({
      id: profile.id,
      overlayPlacements: profile.overlayPlacements.map((placement) =>
        placement.id === placementId ? draftPlacement : placement,
      ),
    }).then(() => window.electron.overlayWindows.showAura(profile.id));
  };

  const handleResizePointerCancel = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    cancelPendingAuraPlacementPreview();
    if (profile && resizeState && isPlacementWindow) {
      void window.electron.overlayWindows.previewAuraPlacement(
        profile.id,
        resizeState.initialPlacement,
      );
    }
    setResizeState(null);
  };

  useEffect(
    () => cancelPendingAuraPlacementPreview,
    [cancelPendingAuraPlacementPreview],
  );

  useEffect(() => {
    let disposed = false;

    void window.electron.overlayWindows
      .isAuraLocked()
      .then((locked) => {
        if (!disposed) {
          setAuraOverlayLocked(locked);
        }
      })
      .catch(() => {});

    const unsubscribe =
      window.electron.overlayWindows.onAuraLockChanged(setAuraOverlayLocked);

    return () => {
      disposed = true;
      unsubscribe();
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
    setAuraOverlayLocked(true);
    void window.electron.overlayWindows
      .setAuraLocked(true)
      .catch(() => setAuraOverlayLocked(false));
  };

  const handleAddAuraClick = () => {
    if (!profile || addingAura) {
      return;
    }

    setAddingAura(true);
    void window.electron.overlayWindows
      .selectCropRegion()
      .then(async (selection) => {
        if (!selection) {
          return;
        }

        const { profileUpdate } = createAuraProfileUpdateFromSelection(
          profile,
          selection,
        );

        await updateProfile(profileUpdate);
        await window.electron.overlayWindows.showAura(profile.id);
      })
      .catch(() => {})
      .finally(() => setAddingAura(false));
  };

  return (
    <main
      aria-label="Aura overlay"
      className={clsx(styles.overlay, canEditAuras && styles.overlayEditing)}
      role="application"
    >
      {profile?.overlayPlacements.map((placement) => {
        if (routePlacementId && placement.id !== routePlacementId) {
          return null;
        }

        const crop = profile.cropRegions.find(
          (region) => region.id === placement.cropRegionId,
        );
        if (!crop) {
          return null;
        }

        const effectivePlacement =
          resizeState?.placementId === placement.id
            ? resizeState.draftPlacement
            : placement;
        const isDragging = dragState?.placementId === placement.id;
        const x = isPlacementWindow
          ? 0
          : isDragging
            ? dragState.initialX + dragState.deltaX
            : effectivePlacement.x;
        const y = isPlacementWindow
          ? 0
          : isDragging
            ? dragState.initialY + dragState.deltaY
            : effectivePlacement.y;
        const isResizing = resizeState?.placementId === placement.id;
        const width = Math.round(crop.width * effectivePlacement.scale);
        const height = Math.round(crop.height * effectivePlacement.scale);
        const left = Math.round(x);
        const top = Math.round(y);

        return (
          <div
            className={styles.boxFrame}
            data-placement-id={placement.id}
            key={placement.id}
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${crop.width * effectivePlacement.scale}px`,
              height: `${crop.height * effectivePlacement.scale}px`,
            }}
          >
            <button
              className={clsx(
                styles.box,
                auraOverlayLocked && styles.boxLocked,
                isPlacementWindow && styles.boxWindow,
              )}
              data-placement-id={placement.id}
              style={{
                opacity: effectivePlacement.opacity,
              }}
              type="button"
              onPointerCancel={canEditAuras ? handlePointerCancel : undefined}
              onPointerDown={canEditAuras ? handlePointerDown : undefined}
              onPointerMove={canEditAuras ? handlePointerMove : undefined}
              onPointerUp={canEditAuras ? handlePointerUp : undefined}
            >
              {stream && (
                <video
                  aria-label={crop.label}
                  className={styles.video}
                  muted
                  playsInline
                  ref={bindAuraVideo}
                  style={createAuraVideoStyle(
                    crop,
                    effectivePlacement,
                    effectiveVideoSize,
                  )}
                  onLoadedMetadata={handleVideoSizeChange}
                  onResize={handleVideoSizeChange}
                />
              )}
              {canEditAuras &&
                auraResizeCorners.map((corner) => (
                  <span
                    aria-hidden="true"
                    className={clsx(
                      styles.resizeHandle,
                      auraResizeCornerClassNames[corner],
                    )}
                    data-corner={corner}
                    data-placement-id={placement.id}
                    key={corner}
                    onPointerCancel={handleResizePointerCancel}
                    onPointerDown={handleResizePointerDown}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerUp}
                  />
                ))}
            </button>
            {!auraOverlayLocked && (
              <span className={styles.label}>{crop.label}</span>
            )}
            {!auraOverlayLocked && isResizing && (
              <span className={styles.resizeReadout}>
                x: {left} y: {top}
                <br />
                {width} x {height}
              </span>
            )}
          </div>
        );
      })}
      {canEditAuras && (
        <div className={styles.editingNotice} role="status">
          <div className={styles.editingText}>
            <span className={styles.editingTitle}>Currently editing auras</span>
            <span className={styles.editingNote}>
              Add auras or lock to regain game control.
            </span>
          </div>
          <div className={styles.editingActions}>
            <button
              className={styles.addButton}
              disabled={!profile || addingAura}
              type="button"
              onClick={handleAddAuraClick}
            >
              {addingAura ? "Selecting..." : "Add new aura"}
            </button>
            <button
              className={styles.lockButton}
              type="button"
              onClick={handleLockAurasClick}
            >
              Lock auras
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export { AuraOverlayPage };
