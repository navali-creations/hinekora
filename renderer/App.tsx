import { useEffect } from "react";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { AuraOverlayPage } from "~/renderer/modules/aura-overlay/AuraOverlay.page/AuraOverlay.page";
import { ClipPreviewOverlayPage } from "~/renderer/modules/clip-preview-overlay/ClipPreviewOverlay.page/ClipPreviewOverlay.page";
import { CropSelectorOverlayPage } from "~/renderer/modules/crop-selector-overlay/CropSelectorOverlay.page/CropSelectorOverlay.page";
import { RecorderControlsOverlayPage } from "~/renderer/modules/recorder-controls-overlay/RecorderControlsOverlay.page/RecorderControlsOverlay.page";
import { ReplayStatusOverlayPage } from "~/renderer/modules/replay-status-overlay/ReplayStatusOverlay.page/ReplayStatusOverlay.page";
import { useBoundStore } from "~/renderer/store";
import { getOverlayRendererRoute } from "~/renderer/utils/overlay-window";

function App() {
  const windowName = getOverlayRendererRoute(window.location.hash)?.name;
  const isRecorderOverlay = windowName === WindowName.RecorderOverlay;
  const isReplayStatusOverlay = windowName === WindowName.ReplayStatusOverlay;
  const isClipPreviewOverlay = windowName === WindowName.ClipPreviewOverlay;
  const isCropSelectorOverlay = windowName === WindowName.CropSelectorOverlay;
  const isAuraOverlay = windowName === WindowName.AuraOverlay;
  const hydrateManagedRecorder = useBoundStore(
    (state) => state.managedRecorder.hydrate,
  );
  const startManagedRecorderListener = useBoundStore(
    (state) => state.managedRecorder.startListening,
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
        await Promise.all([hydrateManagedRecorder(), hydrateProfiles()]);
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

  if (isReplayStatusOverlay) {
    return <ReplayStatusOverlayPage />;
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
