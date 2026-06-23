import type { AppSelectPathInput } from "~/main/modules/app/App.dto";
import type {
  AppSetupResult,
  SetupState,
  StepValidationResult,
} from "~/main/modules/app-setup/AppSetup.types";
import type { DiagLogRevealResult } from "~/main/modules/diag-log/DiagLog.dto";
import type {
  EditorCopyToClipboardInput,
  EditorCreateProjectInput,
  EditorExportFileActionResult,
  EditorExportInput,
  EditorExportProgress,
  EditorExportResult,
  EditorProject,
  EditorSaveProjectInput,
  EditorWorkspace,
  EditorWorkspaceQuery,
} from "~/main/modules/editor/Editor.dto";
import type {
  ManagedRecorderCaptureMode,
  ManagedReplaySaveResult,
} from "~/main/modules/managed-recorder/ManagedRecorder.dto";
import type {
  CropRegionSelection,
  RecorderOverlayMode,
  ShowAuraOverlayOptions,
} from "~/main/modules/overlay-windows/OverlayWindows.dto";
import type {
  PoeProcessError,
  PoeProcessState,
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
      capturePreview: {
        listSources: (
          forceRefresh?: boolean,
        ) => Promise<CapturePreviewSource[]>;
        sourceExists: (sourceId: string) => Promise<boolean>;
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
        deleteProject: (projectId: string) => Promise<EditorWorkspace>;
        exportProject: (
          input: EditorExportInput,
        ) => Promise<EditorExportResult>;
        getWorkspace: (
          query?: EditorWorkspaceQuery,
        ) => Promise<EditorWorkspace>;
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
        openDevTools: () => Promise<void>;
      };
      managedRecorder: {
        getCaptureMode: () => Promise<ManagedRecorderCaptureMode>;
        getStatus: () => Promise<ManagedRecorderStatus>;
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
          callback: (requestId: string) => void,
        ) => () => void;
        selectCropRegion: () => Promise<CropRegionSelection | null>;
        completeCropRegionSelection: (
          selection: CropRegionSelection,
        ) => Promise<void>;
        cancelCropRegionSelection: () => Promise<void>;
      };
      poeProcess: {
        getState: () => Promise<PoeProcessState>;
        onStart: (callback: (state: PoeProcessState) => void) => () => void;
        onStop: (callback: (state: PoeProcessState) => void) => () => void;
        onState: (callback: (state: PoeProcessState) => void) => () => void;
        onError: (callback: (error: PoeProcessError) => void) => () => void;
      };
      profiles: {
        list: () => Promise<Profile[]>;
        create: (input: ProfileCreateInput) => Promise<Profile>;
        update: (input: ProfileUpdateInput) => Promise<Profile>;
        delete: (id: string) => Promise<void>;
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
        saveManual: () => Promise<ReplayClip | null>;
        open: (id: string) => Promise<ReplayClipFileActionResult>;
        reveal: (id: string) => Promise<ReplayClipFileActionResult>;
        copy: (id: string) => Promise<ReplayClipFileActionResult>;
        delete: (id: string) => Promise<ReplayClipFileActionResult>;
        deleteMany: (ids: string[]) => Promise<ReplayClipBatchFileActionResult>;
        onStatusChanged: (callback: (clip: ReplayClip) => void) => () => void;
      };
      settings: {
        get: () => Promise<AppSettings>;
        update: (input: Partial<AppSettings>) => Promise<AppSettings>;
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
