import { useEffect } from "react";

import { AuraOverlayPage } from "~/renderer/modules/aura-overlay/AuraOverlay.page/AuraOverlay.page";
import { ClipPreviewOverlayPage } from "~/renderer/modules/clip-preview-overlay/ClipPreviewOverlay.page/ClipPreviewOverlay.page";
import { CropSelectorOverlayPage } from "~/renderer/modules/crop-selector-overlay/CropSelectorOverlay.page/CropSelectorOverlay.page";
import { RecorderControlsOverlayPage } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.page/RecorderControlsOverlay.page";
import { useBoundStore } from "~/renderer/store";

function App() {
  const isRecorderOverlay = window.location.hash.includes("recorder-overlay");
  const isClipPreviewOverlay = window.location.hash.includes(
    "clip-preview-overlay",
  );
  const isCropSelectorOverlay = window.location.hash.includes(
    "crop-selector-overlay",
  );
  const isAuraOverlay = window.location.hash.includes("aura-overlay");
  const hydrateManagedRecorder = useBoundStore(
    (state) => state.managedRecorder.hydrate,
  );
  const startManagedRecorderListener = useBoundStore(
    (state) => state.managedRecorder.startListening,
  );
  const hydrateReplayClips = useBoundStore(
    (state) => state.replayClips.hydrate,
  );
  const startReplayClipsListener = useBoundStore(
    (state) => state.replayClips.startListening,
  );
  const hydrateProfiles = useBoundStore((state) => state.profiles.hydrate);
  const startProfilesListener = useBoundStore(
    (state) => state.profiles.startListening,
  );
  const refreshCapturePreview = useBoundStore(
    (state) => state.capturePreview.refresh,
  );

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    if (isRecorderOverlay) {
      void Promise.all([
        hydrateManagedRecorder(),
        hydrateProfiles(),
        hydrateReplayClips(),
      ]);
      unsubscribers.push(
        startManagedRecorderListener(),
        startProfilesListener(),
        startReplayClipsListener(),
      );
    } else if (isClipPreviewOverlay) {
      void hydrateReplayClips();
      unsubscribers.push(startReplayClipsListener());
    } else if (isAuraOverlay) {
      void (async () => {
        await hydrateProfiles();
        await refreshCapturePreview();
      })();
      unsubscribers.push(startProfilesListener());
    }

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [
    hydrateManagedRecorder,
    hydrateProfiles,
    hydrateReplayClips,
    isClipPreviewOverlay,
    isAuraOverlay,
    isRecorderOverlay,
    refreshCapturePreview,
    startManagedRecorderListener,
    startProfilesListener,
    startReplayClipsListener,
  ]);

  if (isRecorderOverlay) {
    return <RecorderControlsOverlayPage />;
  }

  if (isClipPreviewOverlay) {
    return <ClipPreviewOverlayPage />;
  }

  if (isCropSelectorOverlay) {
    return <CropSelectorOverlayPage />;
  }

  if (isAuraOverlay) {
    return <AuraOverlayPage />;
  }

  return null;
}

export { App };
