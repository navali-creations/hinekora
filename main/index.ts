import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { app, protocol } from "electron";

import { AppService } from "./modules/app";
import { AppSetupService } from "./modules/app-setup";
import { BookmarksService } from "./modules/bookmarks";
import { CapturePreviewService } from "./modules/capture-preview";
import { CaptureProfilesService } from "./modules/capture-profiles";
import {
  type ClientLogActivityBatchEvent,
  type ClientLogDeathEvent,
  ClientLogService,
} from "./modules/client-log";
import { DatabaseService } from "./modules/database";
import { resolveMainDatabasePath } from "./modules/database/Database.paths";
import { DiagLogService } from "./modules/diag-log";
import { EditorService } from "./modules/editor";
import { KeybindsService } from "./modules/keybinds";
import { MainWindowService } from "./modules/main-window";
import { ManagedRecorderService } from "./modules/managed-recorder";
import { setupMediaProtocol } from "./modules/media-protocol";
import { OverlayWindowsService } from "./modules/overlay-windows";
import { PoeProcessService } from "./modules/poe-process";
import { ProfilesService } from "./modules/profiles";
import { RecordingStorageService } from "./modules/recording-storage";
import { ReplayClipsService } from "./modules/replay-clips";
import { SavedEditsService } from "./modules/saved-edits";
import { SentryService } from "./modules/sentry";
import { captureSentryException } from "./modules/sentry/Sentry.reporter";
import { SettingsStoreService } from "./modules/settings-store";
import { StateTransferService } from "./modules/state-transfer";
import { StorageService } from "./modules/storage";
import { UpdaterService } from "./modules/updater";
import {
  configureAppLogFile,
  createSafePathLogFields,
  getAppLogFilePath,
  logError,
  logInfo,
  logWarn,
} from "./utils/app-log";
import { requestRecorderOverlayOnStartup } from "./utils/recorder-overlay-startup";
import { scheduleRecordingStorageInitialization } from "./utils/recording-storage-startup";
import { handleSquirrelStartupEvent } from "./utils/squirrel-startup";

function registerPrivilegedProtocols(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "hinekora-media",
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
    {
      scheme: "hinekora-editor-export",
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

function initializeLocalDiagnostics(): void {
  try {
    app.setAppLogsPath();
    configureAppLogFile(join(app.getPath("logs"), "main.log"));
    DiagLogService.getInstance().initialize({ startReporter: true });
    logInfo("startup", "Local diagnostics initialized", {
      ...createSafePathLogFields(getAppLogFilePath(), "appLog"),
      ...createSafePathLogFields(app.getPath("crashDumps"), "crashDump"),
    });
  } catch (error) {
    logWarn("startup", "Local diagnostics initialization failed", {
      error: error instanceof Error ? error.message : "Diagnostics failed",
    });
  }
}

function wireClientLogConsumers(
  clientLog: ClientLogService,
  bookmarks: BookmarksService,
  replayClips: ReplayClipsService,
): void {
  clientLog.on("activity", (event: ClientLogActivityBatchEvent) => {
    bookmarks.handleClientLogActivityEvents(event.game, event.events);
  });
  clientLog.on("activity-seed", (event: ClientLogActivityBatchEvent) => {
    bookmarks.seedClientLogActivityState(event.game, event.events);
  });
  clientLog.on("death", (event: ClientLogDeathEvent) => {
    bookmarks.handleClientLogDeath(event);
    void replayClips.handleDeathEvent(event);
  });
}

async function bootstrap(): Promise<void> {
  const singleInstanceLocked = app.requestSingleInstanceLock();
  if (!singleInstanceLocked) {
    app.quit();
    return;
  }

  initializeLocalDiagnostics();

  if (process.env.E2E_TESTING !== "true") {
    await SentryService.getInstance().initialize();
    logInfo("startup", "Sentry initialized", {
      initialized: SentryService.getInstance().isInitialized(),
    });
  }

  await app.whenReady();

  logInfo("startup", "App ready", {
    isPackaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
  });

  const databasePath = resolveMainDatabasePath(
    app.getPath("userData"),
    app.isPackaged,
  );
  DatabaseService.getInstance(databasePath);
  logInfo("startup", "Database initialized", {
    ...createSafePathLogFields(databasePath, "database"),
  });

  const appService = AppService.getInstance();
  appService.registerShutdownCleanup();
  appService.registerSystemPowerCleanup();
  logInfo("startup", "App service initialized");

  AppSetupService.getInstance();
  logInfo("startup", "App setup initialized");

  CapturePreviewService.getInstance();
  logInfo("startup", "Capture preview initialized");

  const settingsStore = SettingsStoreService.getInstance();
  const settings = settingsStore.get();
  settingsStore.applyStartupSettings(settings);
  if (!settings.telemetryCrashReporting) {
    await SentryService.getInstance().disable();
  }
  logInfo("startup", "Settings store initialized");

  const profilesService = ProfilesService.getInstance();
  profilesService.ensureDefaultProfile();
  logInfo("startup", "Profiles initialized");

  const captureProfilesService = CaptureProfilesService.getInstance();
  captureProfilesService.ensureDefaultProfiles();
  logInfo("startup", "Capture profiles initialized");

  const managedRecorder = ManagedRecorderService.getInstance();
  logInfo("startup", "Managed recorder initialized");

  const poeProcessService = PoeProcessService.getInstance();
  logInfo("startup", "PoE process monitor initialized");

  const recordingStorage = RecordingStorageService.getInstance();
  logInfo("startup", "Recording storage service initialized");

  StorageService.getInstance();
  logInfo("startup", "Storage initialized");

  const replayClips = ReplayClipsService.getInstance();
  logInfo("startup", "Replay clips initialized");

  setupMediaProtocol({
    resolveClipPreviewPath: (id) => replayClips.getPreviewMediaPath(id),
    resolveReplayClipPath: (id) => replayClips.getMediaPath(id),
    resolveRunRecordingPath: (id) => recordingStorage.getRecordingMediaPath(id),
  });
  logInfo("startup", "Media protocol initialized");

  EditorService.getInstance();
  logInfo("startup", "Editor initialized");

  SavedEditsService.getInstance();
  logInfo("startup", "Saved edits initialized");

  const bookmarks = BookmarksService.getInstance();
  logInfo("startup", "Bookmarks initialized");

  const keybinds = KeybindsService.getInstance();
  keybinds.initialize();
  logInfo("startup", "Keybinds initialized");

  const overlayWindows = OverlayWindowsService.getInstance();
  logInfo("startup", "Overlay windows initialized");

  StateTransferService.getInstance();
  logInfo("startup", "State transfer initialized");

  UpdaterService.getInstance();
  logInfo("startup", "Updater initialized");

  const clientLog = ClientLogService.getInstance();
  wireClientLogConsumers(clientLog, bookmarks, replayClips);
  clientLog.initializeFromSettings();
  logInfo("startup", "Client log initialized");

  await MainWindowService.getInstance().createMainWindow();
  logInfo("startup", "Main window created");

  scheduleRecordingStorageInitialization(recordingStorage);

  logInfo("startup", "Aura overlay request initialized", {
    requested: overlayWindows.requestPersistentAuraOverlay(),
  });

  poeProcessService.initialize();
  logInfo("startup", "PoE process monitor started");

  managedRecorder.initializeAutoStart();
  logInfo("startup", "Managed recorder auto-start initialized");

  await requestRecorderOverlayOnStartup(settings, overlayWindows);

  app.on("activate", () => {
    void MainWindowService.getInstance().createMainWindow();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

if (
  !handleSquirrelStartupEvent({
    argv: process.argv,
    execPath: process.execPath,
    exists: existsSync,
    platform: process.platform,
    quit: () => app.quit(),
    spawnProcess: spawn,
  })
) {
  registerPrivilegedProtocols();

  void bootstrap().catch((error) => {
    captureSentryException(
      error instanceof Error ? error : new Error(String(error)),
      {
        tags: { module: "main", operation: "bootstrap" },
      },
    );
    logError("startup", "Fatal startup error", {
      error: error instanceof Error ? error.message : String(error),
    });
    app.quit();
  });
}
