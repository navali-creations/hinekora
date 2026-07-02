import { contextBridge } from "electron";

import { AppAPI } from "~/main/modules/app/App.api";
import { AppSetupAPI } from "~/main/modules/app-setup/AppSetup.api";
import { CapturePreviewAPI } from "~/main/modules/capture-preview/CapturePreview.api";
import { CaptureProfilesAPI } from "~/main/modules/capture-profiles/CaptureProfiles.api";
import { ClientLogAPI } from "~/main/modules/client-log/ClientLog.api";
import { DiagLogAPI } from "~/main/modules/diag-log/DiagLog.api";
import { EditorAPI } from "~/main/modules/editor/Editor.api";
import { MainWindowAPI } from "~/main/modules/main-window/MainWindow.api";
import { ManagedRecorderAPI } from "~/main/modules/managed-recorder/ManagedRecorder.api";
import { OverlayWindowsAPI } from "~/main/modules/overlay-windows/OverlayWindows.api";
import { PoeProcessAPI } from "~/main/modules/poe-process/PoeProcess.api";
import { ProfilesAPI } from "~/main/modules/profiles/Profiles.api";
import { RecordingStorageAPI } from "~/main/modules/recording-storage/RecordingStorage.api";
import { ReplayClipsAPI } from "~/main/modules/replay-clips/ReplayClips.api";
import { SavedEditsAPI } from "~/main/modules/saved-edits/SavedEdits.api";
import { SettingsStoreAPI } from "~/main/modules/settings-store/SettingsStore.api";
import { StateTransferAPI } from "~/main/modules/state-transfer/StateTransfer.api";
import { StorageAPI } from "~/main/modules/storage/Storage.api";
import { UpdaterAPI } from "~/main/modules/updater/Updater.api";

const fullApi = {
  app: AppAPI,
  appSetup: AppSetupAPI,
  capturePreview: CapturePreviewAPI,
  captureProfiles: CaptureProfilesAPI,
  clientLog: ClientLogAPI,
  diagLog: DiagLogAPI,
  editor: EditorAPI,
  mainWindow: MainWindowAPI,
  managedRecorder: ManagedRecorderAPI,
  overlayWindows: OverlayWindowsAPI,
  poeProcess: PoeProcessAPI,
  profiles: ProfilesAPI,
  recordingStorage: RecordingStorageAPI,
  replayClips: ReplayClipsAPI,
  savedEdits: SavedEditsAPI,
  settings: SettingsStoreAPI,
  storage: StorageAPI,
  stateTransfer: StateTransferAPI,
  updater: UpdaterAPI,
};

type ElectronAPI = typeof fullApi;
type ScopedElectronAPI = {
  [K in keyof ElectronAPI]?: Partial<ElectronAPI[K]>;
};

function createScopedApi(hash: string): ElectronAPI | ScopedElectronAPI {
  if (hash.includes("recorder-overlay")) {
    return {
      managedRecorder: {
        getCaptureMode: ManagedRecorderAPI.getCaptureMode,
        getStatus: ManagedRecorderAPI.getStatus,
        onCaptureModeChanged: ManagedRecorderAPI.onCaptureModeChanged,
        setCaptureMode: ManagedRecorderAPI.setCaptureMode,
        startBuffer: ManagedRecorderAPI.startBuffer,
        startRunRecording: ManagedRecorderAPI.startRunRecording,
        stopBuffer: ManagedRecorderAPI.stopBuffer,
        stopRunRecording: ManagedRecorderAPI.stopRunRecording,
        onStatusChanged: ManagedRecorderAPI.onStatusChanged,
      },
      overlayWindows: {
        getRecorderMode: OverlayWindowsAPI.getRecorderMode,
        hideRecorder: OverlayWindowsAPI.hideRecorder,
        isAuraLocked: OverlayWindowsAPI.isAuraLocked,
        onRecorderModeChanged: OverlayWindowsAPI.onRecorderModeChanged,
        onAuraLockChanged: OverlayWindowsAPI.onAuraLockChanged,
        setRecorderMode: OverlayWindowsAPI.setRecorderMode,
        setAuraLocked: OverlayWindowsAPI.setAuraLocked,
        showAura: OverlayWindowsAPI.showAura,
      },
      profiles: {
        list: ProfilesAPI.list,
        onChanged: ProfilesAPI.onChanged,
      },
      replayClips: {
        list: ReplayClipsAPI.list,
        saveManualReplay: ReplayClipsAPI.saveManualReplay,
        onStatusChanged: ReplayClipsAPI.onStatusChanged,
      },
    };
  }

  if (hash.includes("clip-preview-overlay")) {
    return {
      mainWindow: {
        openEditorClip: MainWindowAPI.openEditorClip,
      },
      overlayWindows: {
        hideClipPreview: OverlayWindowsAPI.hideClipPreview,
      },
      replayClips: {
        list: ReplayClipsAPI.list,
        open: ReplayClipsAPI.open,
        reveal: ReplayClipsAPI.reveal,
        onStatusChanged: ReplayClipsAPI.onStatusChanged,
      },
    };
  }

  if (hash.includes("aura-overlay")) {
    return {
      capturePreview: {
        listSources: CapturePreviewAPI.listSources,
        sourceExists: CapturePreviewAPI.sourceExists,
      },
      overlayWindows: {
        isAuraLocked: OverlayWindowsAPI.isAuraLocked,
        onAuraAddRequested: OverlayWindowsAPI.onAuraAddRequested,
        onAuraLockChanged: OverlayWindowsAPI.onAuraLockChanged,
        selectCropRegion: OverlayWindowsAPI.selectCropRegion,
        setAuraLocked: OverlayWindowsAPI.setAuraLocked,
        showAura: OverlayWindowsAPI.showAura,
      },
      profiles: {
        list: ProfilesAPI.list,
        update: ProfilesAPI.update,
        onChanged: ProfilesAPI.onChanged,
      },
    };
  }

  if (hash.includes("crop-selector-overlay")) {
    return {
      overlayWindows: {
        completeCropRegionSelection:
          OverlayWindowsAPI.completeCropRegionSelection,
        cancelCropRegionSelection: OverlayWindowsAPI.cancelCropRegionSelection,
      },
    };
  }

  return fullApi;
}

const api = createScopedApi(globalThis.location?.hash ?? "");

contextBridge.exposeInMainWorld("electron", api);

export type { ElectronAPI };
