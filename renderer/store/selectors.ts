import { useShallow } from "zustand/react/shallow";

import { useBoundStore } from "./store";
import type { BoundStore } from "./store.types";

export function useRootActions() {
  return useBoundStore(
    useShallow((state) => ({
      hydrate: state.hydrate,
      startListeners: state.startListeners,
    })),
  );
}

export const useAppMenuShallow = <T>(
  selector: (appMenu: BoundStore["appMenu"]) => T,
) => useBoundStore(useShallow((state) => selector(state.appMenu)));

export const useAuraOverlayShallow = <T>(
  selector: (auraOverlay: BoundStore["auraOverlay"]) => T,
) => useBoundStore(useShallow((state) => selector(state.auraOverlay)));

export const useAppSetupShallow = <T>(
  selector: (appSetup: BoundStore["appSetup"]) => T,
) => useBoundStore(useShallow((state) => selector(state.appSetup)));

export const useOnboardingState = () =>
  useBoundStore(
    useShallow((state) => ({
      dismissedBeacons: state.onboarding.dismissedBeacons,
      isLoading: state.onboarding.isLoading,
      error: state.onboarding.error,
      beaconHostRefreshKey: state.onboarding.beaconHostRefreshKey,
    })),
  );

export const useOnboardingActions = () =>
  useBoundStore(
    useShallow((state) => ({
      dismiss: state.onboarding.dismiss,
      dismissAll: state.onboarding.dismissAll,
      resetOne: state.onboarding.resetOne,
      resetAll: state.onboarding.resetAll,
      refreshBeaconHost: state.onboarding.refreshBeaconHost,
    })),
  );

export const useProfilesShallow = <T>(
  selector: (profiles: BoundStore["profiles"]) => T,
) => useBoundStore(useShallow((state) => selector(state.profiles)));

export const useCaptureProfilesShallow = <T>(
  selector: (captureProfiles: BoundStore["captureProfiles"]) => T,
) => useBoundStore(useShallow((state) => selector(state.captureProfiles)));

export const useCropEditorSelector = <T>(
  selector: (cropEditor: BoundStore["cropEditor"]) => T,
) => useBoundStore((state) => selector(state.cropEditor));
export const useCropEditorShallow = <T>(
  selector: (cropEditor: BoundStore["cropEditor"]) => T,
) => useBoundStore(useShallow((state) => selector(state.cropEditor)));

export const useEditorSelector = <T>(
  selector: (editor: BoundStore["editor"]) => T,
) => useBoundStore((state) => selector(state.editor));
export const useEditorShallow = <T>(
  selector: (editor: BoundStore["editor"]) => T,
) => useBoundStore(useShallow((state) => selector(state.editor)));

export const useCapturePreviewSelector = <T>(
  selector: (capturePreview: BoundStore["capturePreview"]) => T,
) => useBoundStore((state) => selector(state.capturePreview));
export const useCapturePreviewShallow = <T>(
  selector: (capturePreview: BoundStore["capturePreview"]) => T,
) => useBoundStore(useShallow((state) => selector(state.capturePreview)));

export const useManagedRecorderSelector = <T>(
  selector: (managedRecorder: BoundStore["managedRecorder"]) => T,
) => useBoundStore((state) => selector(state.managedRecorder));
export const useManagedRecorderShallow = <T>(
  selector: (managedRecorder: BoundStore["managedRecorder"]) => T,
) => useBoundStore(useShallow((state) => selector(state.managedRecorder)));

export const useSettingsSelector = <T>(
  selector: (settings: BoundStore["settings"]) => T,
) => useBoundStore((state) => selector(state.settings));
export const useSettingsShallow = <T>(
  selector: (settings: BoundStore["settings"]) => T,
) => useBoundStore(useShallow((state) => selector(state.settings)));

export const useClientLogSelector = <T>(
  selector: (clientLog: BoundStore["clientLog"]) => T,
) => useBoundStore((state) => selector(state.clientLog));
export const useClientLogShallow = <T>(
  selector: (clientLog: BoundStore["clientLog"]) => T,
) => useBoundStore(useShallow((state) => selector(state.clientLog)));

export const usePoeProcessSelector = <T>(
  selector: (poeProcess: BoundStore["poeProcess"]) => T,
) => useBoundStore((state) => selector(state.poeProcess));

export const useReplayClipsSelector = <T>(
  selector: (replayClips: BoundStore["replayClips"]) => T,
) => useBoundStore((state) => selector(state.replayClips));
export const useReplayClipsShallow = <T>(
  selector: (replayClips: BoundStore["replayClips"]) => T,
) => useBoundStore(useShallow((state) => selector(state.replayClips)));

export const useRecordingStorageSelector = <T>(
  selector: (recordingStorage: BoundStore["recordingStorage"]) => T,
) => useBoundStore((state) => selector(state.recordingStorage));
export const useRecordingStorageShallow = <T>(
  selector: (recordingStorage: BoundStore["recordingStorage"]) => T,
) => useBoundStore(useShallow((state) => selector(state.recordingStorage)));

export const useStorageShallow = <T>(
  selector: (storage: BoundStore["storage"]) => T,
) => useBoundStore(useShallow((state) => selector(state.storage)));

export const useUpdaterShallow = <T>(
  selector: (updater: BoundStore["updater"]) => T,
) => useBoundStore(useShallow((state) => selector(state.updater)));

export const useChangelogShallow = <T>(
  selector: (changelog: BoundStore["changelog"]) => T,
) => useBoundStore(useShallow((state) => selector(state.changelog)));

export const useSavedEditsShallow = <T>(
  selector: (savedEdits: BoundStore["savedEdits"]) => T,
) => useBoundStore(useShallow((state) => selector(state.savedEdits)));

export const useStateTransferShallow = <T>(
  selector: (stateTransfer: BoundStore["stateTransfer"]) => T,
) => useBoundStore(useShallow((state) => selector(state.stateTransfer)));
