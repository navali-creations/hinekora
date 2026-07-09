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
  const hydrateSettings = useBoundStore((state) => state.settings.hydrate);
  const startSettingsListener = useBoundStore(
    (state) => state.settings.startListening,
  );
  const hydratePoeProcess = useBoundStore((state) => state.poeProcess.hydrate);
  const startPoeProcessListener = useBoundStore(
    (state) => state.poeProcess.startListening,
  );
  const startCapturePreviewListener = useBoundStore(
    (state) => state.capturePreview.startListening,
  );

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    let disposed = false;

    if (isRecorderOverlay) {
      void (async () => {
        await hydrateSettings();
        await Promise.all([
          hydrateManagedRecorder(),
          hydrateProfiles(),
          hydrateReplayClips(),
        ]);
      })();
      unsubscribers.push(
        startManagedRecorderListener(),
        startProfilesListener(),
        startReplayClipsListener(),
        startSettingsListener(),
      );
    } else if (isClipPreviewOverlay) {
      void hydrateSettings();
      unsubscribers.push(startSettingsListener());
    } else if (isAuraOverlay) {
      void (async () => {
        await hydrateSettings();
        await Promise.all([hydrateProfiles(), hydratePoeProcess()]);
        if (disposed) {
          return;
        }

        unsubscribers.push(
          startCapturePreviewListener({ refreshOnStart: true }),
        );
      })();
      unsubscribers.push(
        startPoeProcessListener(),
        startProfilesListener(),
        startSettingsListener(),
      );
    }

    return () => {
      disposed = true;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [
    hydrateManagedRecorder,
    hydrateProfiles,
    hydratePoeProcess,
    hydrateReplayClips,
    hydrateSettings,
    isClipPreviewOverlay,
    isAuraOverlay,
    isRecorderOverlay,
    startCapturePreviewListener,
    startManagedRecorderListener,
    startPoeProcessListener,
    startProfilesListener,
    startReplayClipsListener,
    startSettingsListener,
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
