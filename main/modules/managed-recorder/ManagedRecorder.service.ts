import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { basename, dirname, join, normalize, resolve } from "node:path";

import { app, screen } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import { CaptureProfilesService } from "~/main/modules/capture-profiles";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import {
  DEFAULT_RECORDING_DIRECTORY_NAME,
  RECORDING_STORAGE_DIRECTORY_NAMES,
} from "~/main/modules/recording-storage/RecordingStorage.constants";
import { resolveRecordingStorageMediaDirectory } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { isProcessStateForGame, refreshPoeProcessState } from "~/main/pollers";
import {
  createSafePathLogFields,
  logError,
  logInfo,
  logInfoSync,
  logWarn,
} from "~/main/utils/app-log";
import { isAsarVirtualPath } from "~/main/utils/asar-path";
import {
  assertOptionalBoolean,
  handleValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import {
  type CaptureTarget,
  type GameId,
  type ManagedRecorderStatus,
  maxRewindSaveSeconds,
  type RecordingAutoStartMode,
  rewindBufferSeconds,
} from "~/types";
import { ManagedRecorderChannel } from "./ManagedRecorder.channels";
import { resolveNativeDisplayResolution } from "./ManagedRecorder.display";
import type {
  ManagedRecorderAudioDeviceKind,
  ManagedRecorderAudioDevices,
  ManagedRecorderCaptureMode,
  ManagedRecorderListAudioDevicesOptions,
  ManagedReplayKind,
  ManagedReplaySaveResult,
} from "./ManagedRecorder.dto";
import {
  importNoobsModule,
  loadNoobsApi,
  type NoobsApi,
  type NoobsSignal,
} from "./ManagedRecorder.noobs";
import {
  publishManagedRecorderCaptureMode,
  publishManagedRecorderStatus,
} from "./ManagedRecorder.status-publisher";
import {
  resolveReplaySaveWaitMs as calculateReplaySaveWaitMs,
  collectRecordingFilePaths,
  createFittedSceneItemPosition,
  findNewestRecordingFile,
  formatRecordingResolution,
  type ManagedRecorderResolution,
  type ManagedRecorderProperty as NoobsProperty,
  parseRecordingResolution,
  resolveManagedCaptureSourceType,
  resolveManagedRecordingResolution,
  resolveManagedVideoEncoder,
  resolveManagedVideoEncoderSettings,
  selectAudioDevices,
  selectDisplayMonitor,
  selectWgcCaptureMethod,
  selectWindow,
} from "./ManagedRecorder.utils";

const currentDir = __dirname;

const MANAGED_RUNTIME = "packaged_obs";
const MANAGED_RECORDING_CONTAINER = "mp4";
const REPLAY_BUFFER_PLAYBACK_ENCODER = "hardware_h264";
const MANAGED_AUDIO_SOURCE_TYPES: Record<
  ManagedRecorderAudioDeviceKind,
  string
> = {
  input: "wasapi_input_capture",
  output: "wasapi_output_capture",
};
const MANAGED_AUDIO_SOURCE_NAMES: Record<
  ManagedRecorderAudioDeviceKind,
  string
> = {
  input: "Hinekora Audio Input",
  output: "Hinekora Audio Output",
};
const MANAGED_AUDIO_SOURCE_PROBE_NAMES: Record<
  ManagedRecorderAudioDeviceKind,
  string
> = {
  input: "Hinekora Audio Input Probe",
  output: "Hinekora Audio Output Probe",
};
const RECORDING_STOP_WAIT_MS = 5_000;
const RECORDING_SAVE_WAIT_MS = 30_000;
const RECORDING_DETECTION_WAIT_MS = 15_000;
const RECORDING_FILE_POLL_MS = 1_000;
const RECORDING_FILE_STABLE_MS = 1_000;
const REPLAY_CONVERSION_STOP_DELAY_MS = 250;
const AUDIO_DEVICE_PROBE_RETRY_MS = 250;
const AUDIO_DEVICE_PROBE_EMPTY_COOLDOWN_MS = 3_000;
const AUTO_START_CAPTURE_RETRY_MS = 2_500;
const CAPTURE_WINDOW_UNAVAILABLE_ERROR =
  "Selected capture window is not available yet";
const NATIVE_RECORDING_RESOLUTION = "native";
const WINDOWS_PATH_DELIMITER = ";";
const FALLBACK_RECORDING_RESOLUTION: ManagedRecorderResolution = {
  width: 1920,
  height: 1080,
};
const REPLAY_CLIP_OUTPUT_RESOLUTION: ManagedRecorderResolution = {
  width: 1920,
  height: 1080,
};
const REPLAY_CLIP_MAX_FPS = 60;
const MANAGED_RECORDER_LOG_SCOPE = "managed-recorder";
type ManagedRecordingMode = "buffer" | "run";

interface RecordingFileSnapshot {
  size: number;
  mtimeMs: number;
}

interface BufferedReplaySaveOptions {
  kind: ManagedReplayKind;
  restartBufferAfterSave: boolean;
}

interface ManagedRecorderChangeSnapshot {
  captureMode: ManagedRecorderCaptureMode;
  status: ManagedRecorderStatus;
}

type ManagedRecorderChangeListener = (
  snapshot: ManagedRecorderChangeSnapshot,
) => void;

interface RecordingSession {
  directory: string;
  existingRecordingPaths: Set<string>;
  startedAt: string;
}

interface EnsureNoobsRuntimeInitializedOptions {
  publishStatus?: boolean;
}

interface ManagedRecorderGameRunningSnapshot {
  gameRunning: boolean;
}

class ManagedRecorderService {
  private static instance: ManagedRecorderService | null = null;

  private readonly changeListeners = new Set<ManagedRecorderChangeListener>();
  private noobs: NoobsApi | null = null;
  private noobsRuntimeInitialized = false;
  private status: ManagedRecorderStatus = {
    available: false,
    gameRunning: false,
    activeGame: null,
    initialized: false,
    bufferActive: false,
    recording: false,
    isStartingRecording: false,
    isStoppingRecording: false,
    runRecordingActive: false,
    runtime: MANAGED_RUNTIME,
    runtimePath: null,
    outputDirectory: null,
    outputResolution: NATIVE_RECORDING_RESOLUTION,
    fps: 30,
    encoder: REPLAY_BUFFER_PLAYBACK_ENCODER,
    lastRecordingPath: null,
    runRecordingPath: null,
    activeSessionDirectory: null,
    recordingStartedAt: null,
    runRecordingStartedAt: null,
    error: "Packaged OBS runtime is not installed yet",
  };
  private captureMode: ManagedRecorderCaptureMode = "rewind";
  private activeRecordingMode: ManagedRecordingMode | null = null;
  private startingRecordingMode: ManagedRecordingMode | null = null;
  private captureSourceName: string | null = null;
  private captureSourceKey: string | null = null;
  private captureSourceResolution: ManagedRecorderResolution | null = null;
  private audioSourceNames: Record<
    ManagedRecorderAudioDeviceKind,
    string | null
  > = {
    input: null,
    output: null,
  };
  private audioSourceKeys: Record<
    ManagedRecorderAudioDeviceKind,
    string | null
  > = {
    input: null,
    output: null,
  };
  private activeRecordingBaselinePaths = new Set<string>();
  private recordingStopWaiter: (() => void) | null = null;
  private activeReplaySaveRequest: Promise<ManagedReplaySaveResult> | null =
    null;
  private audioDeviceListRequest: Promise<ManagedRecorderAudioDevices> | null =
    null;
  private audioDevicesCache: ManagedRecorderAudioDevices | null = null;
  private audioDeviceProbeCooldownUntilMs = 0;
  private gameRunningRefreshRequest: Promise<boolean> | null = null;
  private gameRunningRefreshVersion = 0;
  private offlineStopRequest: Promise<void> | null = null;
  private autoStartRequest: Promise<ManagedRecorderStatus | null> | null = null;
  private autoStartRequestNeedsRecheck = false;
  private autoStartRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private previousAutoStartConfigurationKey = "";

  static getInstance(): ManagedRecorderService {
    if (!ManagedRecorderService.instance) {
      ManagedRecorderService.instance = new ManagedRecorderService();
    }

    return ManagedRecorderService.instance;
  }

  constructor() {
    this.refreshStatusFromSettings();
    this.setupAutoStartSettingsListener();
    this.setupAutoStartCaptureProfilesListener();
    this.setupHandlers();
  }

  getStatus(): ManagedRecorderStatus {
    this.refreshRuntimeAvailability();

    return this.status;
  }

  getCaptureMode(): ManagedRecorderCaptureMode {
    return this.captureMode;
  }

  onDidChange(listener: ManagedRecorderChangeListener): () => void {
    this.changeListeners.add(listener);

    return () => {
      this.changeListeners.delete(listener);
    };
  }

  initializeAutoStart(): void {
    void this.attemptConfiguredAutoStartWhenGameRunning("startup", {
      refreshGameRunning: true,
    }).catch((error) => {
      logWarn(MANAGED_RECORDER_LOG_SCOPE, "Automatic recorder startup failed", {
        error: safeErrorMessage(error),
      });
    });
  }

  async listAudioDevices(
    options: ManagedRecorderListAudioDevicesOptions = {},
  ): Promise<ManagedRecorderAudioDevices> {
    if (this.audioDeviceListRequest) {
      return this.audioDeviceListRequest;
    }

    if (
      options.forceRefresh !== true &&
      this.audioDeviceProbeCooldownUntilMs > Date.now()
    ) {
      return this.audioDevicesCache ?? { input: [], output: [] };
    }

    if (options.forceRefresh !== true && this.audioDevicesCache) {
      return this.audioDevicesCache;
    }

    this.audioDeviceListRequest = this.resolveAudioDevices().finally(() => {
      this.audioDeviceListRequest = null;
    });

    return this.audioDeviceListRequest;
  }

  private async resolveAudioDevices(): Promise<ManagedRecorderAudioDevices> {
    try {
      await this.ensureNoobsRuntimeInitialized({ publishStatus: false });

      const devices = await this.resolveAudioDevicesFromSources();
      if (devices.output.length > 0) {
        this.audioDevicesCache = devices;
        this.audioDeviceProbeCooldownUntilMs = 0;
      } else {
        this.audioDeviceProbeCooldownUntilMs =
          Date.now() + AUDIO_DEVICE_PROBE_EMPTY_COOLDOWN_MS;
      }

      return devices;
    } catch (error) {
      const message = safeErrorMessage(error);
      logWarn(MANAGED_RECORDER_LOG_SCOPE, "Failed to list audio devices", {
        error: message,
      });
      this.audioDeviceProbeCooldownUntilMs =
        Date.now() + AUDIO_DEVICE_PROBE_EMPTY_COOLDOWN_MS;

      return this.audioDevicesCache ?? { input: [], output: [] };
    }
  }

  private async resolveAudioDevicesFromSources(): Promise<ManagedRecorderAudioDevices> {
    const devices = {
      input: this.listAudioDevicesForKind("input"),
      output: this.listAudioDevicesForKind("output"),
    };
    if (devices.output.length > 0) {
      return devices;
    }

    await this.waitForAudioDeviceProbeRetry();

    const retryDevices = {
      input: this.listAudioDevicesForKind("input"),
      output: this.listAudioDevicesForKind("output"),
    };
    if (retryDevices.output.length === 0) {
      logWarn(
        MANAGED_RECORDER_LOG_SCOPE,
        "Audio output device probe returned no devices",
      );
    }

    return retryDevices;
  }

  private waitForAudioDeviceProbeRetry(): Promise<void> {
    return new Promise((resolveRetry) => {
      setTimeout(resolveRetry, AUDIO_DEVICE_PROBE_RETRY_MS);
    });
  }

  setCaptureMode(mode: ManagedRecorderCaptureMode): ManagedRecorderCaptureMode {
    this.updateCaptureMode(mode);

    return this.captureMode;
  }

  async startBuffer(): Promise<ManagedRecorderStatus> {
    if (this.status.bufferActive) {
      return this.status;
    }

    if (this.status.runRecordingActive) {
      this.setStatus({
        error: "Stop full run recording before starting the replay buffer",
      });
      return this.status;
    }

    if (!this.beginRecordingStart("buffer")) {
      return this.status;
    }

    try {
      if (!(await this.ensureActiveGameRunning())) {
        this.setStatus({ isStartingRecording: false, activeGame: null });
        return this.status;
      }

      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Replay buffer start requested", {
        outputDirectorySet: this.status.outputDirectory !== null,
        initialized: this.status.initialized,
      });
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "Initializing recorder for replay buffer",
      );
      await this.initialize();
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Recorder initialization ready", {
        initialized: this.status.initialized,
        runtimePathSet: this.status.runtimePath !== null,
        outputDirectorySet: this.status.outputDirectory !== null,
      });
      if (!this.noobs) {
        throw new Error("noobs module is not installed");
      }

      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "Calling noobs.SetBuffering for replay buffer",
      );
      this.noobs.SetBuffering(true);
      this.activeRecordingMode = "buffer";
      const session = this.prepareRecordingSession(this.activeRecordingMode);
      this.activeRecordingBaselinePaths = session.existingRecordingPaths;
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.StartBuffer", {
        ...createSafePathLogFields(session.directory, "session"),
        existingRecordingCount: session.existingRecordingPaths.size,
      });
      this.noobs.StartBuffer();
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.StartBuffer returned");
      this.updateCaptureMode("rewind");
      this.setStatus({
        bufferActive: true,
        recording: true,
        isStartingRecording: false,
        activeSessionDirectory: session.directory,
        recordingStartedAt: session.startedAt,
        error: null,
      });
      /* v8 ignore next -- ensureActiveGameRunning refreshes activeGame before startup; fallback protects stale status mutations. */
      const sessionGame =
        this.status.activeGame ?? this.resolveConfiguredGame();
      BookmarksService.getInstance().beginRewindSession({
        game: sessionGame,
        league: SettingsStoreService.getInstance().get().activeLeague,
        startedAt: session.startedAt,
      });
      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Replay buffer started", {
        ...createSafePathLogFields(session.directory, "session"),
      });
    } catch (error) {
      this.activeRecordingMode = null;
      this.activeRecordingBaselinePaths = new Set();
      logError(MANAGED_RECORDER_LOG_SCOPE, "Replay buffer start failed", {
        error: safeErrorMessage(error),
      });
      this.setStatus({
        bufferActive: false,
        recording: false,
        isStartingRecording: false,
        activeGame: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        error: safeErrorMessage(error),
      });
    } finally {
      this.finishRecordingStart("buffer");
    }

    return this.status;
  }

  async stopBuffer(): Promise<ManagedRecorderStatus> {
    if (!this.status.bufferActive) {
      return this.status;
    }

    this.setStatus({ isStoppingRecording: true, error: null });
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Stopping replay buffer", {
      durationSeconds: this.getActiveRecordingDurationSeconds(),
    });

    try {
      if (this.noobs && this.status.initialized && this.status.bufferActive) {
        const stopped = this.waitForRecordingStop();
        this.noobs.StopRecording();
        await stopped;
        this.removeCaptureSource();
        this.removeAudioSources();
      }

      this.activeRecordingMode = null;
      this.activeRecordingBaselinePaths = new Set();
      this.setStatus({
        bufferActive: false,
        recording: false,
        isStoppingRecording: false,
        activeGame: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        error: null,
      });
      BookmarksService.getInstance().endRewindSession();
      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Replay buffer stopped", {
        saved: false,
      });
      this.cleanupRecordingStorage([]);
    } catch (error) {
      logError(MANAGED_RECORDER_LOG_SCOPE, "Replay buffer stop failed", {
        error: safeErrorMessage(error),
      });
      this.setStatus({
        isStoppingRecording: false,
        error: safeErrorMessage(error),
      });
    }

    return this.status;
  }

  async startRunRecording(): Promise<ManagedRecorderStatus> {
    if (this.status.runRecordingActive) {
      return this.status;
    }

    if (this.status.bufferActive) {
      this.setStatus({
        error: "Stop the replay buffer before starting full run recording",
      });
      return this.status;
    }

    if (!this.beginRecordingStart("run")) {
      return this.status;
    }

    try {
      if (!(await this.ensureActiveGameRunning())) {
        this.setStatus({ isStartingRecording: false, activeGame: null });
        return this.status;
      }

      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Starting full run recording");
      await this.initialize();
      if (!this.noobs) {
        throw new Error("noobs module is not installed");
      }

      this.noobs.SetBuffering(false);
      this.activeRecordingMode = "run";
      const session = this.prepareRecordingSession(this.activeRecordingMode);
      this.activeRecordingBaselinePaths = session.existingRecordingPaths;
      this.noobs.StartRecording(0);
      this.updateCaptureMode("session");
      this.setStatus({
        bufferActive: false,
        recording: true,
        isStartingRecording: false,
        runRecordingActive: true,
        runRecordingPath: this.resolveSavedRecordingPath(
          session.directory,
          Date.now() - 1_000,
          session.existingRecordingPaths,
        ),
        activeSessionDirectory: session.directory,
        recordingStartedAt: session.startedAt,
        runRecordingStartedAt: session.startedAt,
        error: null,
      });
      /* v8 ignore next -- ensureActiveGameRunning refreshes activeGame before startup; fallback protects stale status mutations. */
      const sessionGame =
        this.status.activeGame ?? this.resolveConfiguredGame();
      BookmarksService.getInstance().beginRecordingSession({
        game: sessionGame,
        league: SettingsStoreService.getInstance().get().activeLeague,
        startedAt: session.startedAt,
      });
      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Full run recording started", {
        ...createSafePathLogFields(session.directory, "session"),
      });
    } catch (error) {
      this.activeRecordingMode = null;
      this.activeRecordingBaselinePaths = new Set();
      logError(MANAGED_RECORDER_LOG_SCOPE, "Full run recording start failed", {
        error: safeErrorMessage(error),
      });
      this.setStatus({
        recording: false,
        isStartingRecording: false,
        runRecordingActive: false,
        runRecordingPath: null,
        activeGame: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: safeErrorMessage(error),
      });
    } finally {
      this.finishRecordingStart("run");
    }

    return this.status;
  }

  async stopRunRecording(): Promise<ManagedRecorderStatus> {
    if (!this.status.runRecordingActive) {
      return this.status;
    }

    this.setStatus({ isStoppingRecording: true, error: null });
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Stopping full run recording");

    try {
      let savedPath: string | null = null;
      const sessionGame = this.status.activeGame ?? null;
      const outputDirectory = this.status.activeSessionDirectory;
      const runRecordingStartedAt = this.status.runRecordingStartedAt;
      const modifiedAfterMs = this.status.runRecordingStartedAt
        ? new Date(this.status.runRecordingStartedAt).getTime() - 1_000
        : 0;

      if (this.noobs && this.status.initialized) {
        const stopped = this.waitForRecordingStop();
        this.noobs.StopRecording();
        await stopped;

        if (outputDirectory) {
          savedPath = await this.waitForSavedRecording(
            outputDirectory,
            modifiedAfterMs,
            RECORDING_SAVE_WAIT_MS,
            this.activeRecordingBaselinePaths,
          );
        }
        savedPath = savedPath ?? this.noobs.GetLastRecording();
        this.removeCaptureSource();
        this.removeAudioSources();
      }

      this.activeRecordingMode = null;
      this.activeRecordingBaselinePaths = new Set();
      this.setStatus({
        recording: false,
        runRecordingPath: savedPath ?? this.status.runRecordingPath,
        lastRecordingPath: savedPath ?? this.status.lastRecordingPath,
        error: null,
      });
      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Full run recording stopped", {
        saved: savedPath !== null,
        ...createSafePathLogFields(savedPath, "recording"),
      });
      if (savedPath && runRecordingStartedAt) {
        const settings = SettingsStoreService.getInstance().get();
        const configuredGame =
          sessionGame ?? this.resolveConfiguredGame(settings);
        const recordingStorage = RecordingStorageService.getInstance();
        const recordingMetadata = recordingStorage.registerRunRecording({
          path: savedPath,
          startedAt: runRecordingStartedAt,
          stoppedAt: new Date().toISOString(),
          sourceGame: configuredGame,
          sourceLeague: settings.activeLeague,
        });
        const recordingDetail = recordingMetadata?.id
          ? recordingStorage.getRecording(recordingMetadata.id)
          : null;
        if (recordingDetail) {
          BookmarksService.getInstance().finalizeRecordingSession(
            recordingDetail.recording,
          );
        } else {
          BookmarksService.getInstance().discardRecordingSession();
        }
      } else {
        BookmarksService.getInstance().discardRecordingSession();
      }
      this.setStatus({
        bufferActive: false,
        recording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runRecordingPath: savedPath ?? this.status.runRecordingPath,
        activeGame: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        lastRecordingPath: savedPath ?? this.status.lastRecordingPath,
        error: null,
      });
      this.cleanupRecordingStorage([savedPath]);
    } catch (error) {
      BookmarksService.getInstance().discardRecordingSession();
      logError(MANAGED_RECORDER_LOG_SCOPE, "Full run recording stop failed", {
        error: safeErrorMessage(error),
      });
      this.setStatus({
        isStoppingRecording: false,
        error: safeErrorMessage(error),
      });
    }

    return this.status;
  }

  async saveReplay(
    seconds: number,
    kind: ManagedReplayKind = "death",
  ): Promise<ManagedReplaySaveResult> {
    if (this.activeReplaySaveRequest) {
      return this.activeReplaySaveRequest;
    }

    const request = this.runSaveReplay(seconds, kind).finally(() => {
      if (this.activeReplaySaveRequest === request) {
        this.activeReplaySaveRequest = null;
      }
    });
    this.activeReplaySaveRequest = request;

    return request;
  }

  async refreshGameRunningStatus(
    options: { forceRefresh?: boolean } = {},
  ): Promise<boolean> {
    if (this.gameRunningRefreshRequest && options.forceRefresh !== true) {
      return this.gameRunningRefreshRequest;
    }

    const refreshVersion = ++this.gameRunningRefreshVersion;
    const request = this.resolveActiveGameRunning()
      .then(async ({ gameRunning }) => {
        if (refreshVersion !== this.gameRunningRefreshVersion) {
          return this.status.gameRunning;
        }

        await this.applyGameRunningState(gameRunning);

        return gameRunning;
      })
      .catch((error) => {
        logWarn(
          MANAGED_RECORDER_LOG_SCOPE,
          "Active game running check failed",
          {
            error: safeErrorMessage(error),
          },
        );

        return this.status.gameRunning;
      });
    let trackedRequest: Promise<boolean>;
    trackedRequest = request.finally(() => {
      if (this.gameRunningRefreshRequest === trackedRequest) {
        this.gameRunningRefreshRequest = null;
      }
    });
    this.gameRunningRefreshRequest = trackedRequest;

    return trackedRequest;
  }

  async setGameRunningState(gameRunning: boolean): Promise<boolean> {
    const wasGameRunning = this.status.gameRunning;
    await this.applyGameRunningState(gameRunning);
    if (gameRunning && !wasGameRunning) {
      await this.attemptConfiguredAutoStart("game-running");
    }

    return gameRunning;
  }

  private async attemptConfiguredAutoStartWhenGameRunning(
    reason: "game-running" | "settings-changed" | "startup",
    options: { refreshGameRunning?: boolean } = {},
  ): Promise<ManagedRecorderStatus | null> {
    if (
      SettingsStoreService.getInstance().get().recordingAutoStartMode === "off"
    ) {
      return null;
    }

    const gameRunning =
      options.refreshGameRunning === true
        ? await this.refreshGameRunningStatus({ forceRefresh: true })
        : this.status.gameRunning;
    if (!gameRunning) {
      this.clearAutoStartRetry();
      return null;
    }

    return this.attemptConfiguredAutoStart(reason);
  }

  private async attemptConfiguredAutoStart(
    reason: "game-running" | "settings-changed" | "startup",
  ): Promise<ManagedRecorderStatus | null> {
    if (this.autoStartRequest) {
      this.autoStartRequestNeedsRecheck = true;
      return this.autoStartRequest;
    }

    const settings = SettingsStoreService.getInstance().get();
    if (settings.recordingAutoStartMode === "off") {
      this.clearAutoStartRetry();
      return null;
    }

    if (!this.status.gameRunning) {
      this.clearAutoStartRetry();
      return null;
    }

    if (
      this.status.recording ||
      this.status.isStartingRecording ||
      this.status.isStoppingRecording
    ) {
      return this.status;
    }

    this.autoStartRequest = this.runConfiguredAutoStart(
      settings.recordingAutoStartMode,
      reason,
    ).finally(() => {
      this.autoStartRequest = null;
      if (this.autoStartRequestNeedsRecheck) {
        this.autoStartRequestNeedsRecheck = false;
        void this.attemptConfiguredAutoStartWhenGameRunning(
          "settings-changed",
          {
            refreshGameRunning: true,
          },
        ).catch((error) => {
          logWarn(
            MANAGED_RECORDER_LOG_SCOPE,
            "Automatic recorder startup recheck failed",
            {
              error: safeErrorMessage(error),
            },
          );
        });
      }
    });

    return this.autoStartRequest;
  }

  private async runConfiguredAutoStart(
    mode: Exclude<RecordingAutoStartMode, "off">,
    reason: "game-running" | "settings-changed" | "startup",
  ): Promise<ManagedRecorderStatus> {
    logInfo(
      MANAGED_RECORDER_LOG_SCOPE,
      "Automatic recorder startup requested",
      {
        gameRunning: this.status.gameRunning,
        mode,
        reason,
      },
    );

    const status =
      mode === "recording"
        ? await this.startRunRecording()
        : await this.startBuffer();

    if (status.error === CAPTURE_WINDOW_UNAVAILABLE_ERROR) {
      this.scheduleAutoStartRetry(reason);
      return status;
    }

    if (status.recording) {
      this.clearAutoStartRetry();
    }

    return status;
  }

  private scheduleAutoStartRetry(
    reason: "game-running" | "settings-changed" | "startup",
  ): void {
    if (this.autoStartRetryTimer || !this.status.gameRunning) {
      return;
    }

    this.autoStartRetryTimer = setTimeout(() => {
      this.autoStartRetryTimer = null;
      void this.attemptConfiguredAutoStartWhenGameRunning(reason, {
        refreshGameRunning: true,
      }).catch((error) => {
        logWarn(
          MANAGED_RECORDER_LOG_SCOPE,
          "Automatic recorder startup retry failed",
          {
            error: safeErrorMessage(error),
          },
        );
      });
    }, AUTO_START_CAPTURE_RETRY_MS);
    this.autoStartRetryTimer.unref?.();
  }

  private clearAutoStartRetry(): void {
    if (!this.autoStartRetryTimer) {
      return;
    }

    clearTimeout(this.autoStartRetryTimer);
    this.autoStartRetryTimer = null;
  }

  private async runSaveReplay(
    seconds: number,
    kind: ManagedReplayKind,
  ): Promise<ManagedReplaySaveResult> {
    try {
      await this.initialize();
      if (!this.status.bufferActive) {
        throw new Error("Managed replay buffer is not active");
      }
      const sessionGame =
        this.status.activeGame ?? this.resolveConfiguredGame();

      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Saving replay from active buffer", {
        kind,
        seconds,
      });
      const path = await this.saveBufferedReplay(seconds, {
        kind,
        restartBufferAfterSave: true,
      });

      this.setStatus({
        bufferActive: true,
        recording: true,
        activeGame: sessionGame,
        lastRecordingPath: path,
        error: null,
      });

      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Replay save completed", {
        seconds,
        ...createSafePathLogFields(path, "recording"),
      });

      return { ok: true, path, error: null };
    } catch (error) {
      const message = safeErrorMessage(error);
      logError(MANAGED_RECORDER_LOG_SCOPE, "Replay save failed", {
        seconds,
        error: message,
      });
      this.setStatus({ error: message });

      return { ok: false, path: null, error: message };
    }
  }

  private async ensureActiveGameRunning(): Promise<boolean> {
    const gameRunning = await this.refreshGameRunningStatus({
      forceRefresh: true,
    });
    if (gameRunning) {
      return true;
    }

    this.setStatus({ error: this.resolveGameNotRunningError() });

    return false;
  }

  private async resolveActiveGameRunning(): Promise<ManagedRecorderGameRunningSnapshot> {
    const settings = SettingsStoreService.getInstance().get();
    const configuredGame = this.resolveConfiguredGame(settings);
    const state = await refreshPoeProcessState(configuredGame);

    return {
      gameRunning: isProcessStateForGame(state, configuredGame),
    };
  }

  private async applyGameRunningState(gameRunning: boolean): Promise<void> {
    if (!gameRunning) {
      this.clearAutoStartRetry();
    }

    if (this.status.gameRunning !== gameRunning) {
      this.setStatus({
        gameRunning,
        error: gameRunning
          ? this.clearGameNotRunningError()
          : this.status.error,
      });
      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Active game running state changed", {
        gameRunning,
      });
    }

    if (
      !gameRunning &&
      (this.status.bufferActive || this.status.runRecordingActive)
    ) {
      await this.stopActiveRecordingForMissingGame();
    }
  }

  private async stopActiveRecordingForMissingGame(): Promise<void> {
    if (this.offlineStopRequest) {
      return this.offlineStopRequest;
    }

    this.offlineStopRequest = this.stopActiveRecordingForMissingGameOnce()
      .catch((error) => {
        logError(
          MANAGED_RECORDER_LOG_SCOPE,
          "Game-offline recorder stop failed",
          {
            error: safeErrorMessage(error),
          },
        );
      })
      .finally(() => {
        this.offlineStopRequest = null;
      });

    return this.offlineStopRequest;
  }

  private async stopActiveRecordingForMissingGameOnce(): Promise<void> {
    logInfo(
      MANAGED_RECORDER_LOG_SCOPE,
      "Active game closed; stopping recorder",
      {
        bufferActive: this.status.bufferActive,
        replaySaveActive: this.activeReplaySaveRequest !== null,
        runRecordingActive: this.status.runRecordingActive,
      },
    );

    if (this.activeReplaySaveRequest) {
      await this.activeReplaySaveRequest;
    }

    if (this.status.bufferActive) {
      await this.stopBuffer();
    }

    if (this.status.runRecordingActive) {
      await this.stopRunRecording();
    }
  }

  private resolveGameNotRunningError(): string {
    const settings = SettingsStoreService.getInstance().get();
    const configuredGame = this.resolveConfiguredGame(settings);

    return `${this.resolveGameLabel(configuredGame)} is not running`;
  }

  private clearGameNotRunningError(): string | null {
    return this.status.error === this.resolveGameNotRunningError()
      ? null
      : this.status.error;
  }

  private resolveGameLabel(game: GameId): string {
    return game === "poe2" ? "Path of Exile 2" : "Path of Exile 1";
  }

  private async initialize(): Promise<void> {
    const runtimePath = await this.ensureNoobsRuntimeInitialized();
    const outputDirectory = this.resolveOutputDirectory();

    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Ensuring recorder output paths", {
      ...createSafePathLogFields(outputDirectory, "outputDirectory"),
    });
    this.ensureOutputDirectories(outputDirectory);
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Configuring capture source");
    this.configureCaptureSource();
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Capture source ready");
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Configuring audio sources");
    this.configureAudioSources();
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Audio sources ready");

    this.setStatus({
      available: true,
      initialized: true,
      runtimePath,
      outputDirectory,
      error: null,
    });
  }

  private async ensureNoobsRuntimeInitialized(
    options: EnsureNoobsRuntimeInitializedOptions = {},
  ): Promise<string> {
    const { publishStatus = true } = options;
    this.refreshStatusFromSettings();
    const runtimePath = this.resolveNoobsRuntimePath();
    if (!runtimePath) {
      throw new Error(
        "Packaged OBS runtime is missing. Add noobs/libOBS packaging before managed recording can run.",
      );
    }
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Resolved noobs runtime", {
      ...createSafePathLogFields(runtimePath, "runtime"),
      runtimeLocation: describeNoobsRuntimeLocation(runtimePath),
      initialized: this.noobsRuntimeInitialized,
    });
    logInfoSync(
      MANAGED_RECORDER_LOG_SCOPE,
      "Configuring noobs process environment",
    );
    this.configureNoobsProcessEnvironment(runtimePath);

    if (!this.noobs) {
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Loading noobs native module");
      this.noobs = await loadNoobsApi(importNoobsModule);
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Noobs native module loaded", {
        loaded: this.noobs !== null,
      });
    }

    if (!this.noobs) {
      throw new Error("noobs module is not installed");
    }

    if (!this.noobsRuntimeInitialized) {
      const logPath = join(app.getPath("userData"), "managed-recorder-logs");
      mkdirSync(logPath, { recursive: true });
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Initializing noobs runtime", {
        ...createSafePathLogFields(logPath, "noobsLogDirectory"),
      });
      this.initializeNoobsRuntime(runtimePath, logPath);
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.Init returned");
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "Calling noobs.SetBuffering during initialization",
      );
      this.noobs.SetBuffering(true);
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "Initial noobs.SetBuffering returned",
      );
      this.noobsRuntimeInitialized = true;
    }

    if (publishStatus) {
      this.setStatus({
        available: true,
        initialized: true,
        runtimePath,
        error: null,
      });
    }

    return runtimePath;
  }

  private prepareRecordingSession(
    mode: ManagedRecordingMode,
  ): RecordingSession {
    const startedAtDate = new Date();
    const directory = this.resolveOutputDirectoryForMode(mode);
    mkdirSync(directory, { recursive: true });
    const outputResolution = this.configureNoobsOutput(directory, mode);
    this.setStatus({
      outputResolution: formatRecordingResolution(outputResolution),
    });

    return {
      directory,
      existingRecordingPaths: collectRecordingFilePaths(directory),
      startedAt: startedAtDate.toISOString(),
    };
  }

  private configureNoobsOutput(
    outputDirectory: string,
    mode: ManagedRecordingMode,
  ): ManagedRecorderResolution {
    const settings = SettingsStoreService.getInstance().get();
    const outputResolution =
      mode === "buffer"
        ? REPLAY_CLIP_OUTPUT_RESOLUTION
        : this.resolveRecordingResolution(settings.recordingOutputResolution);
    const outputFps =
      mode === "buffer"
        ? Math.min(settings.recordingFps, REPLAY_CLIP_MAX_FPS)
        : settings.recordingFps;

    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.ResetVideoContext", {
      fps: outputFps,
      width: outputResolution.width,
      height: outputResolution.height,
    });
    this.noobs?.ResetVideoContext?.(
      outputFps,
      outputResolution.width,
      outputResolution.height,
    );
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.ResetVideoContext returned");
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Fitting capture source to canvas");
    this.fitCaptureSourceToCanvas(outputResolution);
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Capture source fit returned");
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.SetRecordingCfg", {
      ...createSafePathLogFields(outputDirectory, "outputDirectory"),
      container: MANAGED_RECORDING_CONTAINER,
    });
    this.noobs?.SetRecordingCfg?.(outputDirectory, MANAGED_RECORDING_CONTAINER);
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.SetRecordingCfg returned");
    const configuredVideoEncoder = settings.recordingEncoder;
    const encoderPolicy =
      mode === "buffer" ? "clip-preview-h264" : "user-configured";
    const requestedVideoEncoder =
      mode === "buffer"
        ? REPLAY_BUFFER_PLAYBACK_ENCODER
        : configuredVideoEncoder;
    const availableVideoEncoders = this.listAvailableVideoEncoders();
    const videoEncoder = resolveManagedVideoEncoder(
      requestedVideoEncoder,
      availableVideoEncoders,
    );
    const videoEncoderSettings = resolveManagedVideoEncoderSettings(
      videoEncoder,
      mode === "run"
        ? settings.recordingRunQuality
        : settings.recordingClipQuality,
    );
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.SetVideoEncoder", {
      requestedEncoder: requestedVideoEncoder,
      encoder: videoEncoder,
      encoderPolicy,
      rateControl: videoEncoderSettings.rate_control,
      crf: videoEncoderSettings.crf ?? null,
      cqp: videoEncoderSettings.cqp ?? null,
    });
    this.noobs?.SetVideoEncoder?.(videoEncoder, {
      ...videoEncoderSettings,
    });
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.SetVideoEncoder returned");
    this.setStatus({ encoder: videoEncoder, fps: outputFps });
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Configured video encoder", {
      configuredEncoder: configuredVideoEncoder,
      requestedEncoder: requestedVideoEncoder,
      encoder: videoEncoder,
      encoderPolicy,
      mode,
      quality:
        mode === "run"
          ? settings.recordingRunQuality
          : settings.recordingClipQuality,
      rateControl: videoEncoderSettings.rate_control,
      crf: videoEncoderSettings.crf ?? null,
      cqp: videoEncoderSettings.cqp ?? null,
      fps: outputFps,
      width: outputResolution.width,
      height: outputResolution.height,
    });

    return outputResolution;
  }

  private listAvailableVideoEncoders(): string[] {
    try {
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "Calling noobs.ListVideoEncoders",
      );
      const encoders = this.noobs?.ListVideoEncoders?.() ?? [];
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "noobs.ListVideoEncoders returned",
        {
          encoderCount: encoders.length,
        },
      );

      return encoders;
    } catch (error) {
      logWarn(MANAGED_RECORDER_LOG_SCOPE, "Failed to list video encoders", {
        error: safeErrorMessage(error),
      });

      return [];
    }
  }

  private listAudioDevicesForKind(
    kind: ManagedRecorderAudioDeviceKind,
  ): ManagedRecorderAudioDevices[ManagedRecorderAudioDeviceKind] {
    if (
      !this.noobs?.CreateSource ||
      !this.noobs.GetSourceProperties ||
      !this.noobs.DeleteSource
    ) {
      return [];
    }

    const sourceType = MANAGED_AUDIO_SOURCE_TYPES[kind];
    let sourceName: string | null = null;

    try {
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Creating audio device probe", {
        kind,
        sourceType,
      });
      sourceName = this.noobs.CreateSource(
        MANAGED_AUDIO_SOURCE_PROBE_NAMES[kind],
        sourceType,
      );
      const devices = selectAudioDevices(this.readSourceProperties(sourceName));
      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Listed audio devices", {
        kind,
        deviceCount: devices.length,
      });

      return devices;
    } catch (error) {
      logWarn(MANAGED_RECORDER_LOG_SCOPE, "Failed to list audio devices", {
        kind,
        error: safeErrorMessage(error),
      });

      return [];
    } finally {
      if (sourceName) {
        try {
          this.noobs?.DeleteSource?.(sourceName);
        } catch {
          // Best-effort cleanup. A failed probe deletion should not block settings.
        }
      }
    }
  }

  private initializeNoobsRuntime(runtimePath: string, logPath: string): void {
    if (!this.noobs) {
      throw new Error("noobs module is not installed");
    }

    const obsStatePath = join(app.getPath("userData"), "obs-runtime");
    mkdirSync(obsStatePath, { recursive: true });
    const previousCwd = process.cwd();

    try {
      process.chdir(obsStatePath);
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.Init", {
        ...createSafePathLogFields(obsStatePath, "obsStateDirectory"),
      });
      this.noobs.Init(runtimePath, logPath, (signal) => {
        this.handleSignal(signal);
      });
    } finally {
      process.chdir(previousCwd);
    }
  }

  private configureNoobsProcessEnvironment(runtimePath: string): void {
    const runtimeBinPath = join(runtimePath, "bin");
    const currentPath = process.env.Path ?? process.env.PATH ?? "";
    const currentPathEntries = currentPath
      .split(WINDOWS_PATH_DELIMITER)
      .map((entry) => entry.trim().toLowerCase());
    const hasRuntimeBinPath = currentPathEntries.includes(
      runtimeBinPath.toLowerCase(),
    );
    const nextPath = hasRuntimeBinPath
      ? currentPath
      : [runtimeBinPath, currentPath]
          .filter(Boolean)
          .join(WINDOWS_PATH_DELIMITER);

    process.env.Path = nextPath;
    process.env.PATH = nextPath;

    const muxPath = join(runtimeBinPath, "obs-ffmpeg-mux.exe");
    if (existsSync(muxPath)) {
      process.env.FFMPEG_MUX = muxPath;
    }
  }

  private configureCaptureSource(): void {
    if (
      !this.noobs?.CreateSource ||
      !this.noobs.GetSourceSettings ||
      !this.noobs.SetSourceSettings ||
      !this.noobs.AddSourceToScene
    ) {
      throw new Error("Packaged OBS runtime cannot configure capture sources");
    }

    const target = this.resolveCaptureTarget();
    const sourceType = resolveManagedCaptureSourceType(target);
    const sourceKey = `${sourceType}:${target.id}`;
    if (this.captureSourceName && this.captureSourceKey === sourceKey) {
      return;
    }

    this.removeCaptureSource();
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Configuring capture source", {
      targetKind: target.kind,
      sourceType,
    });

    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.CreateSource", {
      targetKind: target.kind,
      sourceType,
    });
    const sourceName = this.noobs.CreateSource("Hinekora Capture", sourceType);
    let sourceAddedToScene = false;
    try {
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.CreateSource returned");
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "Calling noobs.GetSourceSettings",
        {
          sourceType,
        },
      );
      const settings = this.noobs.GetSourceSettings(sourceName);
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "noobs.GetSourceSettings returned",
      );
      const configuredSettings =
        target.kind === "window"
          ? this.createWindowSourceSettings(sourceName, settings, target)
          : this.createDisplaySourceSettings(sourceName, settings, target);

      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "Calling noobs.SetSourceSettings",
        {
          targetKind: target.kind,
          sourceType,
        },
      );
      this.noobs.SetSourceSettings(sourceName, configuredSettings);
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "noobs.SetSourceSettings returned",
      );
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.AddSourceToScene");
      this.noobs.AddSourceToScene(sourceName);
      sourceAddedToScene = true;
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "noobs.AddSourceToScene returned",
      );
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "Reading capture source resolution",
      );
      const captureSourceResolution =
        this.readCaptureSourceResolution(sourceName);
      this.captureSourceName = sourceName;
      this.captureSourceKey = sourceKey;
      this.captureSourceResolution = captureSourceResolution;
      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Capture source configured", {
        targetKind: target.kind,
        sourceType,
        sourceWidth: this.captureSourceResolution?.width ?? null,
        sourceHeight: this.captureSourceResolution?.height ?? null,
      });
    } catch (error) {
      this.deleteCreatedSource(sourceName, {
        removeFromScene: sourceAddedToScene,
      });
      throw error;
    }
  }

  private removeCaptureSource(): void {
    if (!this.captureSourceName) {
      return;
    }

    this.deleteCreatedSource(this.captureSourceName, { removeFromScene: true });

    this.captureSourceName = null;
    this.captureSourceKey = null;
    this.captureSourceResolution = null;
  }

  private deleteCreatedSource(
    sourceName: string,
    options: { removeFromScene?: boolean } = {},
  ): void {
    if (options.removeFromScene) {
      try {
        this.noobs?.RemoveSourceFromScene?.(sourceName);
      } catch {
        // Best-effort cleanup. A failed removal should not block recorder startup.
      }
    }

    try {
      this.noobs?.DeleteSource?.(sourceName);
    } catch {
      // Best-effort cleanup. The next source name will remain unique if deletion fails.
    }
  }

  private configureAudioSources(): void {
    const settings = SettingsStoreService.getInstance().get();

    this.configureAudioSource("output", settings.recordingAudioOutputDeviceId);
    this.configureAudioSource("input", settings.recordingAudioInputDeviceId);
  }

  private configureAudioSource(
    kind: ManagedRecorderAudioDeviceKind,
    deviceId: string | null,
  ): void {
    if (!deviceId) {
      this.removeAudioSource(kind);
      return;
    }

    if (
      !this.noobs?.CreateSource ||
      !this.noobs.GetSourceSettings ||
      !this.noobs.SetSourceSettings ||
      !this.noobs.AddSourceToScene
    ) {
      throw new Error("Packaged OBS runtime cannot configure audio sources");
    }

    const sourceType = MANAGED_AUDIO_SOURCE_TYPES[kind];
    const sourceKey = `${sourceType}:${deviceId}`;
    if (
      this.audioSourceNames[kind] &&
      this.audioSourceKeys[kind] === sourceKey
    ) {
      return;
    }

    this.removeAudioSource(kind);
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Configuring audio source", {
      kind,
      sourceType,
      defaultDevice: deviceId === "default",
    });

    const sourceName = this.noobs.CreateSource(
      MANAGED_AUDIO_SOURCE_NAMES[kind],
      sourceType,
    );
    const sourceSettings = this.noobs.GetSourceSettings(sourceName);
    this.noobs.SetSourceSettings(sourceName, {
      ...sourceSettings,
      device_id: deviceId,
    });
    this.noobs.SetSourceVolume?.(sourceName, 1);
    this.noobs.AddSourceToScene(sourceName);
    this.audioSourceNames[kind] = sourceName;
    this.audioSourceKeys[kind] = sourceKey;
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Audio source configured", {
      kind,
      sourceType,
      sourceName,
      defaultDevice: deviceId === "default",
    });
  }

  private removeAudioSources(): void {
    this.removeAudioSource("input");
    this.removeAudioSource("output");
  }

  private removeAudioSource(kind: ManagedRecorderAudioDeviceKind): void {
    const sourceName = this.audioSourceNames[kind];
    if (!sourceName) {
      return;
    }

    try {
      this.noobs?.RemoveSourceFromScene?.(sourceName);
    } catch {
      // Best-effort cleanup. A failed removal should not block recorder startup.
    }

    try {
      this.noobs?.DeleteSource?.(sourceName);
    } catch {
      // Best-effort cleanup. The next source name will remain unique if deletion fails.
    }

    this.audioSourceNames[kind] = null;
    this.audioSourceKeys[kind] = null;
  }

  private resolveCaptureTarget(): CaptureTarget {
    const settings = SettingsStoreService.getInstance().get();
    const profile = this.resolveConfiguredCaptureProfile(settings);
    if (
      profile?.captureTarget &&
      this.isCaptureTargetCompatibleWithGame(
        profile.captureTarget,
        profile.game,
      )
    ) {
      return profile.captureTarget;
    }

    return {
      kind: "display",
      id: "primary",
      label: "Primary display",
    };
  }

  private resolveConfiguredGame(
    settings = SettingsStoreService.getInstance().get(),
  ): GameId {
    return (
      this.resolveConfiguredCaptureProfile(settings)?.game ??
      settings.activeGame
    );
  }

  private resolveConfiguredCaptureProfile(
    settings = SettingsStoreService.getInstance().get(),
  ): ReturnType<CaptureProfilesService["list"]>[number] | null {
    const profiles = CaptureProfilesService.getInstance().list();

    return (
      (settings.selectedCaptureProfileId
        ? profiles.find(
            (profile) => profile.id === settings.selectedCaptureProfileId,
          )
        : null) ??
      profiles.find((profile) => profile.game === settings.activeGame) ??
      null
    );
  }

  private isCaptureTargetCompatibleWithGame(
    target: CaptureTarget,
    activeGame: GameId,
  ): boolean {
    return (
      target.kind !== "window" || !target.game || target.game === activeGame
    );
  }

  private createDisplaySourceSettings(
    sourceName: string,
    settings: Record<string, unknown>,
    target: CaptureTarget,
  ): Record<string, unknown> {
    const properties = this.readSourceProperties(sourceName);
    const monitor = selectDisplayMonitor(properties, target);
    const method = selectWgcCaptureMethod(properties);

    return {
      ...settings,
      method: method ?? settings.method ?? 0,
      capture_cursor: true,
      force_sdr: false,
      monitor_id: monitor?.value ?? target.id,
    };
  }

  private createWindowSourceSettings(
    sourceName: string,
    settings: Record<string, unknown>,
    target: CaptureTarget,
  ): Record<string, unknown> {
    const properties = this.readSourceProperties(sourceName);
    const window = selectWindow(properties, target);
    const method = selectWgcCaptureMethod(properties);
    if (!window) {
      throw new Error(CAPTURE_WINDOW_UNAVAILABLE_ERROR);
    }

    return {
      ...settings,
      method: method ?? settings.method ?? 0,
      priority: 0,
      cursor: true,
      client_area: true,
      compatibility: false,
      force_sdr: false,
      window: window.value,
    };
  }

  private readSourceProperties(sourceName: string): NoobsProperty[] {
    try {
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "Calling noobs.GetSourceProperties",
      );
      const properties = this.noobs?.GetSourceProperties?.(sourceName) ?? [];
      logInfoSync(
        MANAGED_RECORDER_LOG_SCOPE,
        "noobs.GetSourceProperties returned",
        {
          propertyCount: properties.length,
        },
      );

      return properties;
    } catch {
      return [];
    }
  }

  private readCaptureSourceResolution(
    sourceName: string,
  ): ManagedRecorderResolution | null {
    try {
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.GetSourcePos");
      const position = this.noobs?.GetSourcePos?.(sourceName);
      logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.GetSourcePos returned", {
        hasPosition: position !== undefined && position !== null,
      });
      if (
        position &&
        Number.isFinite(position.width) &&
        Number.isFinite(position.height) &&
        position.width > 0 &&
        position.height > 0
      ) {
        return {
          width: Math.round(position.width),
          height: Math.round(position.height),
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private fitCaptureSourceToCanvas(canvas: ManagedRecorderResolution): void {
    if (!this.noobs?.SetSourcePos || !this.captureSourceName) {
      return;
    }

    const target = this.resolveCaptureTarget();
    const source =
      this.readCaptureSourceResolution(this.captureSourceName) ??
      this.captureSourceResolution ??
      resolveNativeDisplayResolution(target, {
        getDisplays: () => screen.getAllDisplays(),
        getPrimaryDisplay: () => screen.getPrimaryDisplay(),
      }) ??
      canvas;

    this.captureSourceResolution = source;
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.SetSourcePos", {
      sourceWidth: source.width,
      sourceHeight: source.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
    this.noobs.SetSourcePos(
      this.captureSourceName,
      createFittedSceneItemPosition(source, canvas),
    );
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.SetSourcePos returned");
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Fitted capture source to canvas", {
      targetKind: target.kind,
      sourceWidth: source.width,
      sourceHeight: source.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
  }

  private waitForRecordingStop(): Promise<void> {
    return new Promise((resolveWait) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        resolved = true;
        this.recordingStopWaiter = null;
        resolveWait();
      }, RECORDING_STOP_WAIT_MS);

      this.recordingStopWaiter = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        clearTimeout(timeout);
        this.recordingStopWaiter = null;
        resolveWait();
      };
    });
  }

  private async saveBufferedReplay(
    seconds: number,
    options: BufferedReplaySaveOptions,
  ): Promise<string> {
    if (!this.noobs || !this.status.activeSessionDirectory) {
      throw new Error("Managed recorder session is not active");
    }

    const sessionDirectory = this.status.activeSessionDirectory;
    const replayDirectory = this.resolveOutputDirectoryForReplayKind(
      options.kind,
    );
    const recordingStartedAt = this.status.recordingStartedAt;
    const activeGame = this.status.activeGame ?? this.resolveConfiguredGame();
    const requestedSeconds = Math.max(
      1,
      Math.min(maxRewindSaveSeconds, Math.round(seconds)),
    );
    const waitMs = this.resolveReplaySaveWaitMs(requestedSeconds);
    const saveStartedAtMs = Date.now();
    const existingRecordingPaths = collectRecordingFilePaths(sessionDirectory);
    logInfo(
      MANAGED_RECORDER_LOG_SCOPE,
      "Requesting buffered replay conversion",
      {
        kind: options.kind,
        requestedSeconds,
        waitMs,
        restartBufferAfterSave: options.restartBufferAfterSave,
        ...createSafePathLogFields(sessionDirectory, "session"),
      },
    );
    this.noobs.StartRecording(requestedSeconds);

    const detectedPath = await this.waitForRecordingFileDetection(
      sessionDirectory,
      saveStartedAtMs - 1_000,
      RECORDING_DETECTION_WAIT_MS,
      existingRecordingPaths,
    );

    if (!detectedPath) {
      logError(
        MANAGED_RECORDER_LOG_SCOPE,
        "Buffered replay conversion timed out",
        {
          requestedSeconds,
          waitMs: RECORDING_DETECTION_WAIT_MS,
        },
      );
      throw new Error("Managed recorder did not write a recording file");
    }

    await this.waitForReplayConversionStopDelay();
    await this.stopReplayConversionRecording(detectedPath);

    const isStable = await this.waitForStableRecordingFile(
      detectedPath,
      Date.now() + waitMs,
    );
    if (!isStable) {
      logError(
        MANAGED_RECORDER_LOG_SCOPE,
        "Buffered replay file did not finalize",
        {
          requestedSeconds,
          waitMs,
          ...createSafePathLogFields(detectedPath, "recording"),
        },
      );
      throw new Error("Managed recorder did not finalize the recording file");
    }

    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Recording file finalized", {
      ...createSafePathLogFields(detectedPath, "recording"),
    });

    const savedPath =
      options.kind === "manual"
        ? this.moveBufferedReplayToDirectory(detectedPath, replayDirectory)
        : detectedPath;

    if (options.restartBufferAfterSave) {
      this.restartReplayBufferAfterSave(
        sessionDirectory,
        recordingStartedAt,
        activeGame,
      );
    }

    return savedPath;
  }

  private moveBufferedReplayToDirectory(
    path: string,
    directory: string,
  ): string {
    const sourceDirectory = resolve(dirname(path));
    const targetDirectory = resolve(directory);
    /* v8 ignore next -- Current save paths only move when source and target differ. */
    if (sourceDirectory === targetDirectory) {
      return path;
    }

    mkdirSync(targetDirectory, { recursive: true });
    const targetPath = join(targetDirectory, basename(path));
    renameSync(path, targetPath);
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Buffered replay moved", {
      ...createSafePathLogFields(targetPath, "recording"),
    });

    return targetPath;
  }

  private async waitForRecordingFileDetection(
    outputDirectory: string,
    modifiedAfterMs: number,
    waitMs: number,
    ignoredPaths = new Set<string>(),
  ): Promise<string | null> {
    const deadline = Date.now() + waitMs;

    while (Date.now() < deadline) {
      const path = this.resolveSavedRecordingPath(
        outputDirectory,
        modifiedAfterMs,
        ignoredPaths,
      );
      if (path) {
        logInfo(
          MANAGED_RECORDER_LOG_SCOPE,
          "Recording file detected; stopping replay conversion",
          createSafePathLogFields(path, "recording"),
        );
        return path;
      }

      await this.waitForRecordingFilePoll();
    }

    logWarn(
      MANAGED_RECORDER_LOG_SCOPE,
      "Recording file was not detected before save deadline",
      {
        waitMs,
        ...createSafePathLogFields(outputDirectory, "session"),
      },
    );

    return null;
  }

  private async stopReplayConversionRecording(path: string): Promise<void> {
    if (!this.noobs) {
      return;
    }

    logInfo(
      MANAGED_RECORDER_LOG_SCOPE,
      "Stopping replay conversion recording",
      {
        ...createSafePathLogFields(path, "recording"),
      },
    );
    const stopped = this.waitForRecordingStop();
    this.noobs.StopRecording();
    await stopped;
  }

  private restartReplayBufferAfterSave(
    sessionDirectory: string,
    recordingStartedAt: string | null,
    activeGame: GameId | null,
  ): void {
    if (!this.noobs) {
      return;
    }

    this.noobs.SetRecordingCfg?.(sessionDirectory, MANAGED_RECORDING_CONTAINER);
    this.noobs.StartBuffer();
    this.setStatus({
      bufferActive: true,
      recording: true,
      runRecordingActive: false,
      activeGame,
      activeSessionDirectory: sessionDirectory,
      recordingStartedAt,
      error: null,
    });
    logInfo(
      MANAGED_RECORDER_LOG_SCOPE,
      "Replay buffer resumed after clip save",
      {
        ...createSafePathLogFields(sessionDirectory, "session"),
      },
    );
  }

  private waitForReplayConversionStopDelay(): Promise<void> {
    return new Promise((resolveDelay) => {
      setTimeout(resolveDelay, REPLAY_CONVERSION_STOP_DELAY_MS);
    });
  }

  private async waitForSavedRecording(
    outputDirectory: string,
    modifiedAfterMs: number,
    waitMs = RECORDING_SAVE_WAIT_MS,
    ignoredPaths = new Set<string>(),
  ): Promise<string | null> {
    const deadline = Date.now() + waitMs;

    while (Date.now() < deadline) {
      const path = this.resolveSavedRecordingPath(
        outputDirectory,
        modifiedAfterMs,
        ignoredPaths,
      );
      if (path) {
        logInfo(
          MANAGED_RECORDER_LOG_SCOPE,
          "Recording file detected; waiting for finalize",
          createSafePathLogFields(path, "recording"),
        );

        const isStable = await this.waitForStableRecordingFile(path, deadline);
        if (isStable) {
          logInfo(MANAGED_RECORDER_LOG_SCOPE, "Recording file finalized", {
            ...createSafePathLogFields(path, "recording"),
          });
          return path;
        }

        logWarn(
          MANAGED_RECORDER_LOG_SCOPE,
          "Recording file did not finalize before save deadline",
          {
            waitMs,
            ...createSafePathLogFields(path, "recording"),
          },
        );
        return null;
      }

      await this.waitForRecordingFilePoll();
    }

    logWarn(
      MANAGED_RECORDER_LOG_SCOPE,
      "Recording file was not detected before save deadline",
      {
        waitMs,
        ...createSafePathLogFields(outputDirectory, "session"),
      },
    );
    return null;
  }

  private resolveSavedRecordingPath(
    outputDirectory: string,
    modifiedAfterMs: number,
    ignoredPaths = new Set<string>(),
  ): string | null {
    let lastRecording: string | null = null;
    try {
      lastRecording = this.noobs?.GetLastRecording() ?? null;
    } catch {
      lastRecording = null;
    }

    const lastRecordingSnapshot = lastRecording
      ? this.readRecordingFileSnapshot(lastRecording)
      : null;
    if (
      lastRecording &&
      lastRecordingSnapshot &&
      lastRecordingSnapshot.mtimeMs >= modifiedAfterMs &&
      !ignoredPaths.has(resolve(lastRecording))
    ) {
      return resolve(lastRecording);
    }

    return findNewestRecordingFile(
      outputDirectory,
      modifiedAfterMs,
      ignoredPaths,
    );
  }

  private async waitForStableRecordingFile(
    path: string,
    deadlineMs: number,
  ): Promise<boolean> {
    let previousSnapshot: RecordingFileSnapshot | null = null;
    let stableSinceMs: number | null = null;

    while (Date.now() < deadlineMs) {
      const currentSnapshot = this.readRecordingFileSnapshot(path);
      if (!currentSnapshot) {
        previousSnapshot = null;
        stableSinceMs = null;
        await this.waitForRecordingFilePoll();
        continue;
      }

      if (
        previousSnapshot &&
        currentSnapshot.size === previousSnapshot.size &&
        currentSnapshot.mtimeMs === previousSnapshot.mtimeMs
      ) {
        stableSinceMs ??= Date.now();
        if (Date.now() - stableSinceMs >= RECORDING_FILE_STABLE_MS) {
          return true;
        }
      } else {
        stableSinceMs = null;
      }

      previousSnapshot = currentSnapshot;
      await this.waitForRecordingFilePoll();
    }

    return false;
  }

  private readRecordingFileSnapshot(
    path: string,
  ): RecordingFileSnapshot | null {
    if (!existsSync(path)) {
      return null;
    }

    try {
      const stats = statSync(path);
      if (stats.size <= 0) {
        return null;
      }

      return {
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      };
    } catch {
      return null;
    }
  }

  private waitForRecordingFilePoll(): Promise<void> {
    return new Promise((resolvePoll) => {
      setTimeout(resolvePoll, RECORDING_FILE_POLL_MS);
    });
  }

  private getActiveRecordingDurationSeconds(): number {
    if (!this.status.recordingStartedAt) {
      return rewindBufferSeconds;
    }

    const startedAtMs = new Date(this.status.recordingStartedAt).getTime();
    if (!Number.isFinite(startedAtMs)) {
      return rewindBufferSeconds;
    }

    return Math.ceil((Date.now() - startedAtMs) / 1_000);
  }

  private resolveReplaySaveWaitMs(requestedSeconds: number): number {
    const settings = SettingsStoreService.getInstance().get();

    return calculateReplaySaveWaitMs({
      requestedSeconds,
      outputResolution: parseRecordingResolution(this.status.outputResolution),
      fps: settings.recordingFps,
    });
  }

  private resolveRecordingResolution(value: string): ManagedRecorderResolution {
    const target = this.resolveCaptureTarget();
    const explicitResolution = parseRecordingResolution(value);
    const nativeResolution = resolveNativeDisplayResolution(target, {
      getDisplays: () => screen.getAllDisplays(),
      getPrimaryDisplay: () => screen.getPrimaryDisplay(),
    });
    const sourceResolution = this.captureSourceResolution;
    const resolutionSource = explicitResolution
      ? "explicit"
      : nativeResolution
        ? "native"
        : sourceResolution
          ? "source"
          : "fallback";
    const resolution = resolveManagedRecordingResolution(
      value,
      nativeResolution,
      sourceResolution,
      FALLBACK_RECORDING_RESOLUTION,
    );

    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Resolved recording resolution", {
      requested: value,
      source: resolutionSource,
      targetKind: target.kind,
      targetId: target.id,
      width: resolution.width,
      height: resolution.height,
    });

    return resolution;
  }

  private refreshStatusFromSettings(): void {
    const settings = SettingsStoreService.getInstance().get();
    this.status = {
      ...this.status,
      outputDirectory: this.resolveOutputDirectory(),
      outputResolution:
        settings.recordingOutputResolution === NATIVE_RECORDING_RESOLUTION
          ? "Native source"
          : settings.recordingOutputResolution,
      fps: settings.recordingFps,
      encoder: settings.recordingEncoder,
    };
    this.refreshRuntimeAvailability();
  }

  private setupAutoStartSettingsListener(): void {
    const settingsStore = SettingsStoreService.getInstance();
    this.previousAutoStartConfigurationKey =
      this.createAutoStartConfigurationKey();

    if (typeof settingsStore.onDidChange !== "function") {
      return;
    }

    settingsStore.onDidChange((settings) => {
      this.refreshStatusFromSettings();
      if (settings.recordingAutoStartMode === "off") {
        this.previousAutoStartConfigurationKey =
          this.createAutoStartConfigurationKey();
        this.autoStartRequestNeedsRecheck = this.autoStartRequest !== null;
        this.clearAutoStartRetry();
        return;
      }

      this.handleAutoStartConfigurationChange("settings-changed");
    });
  }

  private setupAutoStartCaptureProfilesListener(): void {
    const profilesService = CaptureProfilesService.getInstance();
    if (typeof profilesService.onDidChange !== "function") {
      return;
    }

    profilesService.onDidChange(() => {
      this.handleAutoStartConfigurationChange("settings-changed");
    });
  }

  private handleAutoStartConfigurationChange(
    reason: "game-running" | "settings-changed" | "startup",
  ): void {
    const nextConfigurationKey = this.createAutoStartConfigurationKey();
    if (this.previousAutoStartConfigurationKey === nextConfigurationKey) {
      return;
    }

    this.previousAutoStartConfigurationKey = nextConfigurationKey;
    if (
      SettingsStoreService.getInstance().get().recordingAutoStartMode === "off"
    ) {
      this.autoStartRequestNeedsRecheck = this.autoStartRequest !== null;
      this.clearAutoStartRetry();
      return;
    }

    this.clearAutoStartRetry();
    void this.attemptConfiguredAutoStartWhenGameRunning(reason, {
      refreshGameRunning: true,
    }).catch((error) => {
      logWarn(MANAGED_RECORDER_LOG_SCOPE, "Automatic recorder startup failed", {
        error: safeErrorMessage(error),
      });
    });
  }

  private createAutoStartConfigurationKey(): string {
    const settings = SettingsStoreService.getInstance().get();
    if (settings.recordingAutoStartMode === "off") {
      return JSON.stringify({
        mode: settings.recordingAutoStartMode,
      });
    }

    return JSON.stringify({
      activeGame: this.resolveConfiguredGame(settings),
      captureTarget: this.resolveCaptureTarget(),
      mode: settings.recordingAutoStartMode,
      selectedCaptureProfileId: settings.selectedCaptureProfileId,
    });
  }

  private refreshRuntimeAvailability(): void {
    const runtimePath = this.resolveNoobsRuntimePath();
    this.status = {
      ...this.status,
      available: runtimePath !== null,
      runtimePath,
      error:
        runtimePath === null
          ? "Packaged OBS runtime is not installed yet"
          : this.status.error,
    };
  }

  private resolveOutputDirectory(): string {
    const settings = SettingsStoreService.getInstance().get();

    return (
      settings.recordingStoragePath ??
      join(app.getPath("videos"), DEFAULT_RECORDING_DIRECTORY_NAME)
    );
  }

  private resolveOutputDirectoryForMode(mode: ManagedRecordingMode): string {
    return resolveRecordingStorageMediaDirectory(
      this.resolveOutputDirectory(),
      mode === "run" ? "fullRecordings" : "deathClips",
    );
  }

  private resolveOutputDirectoryForReplayKind(kind: ManagedReplayKind): string {
    return resolveRecordingStorageMediaDirectory(
      this.resolveOutputDirectory(),
      kind === "manual" ? "manualReplays" : "deathClips",
    );
  }

  private ensureOutputDirectories(root: string): void {
    mkdirSync(root, { recursive: true });
    RecordingStorageService.getInstance().migrateLegacyMediaDirectories(root);
    for (const directoryName of Object.values(
      RECORDING_STORAGE_DIRECTORY_NAMES,
    )) {
      mkdirSync(join(root, directoryName), { recursive: true });
    }
  }

  private resolveNoobsRuntimePath(): string | null {
    const configured = process.env.HINEKORA_NOOBS_PATH?.trim();
    const resourcesPath =
      typeof process.resourcesPath === "string" ? process.resourcesPath : null;

    const packagedCandidates = [
      resourcesPath
        ? resolve(
            resourcesPath,
            "app.asar.unpacked",
            "node_modules",
            "noobs",
            "dist",
          )
        : null,
      resourcesPath
        ? resolve(resourcesPath, "node_modules", "noobs", "dist")
        : null,
    ];
    const developmentCandidates = [
      configured && !app.isPackaged ? resolve(configured) : null,
      resolve(currentDir, "../../node_modules/noobs/dist"),
      resolve(
        process.cwd(),
        "apps",
        "desktop",
        "node_modules",
        "noobs",
        "dist",
      ),
      resolve(process.cwd(), "node_modules", "noobs", "dist"),
      ...packagedCandidates,
    ].filter((candidate): candidate is string => candidate !== null);
    const candidates = app.isPackaged
      ? packagedCandidates.filter(
          (candidate): candidate is string => candidate !== null,
        )
      : developmentCandidates;

    return (
      candidates.find(
        (candidate) => existsSync(candidate) && !isAsarVirtualPath(candidate),
      ) ?? null
    );
  }

  private handleSignal(signal: NoobsSignal): void {
    this.logOutputSignal(signal);

    if (signal.id === "start") {
      if (this.activeRecordingMode === "run") {
        this.updateCaptureMode("session");
        this.setStatus({
          bufferActive: false,
          recording: true,
          runRecordingActive: true,
          error: null,
        });
        return;
      }

      this.updateCaptureMode("rewind");
      this.setStatus({
        bufferActive: true,
        recording: true,
        runRecordingActive: false,
        error: null,
      });
      return;
    }

    if (signal.id === "deactivate") {
      this.recordingStopWaiter?.();
      this.setStatus({
        bufferActive: false,
        recording: false,
        runRecordingActive: false,
        activeGame: null,
        error: null,
      });
    }
  }

  private logOutputSignal(signal: NoobsSignal): void {
    if (signal.type !== "output" || !signal.id) {
      return;
    }

    const fields = {
      id: signal.id,
      code: signal.code ?? null,
      error: signal.error ?? null,
    };

    if (
      signal.error ||
      (typeof signal.code === "number" && signal.code !== 0)
    ) {
      logWarn(MANAGED_RECORDER_LOG_SCOPE, "Recorder output signal", fields);
      return;
    }

    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Recorder output signal", fields);
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      ManagedRecorderChannel.GetCaptureMode,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.getCaptureMode(),
    );
    registerGuardedIpcHandler(
      ManagedRecorderChannel.GetStatus,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.getStatus(),
    );
    registerGuardedIpcHandler(
      ManagedRecorderChannel.ListAudioDevices,
      [WindowName.Main],
      (_event, forceRefresh) => {
        try {
          assertOptionalBoolean(
            forceRefresh,
            "forceRefresh",
            ManagedRecorderChannel.ListAudioDevices,
          );

          return this.listAudioDevices(
            forceRefresh === true ? { forceRefresh: true } : {},
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ManagedRecorderChannel.SetCaptureMode,
      [WindowName.Main, WindowName.RecorderOverlay],
      (_event, mode) => {
        try {
          return this.setCaptureMode(parseCaptureMode(mode));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ManagedRecorderChannel.StartBuffer,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.startBuffer(),
    );
    registerGuardedIpcHandler(
      ManagedRecorderChannel.StopBuffer,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.stopBuffer(),
    );
    registerGuardedIpcHandler(
      ManagedRecorderChannel.StartRunRecording,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.startRunRecording(),
    );
    registerGuardedIpcHandler(
      ManagedRecorderChannel.StopRunRecording,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.stopRunRecording(),
    );
    registerGuardedIpcHandler(
      ManagedRecorderChannel.SaveReplay,
      [WindowName.Main],
      () => {
        const settings = SettingsStoreService.getInstance().get();
        return this.saveReplay(settings.deathClipSeconds, "manual");
      },
    );
  }

  private setStatus(update: Partial<ManagedRecorderStatus>): void {
    this.status = { ...this.status, ...update };
    this.publishStatus();
  }

  private beginRecordingStart(mode: ManagedRecordingMode): boolean {
    if (
      this.startingRecordingMode !== null ||
      this.status.isStartingRecording ||
      this.status.isStoppingRecording
    ) {
      this.setStatus({
        error: this.resolveRecordingStartBlockedMessage(mode),
      });
      return false;
    }

    this.startingRecordingMode = mode;
    this.setStatus({
      isStartingRecording: true,
      activeGame: this.resolveConfiguredGame(),
      error: null,
    });
    return true;
  }

  private finishRecordingStart(mode: ManagedRecordingMode): void {
    if (this.startingRecordingMode === mode) {
      this.startingRecordingMode = null;
    }
  }

  private resolveRecordingStartBlockedMessage(
    mode: ManagedRecordingMode,
  ): string {
    if (this.status.isStoppingRecording) {
      return "Wait for the current recording to stop before starting another recording";
    }

    if (this.startingRecordingMode === "buffer" && mode === "run") {
      return "Replay buffer is already starting";
    }

    if (this.startingRecordingMode === "run" && mode === "buffer") {
      return "Full run recording is already starting";
    }

    return "Recording is already starting";
  }

  private updateCaptureMode(mode: ManagedRecorderCaptureMode): void {
    if (this.captureMode === mode) {
      return;
    }

    this.captureMode = mode;
    this.publishCaptureMode();
  }

  private cleanupRecordingStorage(protectedPaths: Array<string | null>): void {
    try {
      RecordingStorageService.getInstance().cleanup({
        protectedPaths: protectedPaths.filter(
          (path): path is string => typeof path === "string" && path.length > 0,
        ),
        protectedDirectories: this.status.activeSessionDirectory
          ? [this.status.activeSessionDirectory]
          : [],
      });
    } catch (error) {
      logWarn(MANAGED_RECORDER_LOG_SCOPE, "Recording storage cleanup failed", {
        error: safeErrorMessage(error),
      });
    }
  }

  private publishStatus(): void {
    publishManagedRecorderStatus(this.status);
    this.notifyChangeListeners();
  }

  private publishCaptureMode(): void {
    publishManagedRecorderCaptureMode(this.captureMode);
    this.notifyChangeListeners();
  }

  private notifyChangeListeners(): void {
    const snapshot: ManagedRecorderChangeSnapshot = {
      captureMode: this.captureMode,
      status: { ...this.status },
    };

    for (const listener of this.changeListeners) {
      try {
        listener(snapshot);
      } catch (error) {
        // Main-process observers must not break recorder status publication.
        logWarn(MANAGED_RECORDER_LOG_SCOPE, "Recorder change listener failed", {
          error: safeErrorMessage(error),
        });
      }
    }
  }
}

export type { ManagedRecorderChangeSnapshot };
export { describeNoobsRuntimeLocation, ManagedRecorderService };

function describeNoobsRuntimeLocation(path: string): string {
  const normalized = normalize(path).replaceAll("\\", "/");

  if (normalized.includes("/app.asar.unpacked/")) {
    return "asar-unpacked";
  }

  if (normalized.includes("/app.asar/")) {
    return "asar-virtual";
  }

  if (normalized.includes("/node_modules/noobs/dist")) {
    return "node-modules";
  }

  return "custom";
}

function parseCaptureMode(value: unknown): ManagedRecorderCaptureMode {
  if (value === "session" || value === "rewind") {
    return value;
  }

  throw new Error("captureMode must be session or rewind");
}
