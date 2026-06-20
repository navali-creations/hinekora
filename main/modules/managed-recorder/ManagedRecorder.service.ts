import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { basename, dirname, join, normalize, resolve } from "node:path";

import { app, BrowserWindow, screen } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ProfilesService } from "~/main/modules/profiles";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import {
  DEFAULT_RECORDING_DIRECTORY_NAME,
  RECORDING_STORAGE_DIRECTORY_NAMES,
} from "~/main/modules/recording-storage/RecordingStorage.constants";
import { resolveRecordingStorageMediaDirectory } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  detectPoeProcessState,
  isPoeProcessStateForGame,
} from "~/main/pollers";
import {
  createSafePathLogFields,
  logError,
  logInfo,
  logInfoSync,
  logWarn,
} from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import type { CaptureTarget, GameId, ManagedRecorderStatus } from "~/types";
import { ManagedRecorderChannel } from "./ManagedRecorder.channels";
import { resolveNativeDisplayResolution } from "./ManagedRecorder.display";
import type {
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
  selectDisplayMonitor,
  selectWgcCaptureMethod,
  selectWindow,
} from "./ManagedRecorder.utils";

const currentDir = __dirname;

const MANAGED_RUNTIME = "packaged_obs";
const MANAGED_RECORDING_CONTAINER = "mp4";
const MANAGED_DEFAULT_ENCODER = "hardware_h264";
const RECORDING_STOP_WAIT_MS = 5_000;
const RECORDING_SAVE_WAIT_MS = 30_000;
const RECORDING_DETECTION_WAIT_MS = 15_000;
const RECORDING_FILE_POLL_MS = 1_000;
const RECORDING_FILE_STABLE_MS = 1_000;
const REPLAY_CONVERSION_STOP_DELAY_MS = 250;
const MANAGED_REPLAY_BUFFER_LIMIT_SECONDS = 60;
const NATIVE_RECORDING_RESOLUTION = "native";
const WINDOWS_PATH_DELIMITER = ";";
const FALLBACK_RECORDING_RESOLUTION: ManagedRecorderResolution = {
  width: 1920,
  height: 1080,
};
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

interface RecordingSession {
  directory: string;
  existingRecordingPaths: Set<string>;
  startedAt: string;
}

class ManagedRecorderService {
  private static instance: ManagedRecorderService | null = null;

  private noobs: NoobsApi | null = null;
  private status: ManagedRecorderStatus = {
    available: false,
    gameRunning: false,
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
    encoder: MANAGED_DEFAULT_ENCODER,
    lastRecordingPath: null,
    runRecordingPath: null,
    activeSessionDirectory: null,
    recordingStartedAt: null,
    runRecordingStartedAt: null,
    error: "Packaged OBS runtime is not installed yet",
  };
  private activeRecordingMode: ManagedRecordingMode | null = null;
  private captureSourceName: string | null = null;
  private captureSourceKey: string | null = null;
  private captureSourceResolution: ManagedRecorderResolution | null = null;
  private activeRecordingBaselinePaths = new Set<string>();
  private recordingStopWaiter: (() => void) | null = null;
  private activeReplaySaveRequest: Promise<ManagedReplaySaveResult> | null =
    null;
  private gameRunningRefreshRequest: Promise<boolean> | null = null;
  private offlineStopRequest: Promise<void> | null = null;

  static getInstance(): ManagedRecorderService {
    if (!ManagedRecorderService.instance) {
      ManagedRecorderService.instance = new ManagedRecorderService();
    }

    return ManagedRecorderService.instance;
  }

  constructor() {
    this.refreshStatusFromSettings();
    this.setupHandlers();
  }

  getStatus(): ManagedRecorderStatus {
    this.refreshRuntimeAvailability();

    return this.status;
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

    if (!(await this.ensureActiveGameRunning())) {
      return this.status;
    }

    this.setStatus({ isStartingRecording: true, error: null });
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Replay buffer start requested", {
      outputDirectorySet: this.status.outputDirectory !== null,
      initialized: this.status.initialized,
    });

    try {
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
      this.setStatus({
        bufferActive: true,
        recording: true,
        isStartingRecording: false,
        activeSessionDirectory: session.directory,
        recordingStartedAt: session.startedAt,
        error: null,
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
        activeSessionDirectory: null,
        recordingStartedAt: null,
        error: safeErrorMessage(error),
      });
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
      }

      this.activeRecordingMode = null;
      this.activeRecordingBaselinePaths = new Set();
      this.setStatus({
        bufferActive: false,
        recording: false,
        isStoppingRecording: false,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        error: null,
      });
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

    if (!(await this.ensureActiveGameRunning())) {
      return this.status;
    }

    this.setStatus({ isStartingRecording: true, error: null });
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Starting full run recording");

    try {
      await this.initialize();
      if (!this.noobs) {
        throw new Error("noobs module is not installed");
      }

      this.noobs.SetBuffering(false);
      this.activeRecordingMode = "run";
      const session = this.prepareRecordingSession(this.activeRecordingMode);
      this.activeRecordingBaselinePaths = session.existingRecordingPaths;
      this.noobs.StartRecording(0);
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
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: safeErrorMessage(error),
      });
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
      }

      this.activeRecordingMode = null;
      this.activeRecordingBaselinePaths = new Set();
      this.setStatus({
        bufferActive: false,
        recording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runRecordingPath: savedPath ?? this.status.runRecordingPath,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        lastRecordingPath: savedPath ?? this.status.lastRecordingPath,
        error: null,
      });
      logInfo(MANAGED_RECORDER_LOG_SCOPE, "Full run recording stopped", {
        saved: savedPath !== null,
        ...createSafePathLogFields(savedPath, "recording"),
      });
      if (savedPath && runRecordingStartedAt) {
        const settings = SettingsStoreService.getInstance().get();
        RecordingStorageService.getInstance().registerRunRecording({
          path: savedPath,
          startedAt: runRecordingStartedAt,
          stoppedAt: new Date().toISOString(),
          sourceGame: settings.activeGame,
          sourceLeague: settings.activeLeague,
        });
      }
      this.cleanupRecordingStorage([savedPath]);
    } catch (error) {
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
    _options: { forceRefresh?: boolean } = {},
  ): Promise<boolean> {
    if (this.gameRunningRefreshRequest) {
      return this.gameRunningRefreshRequest;
    }

    this.gameRunningRefreshRequest = this.resolveActiveGameRunning()
      .then(async (gameRunning) => {
        const nextGameRunning =
          !gameRunning && this.status.gameRunning
            ? this.status.gameRunning
            : gameRunning;
        await this.applyGameRunningState(nextGameRunning);

        return nextGameRunning;
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
      })
      .finally(() => {
        this.gameRunningRefreshRequest = null;
      });

    return this.gameRunningRefreshRequest;
  }

  async setGameRunningState(gameRunning: boolean): Promise<boolean> {
    await this.applyGameRunningState(gameRunning);

    return gameRunning;
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

  private async resolveActiveGameRunning(): Promise<boolean> {
    const settings = SettingsStoreService.getInstance().get();
    const state = await detectPoeProcessState(null, settings.activeGame);

    return isPoeProcessStateForGame(state, settings.activeGame);
  }

  private async applyGameRunningState(gameRunning: boolean): Promise<void> {
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

    return `${this.resolveGameLabel(settings.activeGame)} is not running`;
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
      initialized: this.status.initialized,
    });
    logInfoSync(
      MANAGED_RECORDER_LOG_SCOPE,
      "Configuring noobs process environment",
    );
    this.configureNoobsProcessEnvironment(runtimePath);

    const outputDirectory = this.resolveOutputDirectory();
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Ensuring recorder output paths", {
      ...createSafePathLogFields(outputDirectory, "outputDirectory"),
    });
    this.ensureOutputDirectories(outputDirectory);

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

    if (!this.status.initialized) {
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
    }

    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Configuring capture source");
    this.configureCaptureSource();
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Capture source ready");

    this.setStatus({
      available: true,
      initialized: true,
      runtimePath,
      outputDirectory,
      error: null,
    });
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
    const outputResolution = this.resolveRecordingResolution(
      settings.recordingOutputResolution,
    );

    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.ResetVideoContext", {
      fps: settings.recordingFps,
      width: outputResolution.width,
      height: outputResolution.height,
    });
    this.noobs?.ResetVideoContext?.(
      settings.recordingFps,
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
    const requestedVideoEncoder = settings.recordingEncoder;
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
      rateControl: videoEncoderSettings.rate_control,
      crf: videoEncoderSettings.crf ?? null,
      cqp: videoEncoderSettings.cqp ?? null,
    });
    this.noobs?.SetVideoEncoder?.(videoEncoder, {
      ...videoEncoderSettings,
    });
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.SetVideoEncoder returned");
    this.setStatus({ encoder: videoEncoder });
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Configured video encoder", {
      requestedEncoder: requestedVideoEncoder,
      encoder: videoEncoder,
      mode,
      quality:
        mode === "run"
          ? settings.recordingRunQuality
          : settings.recordingClipQuality,
      rateControl: videoEncoderSettings.rate_control,
      crf: videoEncoderSettings.crf ?? null,
      cqp: videoEncoderSettings.cqp ?? null,
      fps: settings.recordingFps,
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
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.CreateSource returned");
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.GetSourceSettings", {
      sourceType,
    });
    const settings = this.noobs.GetSourceSettings(sourceName);
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.GetSourceSettings returned");
    const configuredSettings =
      target.kind === "window"
        ? this.createWindowSourceSettings(sourceName, settings, target)
        : this.createDisplaySourceSettings(sourceName, settings, target);

    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.SetSourceSettings", {
      targetKind: target.kind,
      sourceType,
    });
    this.noobs.SetSourceSettings(sourceName, configuredSettings);
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.SetSourceSettings returned");
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "Calling noobs.AddSourceToScene");
    this.noobs.AddSourceToScene(sourceName);
    logInfoSync(MANAGED_RECORDER_LOG_SCOPE, "noobs.AddSourceToScene returned");
    this.captureSourceName = sourceName;
    this.captureSourceKey = sourceKey;
    logInfoSync(
      MANAGED_RECORDER_LOG_SCOPE,
      "Reading capture source resolution",
    );
    this.captureSourceResolution = this.readCaptureSourceResolution(sourceName);
    logInfo(MANAGED_RECORDER_LOG_SCOPE, "Capture source configured", {
      targetKind: target.kind,
      sourceType,
      sourceWidth: this.captureSourceResolution?.width ?? null,
      sourceHeight: this.captureSourceResolution?.height ?? null,
    });
  }

  private removeCaptureSource(): void {
    if (!this.captureSourceName) {
      return;
    }

    try {
      this.noobs?.RemoveSourceFromScene?.(this.captureSourceName);
    } catch {
      // Best-effort cleanup. A failed removal should not block recorder startup.
    }

    try {
      this.noobs?.DeleteSource?.(this.captureSourceName);
    } catch {
      // Best-effort cleanup. The next source name will remain unique if deletion fails.
    }

    this.captureSourceName = null;
    this.captureSourceKey = null;
    this.captureSourceResolution = null;
  }

  private resolveCaptureTarget(): CaptureTarget {
    const [profile] = ProfilesService.getInstance().list();
    if (profile?.captureTarget) {
      return profile.captureTarget;
    }

    return {
      kind: "display",
      id: "primary",
      label: "Primary display",
    };
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

    return {
      ...settings,
      method: method ?? settings.method ?? 0,
      priority: 0,
      cursor: true,
      client_area: true,
      compatibility: false,
      force_sdr: false,
      window: window?.value ?? target.id,
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
    const requestedSeconds = Math.max(
      1,
      Math.min(MANAGED_REPLAY_BUFFER_LIMIT_SECONDS, Math.round(seconds)),
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
      this.restartReplayBufferAfterSave(sessionDirectory, recordingStartedAt);
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
      return MANAGED_REPLAY_BUFFER_LIMIT_SECONDS;
    }

    const startedAtMs = new Date(this.status.recordingStartedAt).getTime();
    if (!Number.isFinite(startedAtMs)) {
      return MANAGED_REPLAY_BUFFER_LIMIT_SECONDS;
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
      kind === "manual" ? "manualClips" : "deathClips",
    );
  }

  private ensureOutputDirectories(root: string): void {
    mkdirSync(root, { recursive: true });
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
        this.setStatus({
          bufferActive: false,
          recording: true,
          runRecordingActive: true,
          error: null,
        });
        return;
      }

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
      ManagedRecorderChannel.GetStatus,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.getStatus(),
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
      [WindowName.Main],
      () => this.startRunRecording(),
    );
    registerGuardedIpcHandler(
      ManagedRecorderChannel.StopRunRecording,
      [WindowName.Main],
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
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(
          ManagedRecorderChannel.StatusChanged,
          this.status,
        );
      }
    }
  }
}

export { ManagedRecorderService };

function isAsarVirtualPath(path: string): boolean {
  const normalized = normalize(path).replaceAll("\\", "/");

  return (
    normalized.includes("/app.asar/") &&
    !normalized.includes("/app.asar.unpacked/")
  );
}

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
