import { enableMapSet } from "immer";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { createAppMenuSlice } from "~/renderer/modules/app-menu/AppMenu.slice/AppMenu.slice";
import { createAppSetupSlice } from "~/renderer/modules/app-setup";
import { createAuraOverlaySlice } from "~/renderer/modules/aura-overlay/AuraOverlay.slice/AuraOverlay.slice";
import { createBookmarksSlice } from "~/renderer/modules/bookmarks";
import { createCapturePreviewSlice } from "~/renderer/modules/capture-preview/CapturePreview.slice/CapturePreview.slice";
import { createCaptureProfilesSlice } from "~/renderer/modules/capture-profiles/CaptureProfiles.slice/CaptureProfiles.slice";
import { createChangelogSlice } from "~/renderer/modules/changelog/Changelog.slice/Changelog.slice";
import { createClientLogSlice } from "~/renderer/modules/client-log/ClientLog.slice/ClientLog.slice";
import { createCropEditorSlice } from "~/renderer/modules/crop-editor/CropEditor.slice/CropEditor.slice";
import { createEditorSlice } from "~/renderer/modules/editor/Editor.slice/Editor.slice";
import { createManagedRecorderSlice } from "~/renderer/modules/managed-recorder/ManagedRecorder.slice/ManagedRecorder.slice";
import { createOnboardingSlice } from "~/renderer/modules/onboarding";
import { createPoeProcessSlice } from "~/renderer/modules/poe-process/PoeProcess.slice/PoeProcess.slice";
import { createProfilesSlice } from "~/renderer/modules/profiles/Profiles.slice/Profiles.slice";
import { createRecordingStorageSlice } from "~/renderer/modules/recording-storage/RecordingStorage.slice/RecordingStorage.slice";
import { createReplayClipsSlice } from "~/renderer/modules/replay-clips/ReplayClips.slice/ReplayClips.slice";
import { createSavedEditsSlice } from "~/renderer/modules/saved-edits";
import { createSettingsSlice } from "~/renderer/modules/settings/Settings.slice/Settings.slice";
import { createStorageSlice } from "~/renderer/modules/settings/Storage.slice/Storage.slice";
import { createStateTransferSlice } from "~/renderer/modules/state-transfer/StateTransfer.slice/StateTransfer.slice";
import { createUpdaterSlice } from "~/renderer/modules/updater/Updater.slice/Updater.slice";

import type { BoundStore } from "./store.types";

enableMapSet();

const isDev = import.meta.env.DEV;

const withDevtools = isDev
  ? (((fn: Parameters<typeof devtools>[0]) =>
      devtools(fn, {
        maxAge: 5,
      })) as typeof devtools)
  : (((fn: Parameters<typeof devtools>[0]) => fn) as typeof devtools);

export const useBoundStore = create<BoundStore>()(
  withDevtools(
    immer((...args) => {
      const appMenuSlice = createAppMenuSlice(...args);
      const auraOverlaySlice = createAuraOverlaySlice(...args);
      const bookmarksSlice = createBookmarksSlice(...args);
      const appSetupSlice = createAppSetupSlice(...args);
      const profilesSlice = createProfilesSlice(...args);
      const captureProfilesSlice = createCaptureProfilesSlice(...args);
      const cropEditorSlice = createCropEditorSlice(...args);
      const onboardingSlice = createOnboardingSlice(...args);
      const editorSlice = createEditorSlice(...args);
      const capturePreviewSlice = createCapturePreviewSlice(...args);
      const managedRecorderSlice = createManagedRecorderSlice(...args);
      const poeProcessSlice = createPoeProcessSlice(...args);
      const settingsSlice = createSettingsSlice(...args);
      const clientLogSlice = createClientLogSlice(...args);
      const replayClipsSlice = createReplayClipsSlice(...args);
      const stateTransferSlice = createStateTransferSlice(...args);
      const recordingStorageSlice = createRecordingStorageSlice(...args);
      const storageSlice = createStorageSlice(...args);
      const updaterSlice = createUpdaterSlice(...args);
      const changelogSlice = createChangelogSlice(...args);
      const savedEditsSlice = createSavedEditsSlice(...args);

      return {
        ...appMenuSlice,
        ...auraOverlaySlice,
        ...bookmarksSlice,
        ...appSetupSlice,
        ...profilesSlice,
        ...captureProfilesSlice,
        ...cropEditorSlice,
        ...onboardingSlice,
        ...editorSlice,
        ...capturePreviewSlice,
        ...managedRecorderSlice,
        ...poeProcessSlice,
        ...settingsSlice,
        ...clientLogSlice,
        ...replayClipsSlice,
        ...stateTransferSlice,
        ...recordingStorageSlice,
        ...storageSlice,
        ...updaterSlice,
        ...changelogSlice,
        ...savedEditsSlice,
        hydrate: async () => {
          await settingsSlice.settings.hydrate();
          await profilesSlice.profiles.hydrate();
          await captureProfilesSlice.captureProfiles.hydrate();
          await Promise.all([
            appMenuSlice.appMenu.hydrate(),
            appSetupSlice.appSetup.hydrate(),
            onboardingSlice.onboarding.hydrate(),
            cropEditorSlice.cropEditor.hydrate(),
            managedRecorderSlice.managedRecorder.hydrate(),
            poeProcessSlice.poeProcess.hydrate(),
            clientLogSlice.clientLog.hydrate(),
          ]);
        },
        startListeners: () => {
          const unsubscribers = [
            appMenuSlice.appMenu.startListening(),
            capturePreviewSlice.capturePreview.startListening(),
            captureProfilesSlice.captureProfiles.startListening(),
            profilesSlice.profiles.startListening(),
            cropEditorSlice.cropEditor.startListening(),
            managedRecorderSlice.managedRecorder.startListening(),
            poeProcessSlice.poeProcess.startListening(),
            settingsSlice.settings.startListening(),
            clientLogSlice.clientLog.startListening(),
            replayClipsSlice.replayClips.startListening(),
            updaterSlice.updater.startListening(),
          ];

          return () => {
            for (const unsubscribe of unsubscribers) {
              unsubscribe();
            }
          };
        },
      };
    }),
  ),
);
