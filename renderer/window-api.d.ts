import type { AppSelectPathInput } from "~/main/modules/app/App.dto";
import type {
  AppSetupResult,
  SetupState,
  StepValidationResult,
} from "~/main/modules/app-setup/AppSetup.types";
import type {
  ActivitySessionLibraryPage,
  ActivitySessionLibraryQuery,
  ActivitySessionTimeline,
  BookmarkLibraryPage,
  BookmarkLibraryQuery,
  BookmarkManualCreateResult,
  BookmarkManualUpdateInput,
  RecordingBookmarksPage,
  RecordingBookmarksQuery,
} from "~/main/modules/bookmarks";
import type { DiagLogRevealResult } from "~/main/modules/diag-log/DiagLog.dto";
import type {
  EditorCopyToClipboardInput,
  EditorCreateProjectInput,
  EditorExportFileActionResult,
  EditorExportInput,
  EditorExportProgress,
  EditorExportResult,
  EditorMediaAssetPage,
  EditorMediaAssetPageQuery,
  EditorProject,
  EditorSaveProjectInput,
  EditorWorkspace,
  EditorWorkspaceQuery,
} from "~/main/modules/editor/Editor.dto";
import type { KeybindRegistrationStatus } from "~/main/modules/keybinds/Keybinds.dto";
import type {
  ManagedRecorderAudioDevices,
  ManagedRecorderCaptureMode,
  ManagedRecorderListAudioDevicesOptions,
  ManagedReplaySaveResult,
} from "~/main/modules/managed-recorder/ManagedRecorder.dto";
import type {
  AuraAddRequest,
  CropRegionSelection,
  RecorderOverlayMode,
  SelectCropRegionOptions,
  ShowAuraOverlayOptions,
} from "~/main/modules/overlay-windows/OverlayWindows.dto";
import type {
  PoeProcessError,
  PoeProcessSnapshot,
} from "~/main/modules/poe-process/PoeProcess.dto";
import type {
  RecordingStorageBatchFileActionResult,
  RecordingStorageFileActionResult,
  RecordingStorageUsage,
  RunRecordingDetail,
  RunRecordingItem,
  RunRecordingLibraryPage,
  RunRecordingLibraryQuery,
} from "~/main/modules/recording-storage/RecordingStorage.dto";
import type {
  ReplayClipBatchFileActionResult,
  ReplayClipDetail,
  ReplayClipFileActionResult,
  ReplayClipLibraryPage,
  ReplayClipLibraryQuery,
  ReplayClipListFilter,
} from "~/main/modules/replay-clips/ReplayClips.dto";
import type {
  SavedEditFileActionResult,
  SavedEditsLibraryPage,
  SavedEditsLibraryQuery,
} from "~/main/modules/saved-edits/SavedEdits.dto";
import type { SettingsStoreOverlaySnapshot } from "~/main/modules/settings-store/SettingsStore.dto";
import type {
  StateImportResult,
  StateTransferResult,
} from "~/main/modules/state-transfer/StateTransfer.dto";
import type {
  DeleteGameLeagueDataResult,
  DiskSpaceCheck,
  StorageGameLeagueInput,
  StorageGameLeagueUsage,
  StorageInfo,
  StorageRevealPathsResult,
} from "~/main/modules/storage/Storage.dto";
import type {
  ChangelogResult,
  LatestReleaseInfo,
} from "~/main/modules/updater/Updater.api";
import type {
  DownloadProgress,
  UpdateInfo,
} from "~/main/modules/updater/Updater.service";

import type {
  AppSettings,
  AppSetupStep,
  CapturePreviewSource,
  CaptureProfile,
  CaptureProfileCreateInput,
  CaptureProfileUpdateInput,
  ClientLogStatus,
  ManagedRecorderStatus,
  Profile,
  ProfileCreateInput,
  ProfileUpdateInput,
  ReplayClip,
  StateImportMode,
  StateImportPreview,
} from "~/types";

declare global {
  interface Window {
    electron: {
      app: {
        getVersion: () => Promise<string>;
        selectPath: (input: AppSelectPathInput) => Promise<string | null>;
      };
      appSetup: {
        getSetupState: () => Promise<SetupState>;
        isSetupComplete: () => Promise<boolean>;
        advanceStep: () => Promise<AppSetupResult>;
        goToStep: (step: AppSetupStep) => Promise<AppSetupResult>;
        validateCurrentStep: () => Promise<StepValidationResult>;
        completeSetup: () => Promise<AppSetupResult>;
        resetSetup: () => Promise<void>;
        skipSetup: () => Promise<void>;
      };
      bookmarks: {
        createManual: () => Promise<BookmarkManualCreateResult>;
        deleteManual: (id: string) => Promise<void>;
        getActivitySessionTimeline: (
          activitySessionId: string,
        ) => Promise<ActivitySessionTimeline | null>;
        listActivitySessions: (
          query?: ActivitySessionLibraryQuery,
        ) => Promise<ActivitySessionLibraryPage>;
        listLibrary: (
          query?: BookmarkLibraryQuery,
        ) => Promise<BookmarkLibraryPage>;
        listRecording: (
          recordingId: string,
          query?: RecordingBookmarksQuery,
        ) => Promise<RecordingBookmarksPage>;
        updateManual: (input: BookmarkManualUpdateInput) => Promise<void>;
      };
      capturePreview: {
        getSourceThumbnail: (sourceId: string) => Promise<string | null>;
        listSources: (
          forceRefresh?: boolean,
        ) => Promise<CapturePreviewSource[]>;
        onRefreshRequested: (callback: () => void) => () => void;
        sourceExists: (sourceId: string) => Promise<boolean>;
      };
      captureProfiles: {
        list: () => Promise<CaptureProfile[]>;
        create: (input: CaptureProfileCreateInput) => Promise<CaptureProfile>;
        update: (input: CaptureProfileUpdateInput) => Promise<CaptureProfile>;
        delete: (id: string) => Promise<void>;
        onChanged: (
          callback: (profiles: CaptureProfile[]) => void,
        ) => () => void;
      };
      clientLog: {
        getStatus: () => Promise<ClientLogStatus>;
        setPath: (input: {
          game: "poe1" | "poe2";
          path: string;
        }) => Promise<ClientLogStatus>;
        setActiveGame: (input: {
          game: "poe1" | "poe2";
        }) => Promise<ClientLogStatus>;
        onStatusChanged: (
          callback: (status: ClientLogStatus) => void,
        ) => () => void;
      };
      diagLog: {
        revealLogFile: () => Promise<DiagLogRevealResult>;
      };
      editor: {
        copyExport: (exportId: string) => Promise<EditorExportFileActionResult>;
        copyProjectToClipboard: (
          input: EditorCopyToClipboardInput,
        ) => Promise<EditorExportFileActionResult>;
        createProject: (
          input?: EditorCreateProjectInput,
        ) => Promise<EditorProject>;
        deleteAllProjects: () => Promise<EditorWorkspace>;
        deleteProject: (projectId: string) => Promise<EditorWorkspace>;
        exportProject: (
          input: EditorExportInput,
        ) => Promise<EditorExportResult>;
        getWorkspace: (
          query?: EditorWorkspaceQuery,
        ) => Promise<EditorWorkspace>;
        listMediaAssets: (
          query: EditorMediaAssetPageQuery,
        ) => Promise<EditorMediaAssetPage>;
        revealExport: (
          exportId: string,
        ) => Promise<EditorExportFileActionResult>;
        saveProject: (input: EditorSaveProjectInput) => Promise<EditorProject>;
        onExportProgress: (
          callback: (progress: EditorExportProgress) => void,
        ) => () => void;
      };
      mainWindow: {
        minimize: () => Promise<void>;
        maximize: () => Promise<boolean>;
        unmaximize: () => Promise<boolean>;
        isMaximized: () => Promise<boolean>;
        close: () => Promise<void>;
        openEditorClip: (clipId: string) => Promise<void>;
        openDevTools: () => Promise<void>;
      };
      keybinds: {
        getStatus: () => Promise<KeybindRegistrationStatus>;
        onStatusChanged: (
          callback: (status: KeybindRegistrationStatus) => void,
        ) => () => void;
      };
      managedRecorder: {
        getCaptureMode: () => Promise<ManagedRecorderCaptureMode>;
        getStatus: () => Promise<ManagedRecorderStatus>;
        listAudioDevices: (
          options?: ManagedRecorderListAudioDevicesOptions,
        ) => Promise<ManagedRecorderAudioDevices>;
        setCaptureMode: (
          mode: ManagedRecorderCaptureMode,
        ) => Promise<ManagedRecorderCaptureMode>;
        startBuffer: () => Promise<ManagedRecorderStatus>;
        stopBuffer: () => Promise<ManagedRecorderStatus>;
        startRunRecording: () => Promise<ManagedRecorderStatus>;
        stopRunRecording: () => Promise<ManagedRecorderStatus>;
        saveReplay: () => Promise<ManagedReplaySaveResult>;
        onStatusChanged: (
          callback: (status: ManagedRecorderStatus) => void,
        ) => () => void;
        onCaptureModeChanged: (
          callback: (mode: ManagedRecorderCaptureMode) => void,
        ) => () => void;
      };
      overlayWindows: {
        showRecorder: () => Promise<void>;
        hideRecorder: () => Promise<void>;
        toggleRecorder: () => Promise<void>;
        isRecorderVisible: () => Promise<boolean>;
        isRecorderRequested: () => Promise<boolean>;
        getRecorderMode: () => Promise<RecorderOverlayMode>;
        setRecorderMode: (
          mode: RecorderOverlayMode,
        ) => Promise<RecorderOverlayMode>;
        onRecorderModeChanged: (
          callback: (mode: RecorderOverlayMode) => void,
        ) => () => void;
        onRecorderVisibilityChanged: (
          callback: (isVisible: boolean) => void,
        ) => () => void;
        hideClipPreview: () => Promise<void>;
        showAura: (
          profileId?: string,
          options?: ShowAuraOverlayOptions,
        ) => Promise<void>;
        isAuraLocked: () => Promise<boolean>;
        setAuraLocked: (locked: boolean) => Promise<void>;
        onAuraLockChanged: (callback: (locked: boolean) => void) => () => void;
        onAuraAddRequested: (
          callback: (request: AuraAddRequest) => void,
        ) => () => void;
        selectCropRegion: (
          options?: SelectCropRegionOptions,
        ) => Promise<CropRegionSelection | null>;
        completeCropRegionSelection: (
          selection: CropRegionSelection,
        ) => Promise<void>;
        cancelCropRegionSelection: () => Promise<void>;
      };
      poeProcess: {
        getSnapshot: () => Promise<PoeProcessSnapshot>;
        onStart: (callback: (state: PoeProcessSnapshot) => void) => () => void;
        onStop: (callback: (state: PoeProcessSnapshot) => void) => () => void;
        onSnapshot: (
          callback: (state: PoeProcessSnapshot) => void,
        ) => () => void;
        onError: (callback: (error: PoeProcessError) => void) => () => void;
      };
      profiles: {
        list: () => Promise<Profile[]>;
        create: (input: ProfileCreateInput) => Promise<Profile>;
        update: (input: ProfileUpdateInput) => Promise<Profile>;
        delete: (id: string) => Promise<void>;
        select: (id: string) => Promise<void>;
        onChanged: (callback: (profiles: Profile[]) => void) => () => void;
      };
      recordingStorage: {
        getRecording: (id: string) => Promise<RunRecordingDetail | null>;
        getUsage: () => Promise<RecordingStorageUsage>;
        listRecordings: () => Promise<RunRecordingItem[]>;
        listRecordingLibrary: (
          query?: RunRecordingLibraryQuery,
        ) => Promise<RunRecordingLibraryPage>;
        openRecording: (
          path: string,
        ) => Promise<RecordingStorageFileActionResult>;
        revealRecording: (
          path: string,
        ) => Promise<RecordingStorageFileActionResult>;
        copyRecording: (
          path: string,
        ) => Promise<RecordingStorageFileActionResult>;
        deleteRecording: (
          path: string,
        ) => Promise<RecordingStorageFileActionResult>;
        deleteManyRecordings: (
          paths: string[],
        ) => Promise<RecordingStorageBatchFileActionResult>;
      };
      replayClips: {
        get: (id: string) => Promise<ReplayClipDetail | null>;
        list: (filter?: ReplayClipListFilter) => Promise<ReplayClip[]>;
        listLibrary: (
          query?: ReplayClipLibraryQuery,
        ) => Promise<ReplayClipLibraryPage>;
        saveManualReplay: () => Promise<ReplayClip | null>;
        open: (id: string) => Promise<ReplayClipFileActionResult>;
        reveal: (id: string) => Promise<ReplayClipFileActionResult>;
        copy: (id: string) => Promise<ReplayClipFileActionResult>;
        delete: (id: string) => Promise<ReplayClipFileActionResult>;
        deleteMany: (ids: string[]) => Promise<ReplayClipBatchFileActionResult>;
        onStatusChanged: (callback: (clip: ReplayClip) => void) => () => void;
      };
      savedEdits: {
        delete: (projectId: string) => Promise<void>;
        deleteAll: () => Promise<void>;
        listLibrary: (
          query?: SavedEditsLibraryQuery,
        ) => Promise<SavedEditsLibraryPage>;
        revealInExplorer: (
          projectId: string,
        ) => Promise<SavedEditFileActionResult>;
      };
      settings: {
        scope: "full" | "overlay";
        get: () => Promise<AppSettings | SettingsStoreOverlaySnapshot>;
        onChanged: (
          callback: (
            settings: AppSettings | SettingsStoreOverlaySnapshot,
          ) => void,
        ) => () => void;
        update?: (input: Partial<AppSettings>) => Promise<AppSettings>;
      };
      storage: {
        getInfo: () => Promise<StorageInfo>;
        getGameLeagueUsage: () => Promise<StorageGameLeagueUsage[]>;
        deleteGameLeagueData: (
          input: StorageGameLeagueInput,
        ) => Promise<DeleteGameLeagueDataResult>;
        checkDiskSpace: () => Promise<DiskSpaceCheck>;
        revealPaths: () => Promise<StorageRevealPathsResult>;
      };
      stateTransfer: {
        exportPortable: () => Promise<StateTransferResult>;
        previewImport: () => Promise<StateImportPreview | null>;
        importPortable: (mode: StateImportMode) => Promise<StateImportResult>;
      };
      updater: {
        checkForUpdates: () => Promise<UpdateInfo | null>;
        getUpdateInfo: () => Promise<UpdateInfo | null>;
        downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
        installUpdate: () => Promise<{ success: boolean; error?: string }>;
        getRecentReleases: () => Promise<LatestReleaseInfo[]>;
        getChangelog: () => Promise<ChangelogResult>;
        onUpdateAvailable: (
          callback: (updateInfo: UpdateInfo) => void,
        ) => () => void;
        onDownloadProgress: (
          callback: (progress: DownloadProgress) => void,
        ) => () => void;
      };
    };
  }
}
