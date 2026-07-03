import type { StateCreator } from "zustand";

import type {
  SetupState,
  StepValidationResult,
} from "~/main/modules/app-setup/AppSetup.types";
import type { ManagedRecorderCaptureMode } from "~/main/modules/managed-recorder/ManagedRecorder.dto";
import type {
  BookmarkLibraryItem,
  BookmarkLibraryPage,
  BookmarkLibraryQuery,
} from "~/main/modules/bookmarks";
import type { PoeProcessState } from "~/main/modules/poe-process/PoeProcess.dto";
import type {
  RecordingStorageUsage,
  RunRecordingItem,
  RunRecordingLibraryPage,
  RunRecordingLibraryQuery,
} from "~/main/modules/recording-storage/RecordingStorage.dto";
import type {
  ReplayClipLibraryPage,
  ReplayClipLibraryQuery,
} from "~/main/modules/replay-clips";
import type { SettingsStoreOverlaySnapshot } from "~/main/modules/settings-store/SettingsStore.dto";
import type { AppMenuSlice } from "~/renderer/modules/app-menu/AppMenu.slice/AppMenu.slice";
import type { AuraOverlaySlice } from "~/renderer/modules/aura-overlay/AuraOverlay.slice/AuraOverlay.slice";
import type { ChangelogSlice } from "~/renderer/modules/changelog/Changelog.slice/Changelog.slice";
import type { CropEditorSlice } from "~/renderer/modules/crop-editor/CropEditor.slice/CropEditor.slice";
import type { EditorSlice } from "~/renderer/modules/editor/Editor.slice/Editor.slice.types";
import type { OnboardingSlice } from "~/renderer/modules/onboarding";
import type { SavedEditsSlice } from "~/renderer/modules/saved-edits";
import type { StorageSlice } from "~/renderer/modules/settings/Storage.slice/Storage.slice";
import type { UpdaterSlice } from "~/renderer/modules/updater/Updater.slice/Updater.slice";

import type {
  AppSettings,
  AppSetupStep,
  CapturePreviewSource,
  CaptureProfile,
  CaptureProfileUpdateInput,
  ClientLogStatus,
  GameId,
  ManagedRecorderStatus,
  Profile,
  ProfileUpdateInput,
  ReplayClip,
  StateImportPreview,
} from "~/types";

export interface AppSetupSlice {
  appSetup: {
    setupState: SetupState | null;
    validation: StepValidationResult | null;
    isLoading: boolean;
    error: string | null;
    setupStartTime: number | null;
    hydrate: () => Promise<void>;
    validateCurrentStep: () => Promise<void>;
    toggleGame: (game: GameId) => Promise<void>;
    selectClientPath: (game: GameId, path: string) => Promise<void>;
    advanceStep: () => Promise<boolean>;
    goBack: () => Promise<void>;
    completeSetup: () => Promise<boolean>;
    skipSetup: () => Promise<void>;
    resetSetup: () => Promise<void>;
    trackSetupStarted: () => void;
    setSetupState: (state: SetupState) => void;
    setValidation: (validation: StepValidationResult | null) => void;
    setError: (error: string | null) => void;
    isSetupComplete: () => boolean;
    getCurrentStep: () => AppSetupStep;
    getSelectedGames: () => GameId[];
  };
}

export interface ProfilesSlice {
  profiles: {
    items: Profile[];
    isLoading: boolean;
    error: string | null;
    selectedProfileId: string | null;
    hydrate: () => Promise<void>;
    create: (name: string) => Promise<void>;
    update: (input: ProfileUpdateInput) => Promise<void>;
    delete: (id: string) => Promise<void>;
    select: (id: string) => void;
    startListening: () => () => void;
  };
}

export interface CaptureProfilesSlice {
  captureProfiles: {
    items: CaptureProfile[];
    isLoading: boolean;
    error: string | null;
    selectedProfileId: string | null;
    isProfileUnlocked: boolean;
    hydrate: () => Promise<void>;
    create: (name: string) => Promise<void>;
    update: (input: CaptureProfileUpdateInput) => Promise<void>;
    delete: (id: string) => Promise<void>;
    select: (id: string) => void;
    selectWithPreviewSource: (id: string) => void;
    selectForGame: (game: GameId) => Promise<void>;
    setProfileUnlocked: (isUnlocked: boolean) => void;
    toggleProfileLock: () => void;
    startListening: () => () => void;
  };
}

export interface CapturePreviewSlice {
  capturePreview: {
    sources: CapturePreviewSource[];
    thumbnailsBySourceId: Record<string, string | null | undefined>;
    selectedSourceId: string | null;
    isLoading: boolean;
    error: string | null;
    hydrate: () => Promise<void>;
    getThumbnail: (sourceId: string) => Promise<string | null>;
    refresh: (options?: { force?: boolean }) => Promise<void>;
    select: (id: string) => void;
    startListening: (options?: { refreshOnStart?: boolean }) => () => void;
  };
}

export interface ManagedRecorderSlice {
  managedRecorder: {
    captureMode: ManagedRecorderCaptureMode;
    status: ManagedRecorderStatus | null;
    hydrate: () => Promise<void>;
    setCaptureMode: (mode: ManagedRecorderCaptureMode) => Promise<void>;
    startBuffer: () => Promise<void>;
    stopBuffer: () => Promise<void>;
    startRunRecording: () => Promise<void>;
    stopRunRecording: () => Promise<void>;
    saveReplay: () => Promise<void>;
    startListening: () => () => void;
  };
}

export interface SettingsSlice {
  settings: {
    value: AppSettings | SettingsStoreOverlaySnapshot | null;
    hydrate: () => Promise<void>;
    startListening: () => () => void;
    update: (input: Partial<AppSettings>) => Promise<void>;
  };
}

export interface ClientLogSlice {
  clientLog: {
    status: ClientLogStatus | null;
    pendingPath: string;
    setPendingPath: (path: string) => void;
    hydrate: () => Promise<void>;
    savePath: (path?: string) => Promise<void>;
    saveGamePath: (game: "poe1" | "poe2", path: string) => Promise<void>;
    setActiveGame: (
      game: "poe1" | "poe2",
      options?: { hydrateSettings?: boolean },
    ) => Promise<void>;
    startListening: () => () => void;
  };
}

export interface PoeProcessSlice {
  poeProcess: {
    state: PoeProcessState | null;
    error: string | null;
    hydrate: () => Promise<void>;
    startListening: () => () => void;
  };
}

export interface ReplayClipsSlice {
  replayClips: {
    items: ReplayClip[];
    libraryQuery: ReplayClipLibraryQuery | null;
    libraryPage: ReplayClipLibraryPage | null;
    libraryItems: ReplayClip[];
    libraryLeagues: string[];
    activeClip: ReplayClip | null;
    selectedClipIds: Record<string, boolean>;
    error: string | null;
    hydrate: () => Promise<void>;
    hydrateLibrary: (query: ReplayClipLibraryQuery) => Promise<void>;
    refreshLibrary: () => Promise<void>;
    saveManualReplay: () => Promise<void>;
    openClip: (id: string) => Promise<void>;
    revealClip: (id: string) => Promise<void>;
    deleteClip: (id: string) => Promise<void>;
    deleteSelectedClips: () => Promise<void>;
    setSelectedClipIds: (ids: Record<string, boolean>) => void;
    clearSelectedClips: () => void;
    startListening: () => () => void;
  };
}

export interface StateTransferSlice {
  stateTransfer: {
    preview: StateImportPreview | null;
    lastMessage: string | null;
    exportPortable: () => Promise<void>;
    previewImport: () => Promise<void>;
    importPortable: (mode: "merge" | "replace") => Promise<void>;
  };
}

export interface RecordingStorageSlice {
  recordingStorage: {
    usage: RecordingStorageUsage | null;
    recordings: RunRecordingItem[];
    recordingsPage: RunRecordingLibraryPage | null;
    recordingsQuery: RunRecordingLibraryQuery | null;
    recordingLeagues: string[];
    selectedRecordingIds: Record<string, boolean>;
    isLoading: boolean;
    error: string | null;
    hydrate: () => Promise<void>;
    refreshUsage: () => Promise<void>;
    refreshRecordings: (query?: RunRecordingLibraryQuery) => Promise<void>;
    openRecording: (path: string) => Promise<void>;
    revealRecording: (path: string) => Promise<void>;
    deleteRecording: (path: string) => Promise<void>;
    deleteSelectedRecordings: () => Promise<void>;
    setSelectedRecordingIds: (ids: Record<string, boolean>) => void;
    clearSelectedRecordings: () => void;
  };
}

export interface BookmarksSlice {
  bookmarks: {
    availableCategories: BookmarkLibraryPage["availableCategories"];
    availableLeagues: string[];
    error: string | null;
    isLoading: boolean;
    items: BookmarkLibraryItem[];
    page: BookmarkLibraryPage | null;
    query: BookmarkLibraryQuery | null;
    hydrate: () => Promise<void>;
    refresh: (query?: BookmarkLibraryQuery) => Promise<void>;
    deleteManual: (id: string) => Promise<void>;
    updateManual: (id: string, label: string, note?: string | null) => Promise<void>;
  };
}

export type BoundStore = AppMenuSlice &
  AuraOverlaySlice &
  AppSetupSlice &
  ProfilesSlice &
  CaptureProfilesSlice &
  CropEditorSlice &
  OnboardingSlice &
  EditorSlice &
  CapturePreviewSlice &
  ManagedRecorderSlice &
  SettingsSlice &
  ClientLogSlice &
  PoeProcessSlice &
  ReplayClipsSlice &
  RecordingStorageSlice &
  BookmarksSlice &
  StorageSlice &
  UpdaterSlice &
  ChangelogSlice &
  SavedEditsSlice &
  StateTransferSlice & {
    hydrate: () => Promise<void>;
    startListeners: () => () => void;
  };

export type BoundStoreStateCreator<TSlice> = StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  TSlice
>;
