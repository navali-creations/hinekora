import type { CropRegionSelectionShape } from "~/main/modules/overlay-windows/OverlayWindows.dto";
import { trackEvent } from "~/renderer/modules/umami";

interface OpenRecorderAuraOverlayInput {
  addAuraShape?: CropRegionSelectionShape;
  gameRunning: boolean;
  isRecorderBusy: boolean;
  profileId: string | null;
  startAddingAura: boolean;
}

function openRecorderAuraOverlay({
  addAuraShape,
  gameRunning,
  isRecorderBusy,
  profileId,
  startAddingAura,
}: OpenRecorderAuraOverlayInput): void {
  if (!profileId || !gameRunning || isRecorderBusy) {
    return;
  }

  trackEvent(startAddingAura ? "aura-add-started" : "aura-edit-started", {
    shape: addAuraShape ?? "rect",
    source: "recorder-overlay",
  });
  const showAuraOptions = startAddingAura
    ? ({ startAddingAura: true, addAuraShape: addAuraShape ?? "rect" } as const)
    : undefined;
  void window.electron.overlayWindows
    .setAuraLocked(false)
    .then(() =>
      showAuraOptions
        ? window.electron.overlayWindows.showAura(profileId, showAuraOptions)
        : window.electron.overlayWindows.showAura(profileId),
    )
    .catch((error: unknown) => {
      console.warn("[recorder-overlay] Aura overlay action failed", {
        error,
      });
      trackEvent(startAddingAura ? "aura-add-failed" : "aura-edit-failed", {
        source: "recorder-overlay",
      });
    });
}

function closeRecorderOverlay(): void {
  trackEvent("recorder-overlay-closed", {
    source: "overlay",
  });
  void window.electron.overlayWindows.hideRecorder();
}

export { closeRecorderOverlay, openRecorderAuraOverlay };
