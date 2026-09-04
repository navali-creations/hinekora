import { contextBridge } from "electron";

import { AppAPI } from "~/main/modules/app/App.api";
import { AppSetupAPI } from "~/main/modules/app-setup/AppSetup.api";
import { BookmarksAPI } from "~/main/modules/bookmarks/Bookmarks.api";
import { CapturePreviewAPI } from "~/main/modules/capture-preview/CapturePreview.api";
import { CaptureProfilesAPI } from "~/main/modules/capture-profiles/CaptureProfiles.api";
import { ClientLogAPI } from "~/main/modules/client-log/ClientLog.api";
import { DiagLogAPI } from "~/main/modules/diag-log/DiagLog.api";
import { EditorAPI } from "~/main/modules/editor/Editor.api";
import { KeybindsAPI } from "~/main/modules/keybinds/Keybinds.api";
import { MainWindowAPI } from "~/main/modules/main-window/MainWindow.api";
import { ManagedRecorderAPI } from "~/main/modules/managed-recorder/ManagedRecorder.api";
import { OverlayWindowsAPI } from "~/main/modules/overlay-windows/OverlayWindows.api";
import { PoeLeaguesAPI } from "~/main/modules/poe-leagues/PoeLeagues.api";
import { PoeProcessAPI } from "~/main/modules/poe-process/PoeProcess.api";
import { ProfilesAPI } from "~/main/modules/profiles/Profiles.api";
import { RecordingStorageAPI } from "~/main/modules/recording-storage/RecordingStorage.api";
import { ReplayClipsAPI } from "~/main/modules/replay-clips/ReplayClips.api";
import { ReplayStatusOverlayAPI } from "~/main/modules/replay-status-overlay/ReplayStatusOverlay.api";
import { SavedEditsAPI } from "~/main/modules/saved-edits/SavedEdits.api";
import { SavedVideosAPI } from "~/main/modules/saved-videos/SavedVideos.api";
import {
  SettingsStoreAPI,
  SettingsStoreClipPreviewOverlayAPI,
  SettingsStoreOverlayAPI,
  SettingsStoreRecorderOverlayAPI,
} from "~/main/modules/settings-store/SettingsStore.api";
import { StateTransferAPI } from "~/main/modules/state-transfer/StateTransfer.api";
import { StorageAPI } from "~/main/modules/storage/Storage.api";
import { UpdaterAPI } from "~/main/modules/updater/Updater.api";

const fullApi = {
  app: AppAPI,
  appSetup: AppSetupAPI,
  bookmarks: BookmarksAPI,
  capturePreview: CapturePreviewAPI,
  captureProfiles: CaptureProfilesAPI,
  clientLog: ClientLogAPI,
  diagLog: DiagLogAPI,
  editor: EditorAPI,
  keybinds: KeybindsAPI,
  mainWindow: MainWindowAPI,
  managedRecorder: ManagedRecorderAPI,
  overlayWindows: OverlayWindowsAPI,
  poeLeagues: PoeLeaguesAPI,
  poeProcess: PoeProcessAPI,
  profiles: ProfilesAPI,
  recordingStorage: RecordingStorageAPI,
  replayClips: ReplayClipsAPI,
  savedEdits: SavedEditsAPI,
  savedVideos: SavedVideosAPI,
  settings: SettingsStoreAPI,
  storage: StorageAPI,
  stateTransfer: StateTransferAPI,
  updater: UpdaterAPI,
};

function createScopedApi(hash: string) {
  if (hash.includes("replay-status-overlay")) {
    return {
      replayStatusOverlay: ReplayStatusOverlayAPI,
    };
  }

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
      bookmarks: {
        createManual: BookmarksAPI.createManual,
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
        select: ProfilesAPI.select,
        onChanged: ProfilesAPI.onChanged,
      },
      settings: SettingsStoreRecorderOverlayAPI,
      replayClips: {
        saveManualReplay: ReplayClipsAPI.saveManualReplay,
        onDeleted: ReplayClipsAPI.onDeleted,
        onStatusChanged: ReplayClipsAPI.onStatusChanged,
      },
    };
  }

  if (hash.includes("clip-preview-overlay")) {
    return {
      diagLog: {
        writeClipPreviewEvent: DiagLogAPI.writeClipPreviewEvent,
      },
      mainWindow: {
        openEditorClip: MainWindowAPI.openEditorClip,
        openClip: MainWindowAPI.openClip,
      },
      overlayWindows: {
        hideClipPreview: OverlayWindowsAPI.hideClipPreview,
        onClipPreviewFullscreenChanged:
          OverlayWindowsAPI.onClipPreviewFullscreenChanged,
        toggleClipPreviewFullscreen:
          OverlayWindowsAPI.toggleClipPreviewFullscreen,
      },
      settings: SettingsStoreClipPreviewOverlayAPI,
      replayClips: {
        copy: ReplayClipsAPI.copy,
        get: ReplayClipsAPI.get,
        onOperationProgress: ReplayClipsAPI.onOperationProgress,
        onPreviewProgress: ReplayClipsAPI.onPreviewProgress,
        onStatusChanged: ReplayClipsAPI.onStatusChanged,
        update: ReplayClipsAPI.update,
        reveal: ReplayClipsAPI.reveal,
      },
    };
  }

  if (hash.includes("aura-overlay")) {
    return {
      capturePreview: {
        listSources: CapturePreviewAPI.listSources,
        onRefreshRequested: CapturePreviewAPI.onRefreshRequested,
        prepareDisplayMediaSource: CapturePreviewAPI.prepareDisplayMediaSource,
        reportFailure: CapturePreviewAPI.reportFailure,
      },
      overlayWindows: {
        isAuraLocked: OverlayWindowsAPI.isAuraLocked,
        onAuraAddRequested: OverlayWindowsAPI.onAuraAddRequested,
        onAuraLockChanged: OverlayWindowsAPI.onAuraLockChanged,
        selectCropRegion: OverlayWindowsAPI.selectCropRegion,
        setAuraLocked: OverlayWindowsAPI.setAuraLocked,
        showAura: OverlayWindowsAPI.showAura,
      },
      poeProcess: {
        getSnapshot: PoeProcessAPI.getSnapshot,
        onError: PoeProcessAPI.onError,
        onStart: PoeProcessAPI.onStart,
        onSnapshot: PoeProcessAPI.onSnapshot,
        onStop: PoeProcessAPI.onStop,
      },
      profiles: {
        list: ProfilesAPI.list,
        update: ProfilesAPI.update,
        onChanged: ProfilesAPI.onChanged,
      },
      settings: SettingsStoreOverlayAPI,
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

type NormalizeExposedMethod<T> = T extends (...args: infer Args) => infer Result
  ? (
      ...args: Args
    ) => Result extends (...args: infer CleanupArgs) => unknown
      ? (...args: CleanupArgs) => void
      : Result
  : T extends object
    ? { [Key in keyof T]: NormalizeExposedMethod<T[Key]> }
    : T;
type ElectronAPI = NormalizeExposedMethod<ReturnType<typeof createScopedApi>>;
type FullElectronAPI = NormalizeExposedMethod<typeof fullApi>;
type ClipPreviewOverlayElectronAPI = NormalizeExposedMethod<{
  settings: typeof SettingsStoreClipPreviewOverlayAPI;
}>;
type ReplayStatusOverlayElectronAPI = NormalizeExposedMethod<{
  replayStatusOverlay: typeof ReplayStatusOverlayAPI;
}>;

const api: ElectronAPI = createScopedApi(globalThis.location?.hash ?? "");

contextBridge.exposeInMainWorld("electron", api);

export type {
  ClipPreviewOverlayElectronAPI,
  ElectronAPI,
  FullElectronAPI,
  ReplayStatusOverlayElectronAPI,
};
