import { expect, type Page } from "@playwright/test";

import type { SetupState } from "../../main/modules/app-setup/AppSetup.types";
import type {
  BookmarkLibraryItem,
  BookmarkLibraryPage,
  BookmarkLibraryQuery,
  BookmarkManualUpdateInput,
} from "../../main/modules/bookmarks";
import type {
  ManagedRecorderAudioDevices,
  ManagedRecorderCaptureMode,
  ManagedRecorderListAudioDevicesOptions,
} from "../../main/modules/managed-recorder/ManagedRecorder.dto";
import type { PoeProcessState } from "../../main/modules/poe-process/PoeProcess.dto";
import type {
  RecordingStorageUsage,
  RunRecordingLibraryPage,
} from "../../main/modules/recording-storage/RecordingStorage.dto";
import type {
  DiskSpaceCheck,
  StorageInfo,
} from "../../main/modules/storage/Storage.dto";
import type { DownloadProgress, UpdateInfo } from "../../main/modules/updater";
import {
  type AppSettings,
  type CapturePreviewSource,
  type CaptureProfile,
  type CaptureProfileUpdateInput,
  type ClientLogStatus,
  createDefaultSettings,
  type GameId,
  type ManagedRecorderStatus,
  type Profile,
  type ProfileUpdateInput,
} from "../../types";
import {
  type E2EBridgeDomainFactory,
  type E2EBridgeDomainMethods,
  e2eBridgeDomainFactorySource,
} from "./bridge-fixture";

interface DashboardE2ECalls {
  audioDeviceRequests: Array<ManagedRecorderListAudioDevicesOptions | null>;
  auraLockEvents: boolean[];
  bookmarkDeletes: string[];
  bookmarkUpdates: BookmarkManualUpdateInput[];
  captureModeChanges: ManagedRecorderCaptureMode[];
  captureProfileCreates: Array<{ game: GameId; id: string; name: string }>;
  captureProfileDeletes: string[];
  captureProfileUpdates: CaptureProfileUpdateInput[];
  captureSourceRequests: boolean[];
  captureSourceResponses: string[][];
  clientLogActiveGames: Array<{ game: "poe1" | "poe2" }>;
  duplicatePoeStateEmissions: number;
  getUserMediaConstraints: unknown[];
  mainWindowActions: string[];
  profileCreates: Array<{ game: GameId | null; id: string; name: string }>;
  profileDeletes: string[];
  profileSelects: string[];
  profileUpdates: ProfileUpdateInput[];
  recorderOverlayToggles: number;
  recorderVisibilityEvents: boolean[];
  settingsUpdates: Array<Partial<AppSettings>>;
  sourceThumbnailRequests: string[];
  startBufferCount: number;
  startRunRecordingCount: number;
  stopBufferCount: number;
  stopRunRecordingCount: number;
  unexpectedBridgeCalls: string[];
}

interface DashboardE2EApi {
  emitAuraLockChanged: (locked: boolean) => void;
  emitPoeProcessStart: (state: PoeProcessState) => void;
  emitPoeProcessStop: (state?: PoeProcessState) => void;
  emitRecorderOverlayVisibility: (visible: boolean) => void;
  setCaptureSources: (sources: CapturePreviewSource[]) => void;
}

interface DashboardE2EFixture {
  audioDevices: ManagedRecorderAudioDevices;
  auraLocked: boolean;
  bookmarks: BookmarkLibraryItem[];
  clientLogStatus: ClientLogStatus;
  now: string;
  poeProcessState: PoeProcessState;
  captureProfile: CaptureProfile;
  profile: Profile;
  recordingStorageUsage: RecordingStorageUsage;
  recorderStatus: ManagedRecorderStatus;
  settings: AppSettings;
  setupState: SetupState;
  sources: CapturePreviewSource[];
  storageInfo: StorageInfo;
  recorderOverlayVisible: boolean;
}

type DashboardE2EElectron = Window["electron"];

const dashboardE2ENow = "2026-06-25T00:00:00.000Z";

interface DashboardE2EOptions {
  activeGame?: GameId;
  auraLocked?: boolean;
  bookmarks?: BookmarkLibraryItem[];
  recorderOverlayVisible?: boolean;
}

function createDashboardE2EFixture(
  options: DashboardE2EOptions = {},
): DashboardE2EFixture {
  const activeGame = options.activeGame ?? "poe2";
  const activeLeague = activeGame === "poe1" ? "Standard" : "Runes of Aldur";
  const selectedCaptureProfileId =
    activeGame === "poe1" ? "default-capture-poe1" : "capture-profile-1";
  const selectedProfileId =
    activeGame === "poe1" ? "profile-poe1" : "profile-1";
  const settings: AppSettings = {
    ...createDefaultSettings(),
    activeGame,
    activeLeague,
    installedGames: ["poe1", "poe2"],
    lastSeenAppVersion: "0.1.2",
    poe1SelectedLeague: "Standard",
    poe2SelectedLeague: "Runes of Aldur",
    recordingClipQuality: "high",
    recordingEncoder: "hardware_h264",
    recordingFps: 60,
    recordingRunQuality: "moderate",
    setupCompleted: true,
    setupStep: 3,
    setupVersion: 1,
    selectedCaptureProfileId,
    selectedProfileId,
  };
  const sources: CapturePreviewSource[] = [
    {
      displayId: "1",
      height: 1440,
      id: "screen:1:0",
      kind: "screen",
      name: "Screen 1 (Display Model)",
      thumbnailDataUrl: null,
      width: 2560,
    },
    {
      displayId: null,
      height: 1440,
      id: "window:poe2:1",
      kind: "window",
      game: "poe2",
      name: "Path of Exile 2",
      thumbnailDataUrl: null,
      width: 2560,
    },
  ];
  const profile: Profile = {
    captureTarget: {
      height: 1440,
      id: "1",
      kind: "display",
      label: "Screen 1 (Display Model)",
      width: 2560,
    },
    createdAt: dashboardE2ENow,
    cropRegions: [],
    game: null,
    id: "profile-1",
    name: "PoE 2",
    overlayPlacements: [],
    targetFps: 60,
    updatedAt: dashboardE2ENow,
  };
  const captureProfile: CaptureProfile = {
    captureTarget: profile.captureTarget,
    createdAt: dashboardE2ENow,
    deathClipSeconds: settings.deathClipSeconds,
    game: "poe2",
    id: "capture-profile-1",
    isDefault: false,
    name: "PoE 2 Capture",
    recordingAudioInputDeviceId: settings.recordingAudioInputDeviceId,
    recordingAudioOutputDeviceId: settings.recordingAudioOutputDeviceId,
    recordingAutoStartMode: settings.recordingAutoStartMode,
    recordingClipQuality: settings.recordingClipQuality,
    recordingEncoder: settings.recordingEncoder,
    recordingFps: settings.recordingFps,
    recordingHideOverlaysFromRecording:
      settings.recordingHideOverlaysFromRecording,
    recordingHideOverlaysFromRewind: settings.recordingHideOverlaysFromRewind,
    recordingOutputResolution: settings.recordingOutputResolution,
    recordingRunQuality: settings.recordingRunQuality,
    recordingTrackBookmarksInRewind: settings.recordingTrackBookmarksInRewind,
    updatedAt: dashboardE2ENow,
  };
  const recorderStatus: ManagedRecorderStatus = {
    activeSessionDirectory: null,
    available: true,
    bufferActive: false,
    encoder: "hardware_h264",
    error: null,
    fps: 60,
    gameRunning: true,
    initialized: true,
    isStartingRecording: false,
    isStoppingRecording: false,
    lastRecordingPath: null,
    outputDirectory: null,
    outputResolution: "native",
    recording: false,
    recordingStartedAt: null,
    runRecordingActive: false,
    runRecordingPath: null,
    runRecordingStartedAt: null,
    runtime: "packaged_obs",
    runtimePath: null,
  };
  const storageInfo: StorageInfo = {
    appInstallationDiskFreeBytes: 900_000_000_000,
    appInstallationDiskTotalBytes: 1_000_000_000_000,
    appInstallationSizeBytes: 100_000_000,
    breakdown: [],
    calculatedAt: dashboardE2ENow,
    databaseDiskFreeBytes: 900_000_000_000,
    databaseDiskTotalBytes: 1_000_000_000_000,
    databaseSizeBytes: 1024,
    diskFreeBytes: 900_000_000_000,
    diskTotalBytes: 1_000_000_000_000,
    mediaSizeBytes: 0,
    rewindBufferEstimateBytes: 0,
    storagePath: "C:/Hinekora",
    temporarySizeBytes: 0,
    totalTrackedSizeBytes: 1024,
  };

  return {
    audioDevices: {
      input: [{ id: "{mic-1}", label: "Microphone Array" }],
      output: [
        { id: "{speakers-1}", label: "Speakers (Display Audio Device)" },
        { id: "{headset-1}", label: "Headset Output" },
      ],
    },
    auraLocked: options.auraLocked ?? true,
    bookmarks: options.bookmarks ?? [],
    clientLogStatus: {
      activeGame,
      activeGameFocused: true,
      lastError: null,
      path: null,
      watching: false,
    },
    now: dashboardE2ENow,
    poeProcessState: {
      game: activeGame,
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    },
    profile,
    captureProfile,
    recorderOverlayVisible: options.recorderOverlayVisible ?? false,
    recordingStorageUsage: {
      calculatedAt: dashboardE2ENow,
      clipsSizeBytes: 0,
      databasePath: "C:/Hinekora/hinekora.sqlite",
      databaseSizeBytes: 1024,
      diskFreeBytes: 900_000_000_000,
      diskTotalBytes: 1_000_000_000_000,
      diskWarningThresholdBytes: 5_000_000_000,
      lowDiskSpace: false,
      recordingsSizeBytes: 0,
      storageDirectory: "C:/Hinekora",
      totalTrackedSizeBytes: 1024,
    },
    recorderStatus,
    settings,
    setupState: {
      currentStep: 3,
      isComplete: true,
      poe1ClientPath: null,
      poe2ClientPath: null,
      selectedGames: ["poe1", "poe2"],
      telemetryCrashReporting: false,
      telemetryUsageAnalytics: false,
    },
    sources,
    storageInfo,
  };
}

async function setupDashboardE2E(
  page: Page,
  options: DashboardE2EOptions = {},
) {
  await page.setViewportSize({ height: 760, width: 1280 });
  await page.addInitScript(
    (input: { bridgeFactorySource: string; fixture: DashboardE2EFixture }) => {
      const { fixture } = input;
      const unsubscribe = () => undefined;
      const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
      const applyCaptureProfileUpdate = (
        profile: CaptureProfile,
        update: CaptureProfileUpdateInput,
      ): CaptureProfile => {
        const updates = Object.fromEntries(
          Object.entries(update).filter(
            ([key, value]) => key !== "id" && value !== undefined,
          ),
        ) as Partial<CaptureProfile>;

        return {
          ...profile,
          ...updates,
          updatedAt: fixture.now,
        };
      };
      const transparentPixel =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
      const createBridgeDomainFactory = Function(
        `"use strict"; return (${input.bridgeFactorySource});`,
      )() as E2EBridgeDomainFactory;
      let settings = clone(fixture.settings);
      let bookmarks = clone(fixture.bookmarks);
      let recorderStatus = clone(fixture.recorderStatus);
      let captureMode: ManagedRecorderCaptureMode = "rewind";
      let recorderOverlayRequested = fixture.recorderOverlayVisible;
      let recorderOverlayVisible = fixture.recorderOverlayVisible;
      let auraLocked = fixture.auraLocked;
      let isMaximized = false;
      const profilesById = new Map([
        [fixture.profile.id, clone(fixture.profile)],
      ]);
      const poe1Profile: Profile = {
        ...fixture.profile,
        captureTarget: null,
        game: null,
        id: "profile-poe1",
        name: "PoE 1",
      };
      profilesById.set(poe1Profile.id, clone(poe1Profile));
      const poe1CaptureProfile: CaptureProfile = {
        ...fixture.captureProfile,
        captureTarget: null,
        game: "poe1",
        id: "capture-profile-poe1",
        isDefault: false,
        name: "PoE 1 Capture",
      };
      const defaultPoe1CaptureProfile: CaptureProfile = {
        ...poe1CaptureProfile,
        id: "default-capture-poe1",
        isDefault: true,
        name: "Default PoE Capture",
      };
      const defaultPoe2CaptureProfile: CaptureProfile = {
        ...fixture.captureProfile,
        captureTarget: null,
        id: "default-capture-poe2",
        isDefault: true,
        name: "Default PoE 2 Capture",
      };
      const captureProfilesById = new Map([
        [defaultPoe1CaptureProfile.id, clone(defaultPoe1CaptureProfile)],
        [defaultPoe2CaptureProfile.id, clone(defaultPoe2CaptureProfile)],
        [fixture.captureProfile.id, clone(fixture.captureProfile)],
        [poe1CaptureProfile.id, clone(poe1CaptureProfile)],
      ]);
      const clientLogStatus = clone(fixture.clientLogStatus);
      let poeProcessState = clone(fixture.poeProcessState);
      let captureSources = clone(fixture.sources);
      const listeners: {
        auraLock?: (locked: boolean) => void;
        captureMode?: (mode: ManagedRecorderCaptureMode) => void;
        captureProfileChanged?: (profiles: CaptureProfile[]) => void;
        captureRefreshRequested?: () => void;
        poeError?: (error: { error: string }) => void;
        poeStart?: (state: PoeProcessState) => void;
        poeState?: (state: PoeProcessState) => void;
        poeStop?: (state: PoeProcessState) => void;
        profileChanged?: (profiles: Profile[]) => void;
        recorderStatus?: (status: ManagedRecorderStatus) => void;
        recorderVisibility?: (visible: boolean) => void;
        settingsChanged?: (settings: AppSettings) => void;
        updateAvailable?: (info: UpdateInfo) => void;
        updateProgress?: (progress: DownloadProgress) => void;
      } = {};
      const calls: DashboardE2ECalls = {
        audioDeviceRequests: [],
        auraLockEvents: [],
        bookmarkDeletes: [],
        bookmarkUpdates: [],
        captureModeChanges: [],
        captureProfileCreates: [],
        captureProfileDeletes: [],
        captureProfileUpdates: [],
        captureSourceRequests: [],
        captureSourceResponses: [],
        clientLogActiveGames: [],
        duplicatePoeStateEmissions: 0,
        getUserMediaConstraints: [],
        mainWindowActions: [],
        profileCreates: [],
        profileDeletes: [],
        profileSelects: [],
        profileUpdates: [],
        recorderOverlayToggles: 0,
        recorderVisibilityEvents: [],
        settingsUpdates: [],
        sourceThumbnailRequests: [],
        startBufferCount: 0,
        startRunRecordingCount: 0,
        stopBufferCount: 0,
        stopRunRecordingCount: 0,
        unexpectedBridgeCalls: [],
      };
      const createBridgeDomain = <TBridge extends object>(
        domain: string,
        methods: E2EBridgeDomainMethods<TBridge>,
      ): TBridge =>
        createBridgeDomainFactory(
          domain,
          methods,
          calls.unexpectedBridgeCalls,
          "dashboard",
        );
      const emitAuraLock = (locked: boolean) => {
        auraLocked = locked;
        calls.auraLockEvents.push(locked);
        listeners.auraLock?.(locked);
      };
      const sortBookmarks = (
        items: BookmarkLibraryItem[],
        query: BookmarkLibraryQuery,
      ) => {
        const sortBy = query.sortBy ?? "occurredAt";
        const direction = query.sortDirection ?? "desc";
        const multiplier = direction === "asc" ? 1 : -1;

        return [...items].sort((left, right) => {
          const leftValue = left[sortBy];
          const rightValue = right[sortBy];

          return (
            String(leftValue).localeCompare(String(rightValue)) * multiplier
          );
        });
      };
      const listBookmarks = (
        query: BookmarkLibraryQuery = {},
      ): BookmarkLibraryPage => {
        const filtered = bookmarks.filter((bookmark) => {
          if (query.game && bookmark.sourceGame !== query.game) {
            return false;
          }
          if (query.league && bookmark.sourceLeague !== query.league) {
            return false;
          }
          if (query.category && bookmark.category !== query.category) {
            return false;
          }

          return true;
        });
        const pageIndex = query.pageIndex ?? 0;
        const pageSize = query.pageSize ?? 20;
        const pageStart = pageIndex * pageSize;
        const sorted = sortBookmarks(filtered, query);

        return {
          availableCategories: Array.from(
            new Set(filtered.map((bookmark) => bookmark.category)),
          ),
          availableLeagues: Array.from(
            new Set(
              bookmarks
                .filter((bookmark) =>
                  query.game ? bookmark.sourceGame === query.game : true,
                )
                .map((bookmark) => bookmark.sourceLeague),
            ),
          ),
          items: clone(sorted.slice(pageStart, pageStart + pageSize)),
          pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
          pageIndex,
          pageSize,
          sortBy: query.sortBy ?? "occurredAt",
          sortDirection: query.sortDirection ?? "desc",
          totalCount: filtered.length,
        };
      };
      const emitRecorderVisibility = (visible: boolean) => {
        recorderOverlayVisible = visible;
        calls.recorderVisibilityEvents.push(visible);
        listeners.recorderVisibility?.(visible);
      };
      const updateRecorderStatus = (
        nextStatus: Partial<ManagedRecorderStatus>,
      ) => {
        recorderStatus = { ...recorderStatus, ...nextStatus };
        listeners.recorderStatus?.(clone(recorderStatus));

        return clone(recorderStatus);
      };
      const emptyRecordingPage: RunRecordingLibraryPage = {
        availableLeagues: ["Standard", "Runes of Aldur"],
        items: [],
        pageCount: 0,
        pageIndex: 0,
        pageSize: 20,
        sortBy: "createdAt",
        sortDirection: "desc",
        totalCount: 0,
      };
      const diskCheck: DiskSpaceCheck = {
        diskFreeBytes: fixture.storageInfo.diskFreeBytes,
        isLow: false,
      };

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async (constraints: MediaStreamConstraints) => {
            calls.getUserMediaConstraints.push(clone(constraints));

            return new MediaStream();
          },
        },
      });
      HTMLMediaElement.prototype.play = async function play() {
        return undefined;
      };

      (
        window as unknown as {
          __HINEKORA_DASHBOARD_E2E__: DashboardE2ECalls;
          electron: unknown;
        }
      ).__HINEKORA_DASHBOARD_E2E__ = calls;

      const electron: DashboardE2EElectron = {
        app: createBridgeDomain<DashboardE2EElectron["app"]>("app", {
          getVersion: async () => "0.1.2",
        }),
        appSetup: createBridgeDomain<DashboardE2EElectron["appSetup"]>(
          "appSetup",
          {
            getSetupState: async () => clone(fixture.setupState),
          },
        ),
        bookmarks: createBridgeDomain<DashboardE2EElectron["bookmarks"]>(
          "bookmarks",
          {
            createManual: async () => ({
              bookmark: null,
              error: null,
              ok: true,
            }),
            deleteManual: async (bookmarkId) => {
              calls.bookmarkDeletes.push(bookmarkId);
              bookmarks = bookmarks.filter(
                (bookmark) => bookmark.id !== bookmarkId,
              );
            },
            listLibrary: async (query) => listBookmarks(query),
            listRecording: async () => ({
              items: [],
              pageCount: 1,
              pageIndex: 0,
              pageSize: 10,
              timelineItems: [],
              timelineItemsTruncated: false,
              totalCount: 0,
            }),
            updateManual: async (input) => {
              calls.bookmarkUpdates.push(clone(input));
              bookmarks = bookmarks.map((bookmark) =>
                bookmark.id === input.id
                  ? {
                      ...bookmark,
                      label: input.label,
                      updatedAt: fixture.now,
                    }
                  : bookmark,
              );
            },
          },
        ),
        capturePreview: createBridgeDomain<
          DashboardE2EElectron["capturePreview"]
        >("capturePreview", {
          getSourceThumbnail: async (sourceId: string) => {
            calls.sourceThumbnailRequests.push(sourceId);

            return transparentPixel;
          },
          listSources: async (forceRefresh?: boolean) => {
            calls.captureSourceRequests.push(forceRefresh === true);
            calls.captureSourceResponses.push(
              captureSources.map((source) => source.id),
            );
            if (forceRefresh === true) {
              window.setTimeout(() => {
                calls.duplicatePoeStateEmissions += 1;
                listeners.poeState?.(clone(poeProcessState));
              }, 0);
            }

            return clone(captureSources);
          },
          onRefreshRequested: (callback) => {
            listeners.captureRefreshRequested = callback;

            return unsubscribe;
          },
          sourceExists: async (sourceId: string) =>
            captureSources.some((source) => source.id === sourceId),
        }),
        captureProfiles: createBridgeDomain<
          DashboardE2EElectron["captureProfiles"]
        >("captureProfiles", {
          create: async (input) => {
            const createdProfile: CaptureProfile = {
              ...fixture.captureProfile,
              id: `capture-profile-${captureProfilesById.size + 1}`,
              isDefault: false,
              name: input.name,
              game: input.game,
              createdAt: fixture.now,
              updatedAt: fixture.now,
            };
            calls.captureProfileCreates.push(
              clone({
                game: input.game,
                id: createdProfile.id,
                name: input.name,
              }),
            );
            captureProfilesById.set(createdProfile.id, createdProfile);
            listeners.captureProfileChanged?.(
              clone(Array.from(captureProfilesById.values())),
            );

            return clone(createdProfile);
          },
          delete: async (id) => {
            calls.captureProfileDeletes.push(id);
            captureProfilesById.delete(id);
            listeners.captureProfileChanged?.(
              clone(Array.from(captureProfilesById.values())),
            );
          },
          list: async () => clone(Array.from(captureProfilesById.values())),
          onChanged: (callback) => {
            listeners.captureProfileChanged = callback;

            return unsubscribe;
          },
          update: async (input) => {
            calls.captureProfileUpdates.push(clone(input));
            const profile =
              captureProfilesById.get(input.id) ?? fixture.captureProfile;
            const updatedProfile = applyCaptureProfileUpdate(profile, input);
            captureProfilesById.set(input.id, updatedProfile);
            listeners.captureProfileChanged?.(
              clone(Array.from(captureProfilesById.values())),
            );

            return clone(updatedProfile);
          },
        }),
        clientLog: createBridgeDomain<DashboardE2EElectron["clientLog"]>(
          "clientLog",
          {
            getStatus: async () => clone(clientLogStatus),
            onStatusChanged: () => unsubscribe,
            setActiveGame: async (input: { game: "poe1" | "poe2" }) => {
              calls.clientLogActiveGames.push(clone(input));
              clientLogStatus.activeGame = input.game;

              return clone(clientLogStatus);
            },
          },
        ),
        diagLog: createBridgeDomain<DashboardE2EElectron["diagLog"]>(
          "diagLog",
          {},
        ),
        editor: createBridgeDomain<DashboardE2EElectron["editor"]>(
          "editor",
          {},
        ),
        mainWindow: createBridgeDomain<DashboardE2EElectron["mainWindow"]>(
          "mainWindow",
          {
            close: async () => {
              calls.mainWindowActions.push("close");
            },
            isMaximized: async () => isMaximized,
            maximize: async () => {
              calls.mainWindowActions.push("maximize");
              isMaximized = true;

              return isMaximized;
            },
            minimize: async () => {
              calls.mainWindowActions.push("minimize");
            },
            unmaximize: async () => {
              calls.mainWindowActions.push("unmaximize");
              isMaximized = false;

              return isMaximized;
            },
          },
        ),
        managedRecorder: createBridgeDomain<
          DashboardE2EElectron["managedRecorder"]
        >("managedRecorder", {
          getCaptureMode: async () => captureMode,
          getStatus: async () => clone(recorderStatus),
          listAudioDevices: async (
            options?: ManagedRecorderListAudioDevicesOptions,
          ) => {
            calls.audioDeviceRequests.push(options ? clone(options) : null);

            return clone(fixture.audioDevices);
          },
          onCaptureModeChanged: (callback) => {
            listeners.captureMode = callback;

            return unsubscribe;
          },
          onStatusChanged: (callback) => {
            listeners.recorderStatus = callback;

            return unsubscribe;
          },
          setCaptureMode: async (mode) => {
            calls.captureModeChanges.push(mode);
            captureMode = mode;
            listeners.captureMode?.(mode);

            return mode;
          },
          startBuffer: async () => {
            calls.startBufferCount += 1;
            captureMode = "rewind";

            return updateRecorderStatus({
              bufferActive: true,
              recording: true,
            });
          },
          startRunRecording: async () => {
            calls.startRunRecordingCount += 1;
            captureMode = "session";

            return updateRecorderStatus({
              recording: true,
              runRecordingActive: true,
            });
          },
          stopBuffer: async () => {
            calls.stopBufferCount += 1;

            return updateRecorderStatus({
              bufferActive: false,
              recording: false,
            });
          },
          stopRunRecording: async () => {
            calls.stopRunRecordingCount += 1;

            return updateRecorderStatus({
              recording: false,
              runRecordingActive: false,
            });
          },
        }),
        overlayWindows: createBridgeDomain<
          DashboardE2EElectron["overlayWindows"]
        >("overlayWindows", {
          getRecorderMode: async () => "expanded",
          hideRecorder: async () => {
            recorderOverlayRequested = false;
            emitRecorderVisibility(false);
          },
          isAuraLocked: async () => auraLocked,
          isRecorderRequested: async () => recorderOverlayRequested,
          isRecorderVisible: async () => recorderOverlayVisible,
          onAuraAddRequested: () => unsubscribe,
          onAuraLockChanged: (callback) => {
            listeners.auraLock = callback;

            return unsubscribe;
          },
          onRecorderModeChanged: () => unsubscribe,
          onRecorderVisibilityChanged: (callback) => {
            listeners.recorderVisibility = callback;

            return unsubscribe;
          },
          setAuraLocked: async (locked) => {
            emitAuraLock(locked);
          },
          setRecorderMode: async (mode) => mode,
          showRecorder: async () => {
            recorderOverlayRequested = true;
            emitRecorderVisibility(true);
          },
          toggleRecorder: async () => {
            calls.recorderOverlayToggles += 1;
            recorderOverlayRequested = !recorderOverlayVisible;
            emitRecorderVisibility(recorderOverlayRequested);
          },
        }),
        poeProcess: createBridgeDomain<DashboardE2EElectron["poeProcess"]>(
          "poeProcess",
          {
            getState: async () => clone(poeProcessState),
            onError: (callback) => {
              listeners.poeError = callback;

              return unsubscribe;
            },
            onStart: (callback) => {
              listeners.poeStart = callback;

              return unsubscribe;
            },
            onState: (callback) => {
              listeners.poeState = callback;

              return unsubscribe;
            },
            onStop: (callback) => {
              listeners.poeStop = callback;

              return unsubscribe;
            },
          },
        ),
        profiles: createBridgeDomain<DashboardE2EElectron["profiles"]>(
          "profiles",
          {
            create: async (input) => {
              const createdProfile: Profile = {
                ...fixture.profile,
                captureTarget: null,
                cropRegions: [],
                game: input.game ?? null,
                id: `profile-${profilesById.size + 1}`,
                name: input.name,
                overlayPlacements: [],
                createdAt: fixture.now,
                updatedAt: fixture.now,
              };
              calls.profileCreates.push(
                clone({
                  game: input.game ?? null,
                  id: createdProfile.id,
                  name: input.name,
                }),
              );
              profilesById.set(createdProfile.id, createdProfile);
              listeners.profileChanged?.(
                clone(Array.from(profilesById.values())),
              );

              return clone(createdProfile);
            },
            delete: async (id) => {
              calls.profileDeletes.push(id);
              profilesById.delete(id);
              listeners.profileChanged?.(
                clone(Array.from(profilesById.values())),
              );
            },
            list: async () => clone(Array.from(profilesById.values())),
            onChanged: (callback) => {
              listeners.profileChanged = callback;

              return unsubscribe;
            },
            select: async (id) => {
              calls.profileSelects.push(id);
              settings = { ...settings, selectedProfileId: id };
              listeners.settingsChanged?.(clone(settings));
            },
            update: async (input) => {
              calls.profileUpdates.push(clone(input));
              const profile = profilesById.get(input.id) ?? fixture.profile;
              const updatedProfile: Profile = {
                ...profile,
                captureTarget:
                  input.captureTarget !== undefined
                    ? input.captureTarget
                    : profile.captureTarget,
                cropRegions: input.cropRegions ?? profile.cropRegions,
                name: input.name ?? profile.name,
                overlayPlacements:
                  input.overlayPlacements ?? profile.overlayPlacements,
                targetFps: input.targetFps ?? profile.targetFps,
                updatedAt: fixture.now,
              };
              profilesById.set(input.id, updatedProfile);
              listeners.profileChanged?.(
                clone(Array.from(profilesById.values())),
              );

              return clone(updatedProfile);
            },
          },
        ),
        recordingStorage: createBridgeDomain<
          DashboardE2EElectron["recordingStorage"]
        >("recordingStorage", {
          getRecording: async (recordingId) => {
            const bookmark = bookmarks.find(
              (item) => item.activeRecordingId === recordingId,
            );
            if (!bookmark) {
              return null;
            }

            return {
              mediaUrl: `hinekora-media://run-recording/${recordingId}`,
              recording: {
                createdAt: bookmark.occurredAt,
                durationSeconds: bookmark.activeRecordingDurationSeconds,
                exists: true,
                fileName: `${recordingId}.mp4`,
                id: recordingId,
                path: `C:/Hinekora/Recordings/${recordingId}.mp4`,
                sizeBytes: 1024 * 1024,
                sourceGame: bookmark.sourceGame,
                sourceLeague: bookmark.sourceLeague,
                startedAt: bookmark.occurredAt,
                stoppedAt: bookmark.updatedAt,
                updatedAt: bookmark.updatedAt,
              },
            };
          },
          getUsage: async () => clone(fixture.recordingStorageUsage),
          listRecordingLibrary: async () => clone(emptyRecordingPage),
        }),
        replayClips: createBridgeDomain<DashboardE2EElectron["replayClips"]>(
          "replayClips",
          {
            listLibrary: async () => ({
              availableLeagues: ["Standard", "Runes of Aldur"],
              items: [],
              pageCount: 0,
              pageIndex: 0,
              pageSize: 20,
              sortBy: "createdAt",
              sortDirection: "desc",
              totalCount: 0,
            }),
            onStatusChanged: () => unsubscribe,
          },
        ),
        savedEdits: createBridgeDomain<DashboardE2EElectron["savedEdits"]>(
          "savedEdits",
          {
            listLibrary: async () => ({
              availableLeagues: [],
              globalTotalCount: 0,
              items: [],
              pageCount: 1,
              pageIndex: 0,
              pageSize: 20,
              sortBy: "updatedAt",
              sortDirection: "desc",
              totalCount: 0,
            }),
          },
        ),
        settings: createBridgeDomain<DashboardE2EElectron["settings"]>(
          "settings",
          {
            get: async () => clone(settings),
            onChanged: (callback) => {
              listeners.settingsChanged = callback;

              return unsubscribe;
            },
            update: async (input) => {
              calls.settingsUpdates.push(clone(input));
              settings = { ...settings, ...input };
              listeners.settingsChanged?.(clone(settings));

              return clone(settings);
            },
          },
        ),
        storage: createBridgeDomain<DashboardE2EElectron["storage"]>(
          "storage",
          {
            checkDiskSpace: async () => clone(diskCheck),
            getInfo: async () => clone(fixture.storageInfo),
          },
        ),
        stateTransfer: createBridgeDomain<
          DashboardE2EElectron["stateTransfer"]
        >("stateTransfer", {}),
        updater: createBridgeDomain<DashboardE2EElectron["updater"]>(
          "updater",
          {
            getRecentReleases: async () => [],
            onDownloadProgress: (callback) => {
              listeners.updateProgress = callback;

              return unsubscribe;
            },
            onUpdateAvailable: (callback) => {
              listeners.updateAvailable = callback;

              return unsubscribe;
            },
          },
        ),
      };

      (
        window as unknown as {
          electron: DashboardE2EElectron;
        }
      ).electron = electron;
      (
        window as unknown as {
          __HINEKORA_DASHBOARD_E2E_API__: DashboardE2EApi;
        }
      ).__HINEKORA_DASHBOARD_E2E_API__ = {
        emitAuraLockChanged: (locked) => {
          emitAuraLock(locked);
        },
        emitPoeProcessStart: (state) => {
          poeProcessState = clone(state);
          listeners.poeStart?.(clone(poeProcessState));
          listeners.captureRefreshRequested?.();
        },
        emitPoeProcessStop: (state) => {
          poeProcessState = clone(
            state ?? {
              isRunning: false,
              processName: "",
            },
          );
          listeners.poeStop?.(clone(poeProcessState));
          listeners.captureRefreshRequested?.();
        },
        emitRecorderOverlayVisibility: (visible) => {
          emitRecorderVisibility(visible);
        },
        setCaptureSources: (sources) => {
          captureSources = clone(sources);
        },
      };
    },
    {
      bridgeFactorySource: e2eBridgeDomainFactorySource,
      fixture: createDashboardE2EFixture(options),
    },
  );

  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Live Preview" }),
  ).toBeVisible();
}

async function emitDashboardAuraLockChanged(page: Page, locked: boolean) {
  await page.evaluate((nextLocked) => {
    const e2eWindow = window as unknown as {
      __HINEKORA_DASHBOARD_E2E_API__: DashboardE2EApi;
    };

    e2eWindow.__HINEKORA_DASHBOARD_E2E_API__.emitAuraLockChanged(nextLocked);
  }, locked);
}

async function getDashboardE2ECalls(page: Page): Promise<DashboardE2ECalls> {
  return page.evaluate(() => {
    const e2eWindow = window as unknown as {
      __HINEKORA_DASHBOARD_E2E__: DashboardE2ECalls;
    };

    return e2eWindow.__HINEKORA_DASHBOARD_E2E__;
  });
}

async function emitDashboardRecorderOverlayVisibility(
  page: Page,
  visible: boolean,
) {
  await page.evaluate((nextVisible) => {
    const e2eWindow = window as unknown as {
      __HINEKORA_DASHBOARD_E2E_API__: DashboardE2EApi;
    };

    e2eWindow.__HINEKORA_DASHBOARD_E2E_API__.emitRecorderOverlayVisibility(
      nextVisible,
    );
  }, visible);
}

async function emitDashboardPoeProcessStart(
  page: Page,
  state: PoeProcessState,
) {
  await page.evaluate((nextState) => {
    const e2eWindow = window as unknown as {
      __HINEKORA_DASHBOARD_E2E_API__: DashboardE2EApi;
    };

    e2eWindow.__HINEKORA_DASHBOARD_E2E_API__.emitPoeProcessStart(nextState);
  }, state);
}

async function emitDashboardPoeProcessStop(
  page: Page,
  state?: PoeProcessState,
) {
  await page.evaluate((nextState) => {
    const e2eWindow = window as unknown as {
      __HINEKORA_DASHBOARD_E2E_API__: DashboardE2EApi;
    };

    e2eWindow.__HINEKORA_DASHBOARD_E2E_API__.emitPoeProcessStop(nextState);
  }, state);
}

async function setDashboardCaptureSources(
  page: Page,
  sources: CapturePreviewSource[],
) {
  await page.evaluate((nextSources) => {
    const e2eWindow = window as unknown as {
      __HINEKORA_DASHBOARD_E2E_API__: DashboardE2EApi;
    };

    e2eWindow.__HINEKORA_DASHBOARD_E2E_API__.setCaptureSources(nextSources);
  }, sources);
}

async function scheduleDashboardCaptureSources(
  page: Page,
  sources: CapturePreviewSource[],
  delayMs: number,
) {
  await page.evaluate(
    ({ delay, nextSources }) => {
      const e2eWindow = window as unknown as {
        __HINEKORA_DASHBOARD_E2E_API__: DashboardE2EApi;
      };

      window.setTimeout(() => {
        e2eWindow.__HINEKORA_DASHBOARD_E2E_API__.setCaptureSources(nextSources);
      }, delay);
    },
    { delay: delayMs, nextSources: sources },
  );
}

async function expectNoUnexpectedDashboardBridgeCalls(page: Page) {
  const unexpectedBridgeCalls = await page.evaluate(() => {
    const e2eWindow = window as unknown as {
      __HINEKORA_DASHBOARD_E2E__?: DashboardE2ECalls;
    };

    return e2eWindow.__HINEKORA_DASHBOARD_E2E__?.unexpectedBridgeCalls ?? [];
  });

  expect(unexpectedBridgeCalls).toEqual([]);
}

export {
  emitDashboardAuraLockChanged,
  emitDashboardPoeProcessStart,
  emitDashboardPoeProcessStop,
  emitDashboardRecorderOverlayVisibility,
  expectNoUnexpectedDashboardBridgeCalls,
  getDashboardE2ECalls,
  scheduleDashboardCaptureSources,
  setDashboardCaptureSources,
  setupDashboardE2E,
};
