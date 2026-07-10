import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";

import { app, crashReporter, shell, type WebContents } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import {
  createSafePathLogFields,
  createTextHash,
  getAppLogFilePath,
  logError,
  logInfo,
  logInfoSync,
  logWarn,
} from "~/main/utils/app-log";
import {
  assertNumber,
  assertObject,
  assertString,
  handleValidationError,
  IpcValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import pkgJson from "../../../package.json" with { type: "json" };
import { DiagLogChannel } from "./DiagLog.channels";
import type {
  ClipPreviewDiagnosticEvent,
  ClipPreviewDiagnosticFieldValue,
  ClipPreviewDiagnosticInput,
  DiagLogRevealResult,
} from "./DiagLog.dto";

const DIAG_LOG_SCOPE = "diag-log";
const CLIP_PREVIEW_RENDERER_LOG_SCOPE = "clip-preview-renderer";
const recentCrashDumpLimit = 5;
const runStateFileName = "last-run.json";
const maxClipPreviewDiagnosticFields = 32;
const clipPreviewDiagnosticEvents = new Set<ClipPreviewDiagnosticEvent>([
  "clip-state",
  "document-state",
  "media-event",
  "media-source",
  "overlay-mounted",
  "overlay-unmounted",
  "playback-health",
  "trim-state",
  "workflow-state",
]);

interface DiagLogInitializeOptions {
  startReporter?: boolean;
}

interface DiagnosticCrashDumpFile {
  file: string;
  hash: string;
  modifiedAt: string;
}

interface DiagLogRunState {
  clean: boolean;
  exitedAt?: string;
  pid: number;
  startedAt: string;
  version: string;
}

class DiagLogService {
  private static instance: DiagLogService | null = null;
  private currentRunStartedAt: string | null = null;
  private electronHandlersRegistered = false;
  private initialized = false;
  private pathsLogged = false;
  private processHandlersRegistered = false;
  private runStateInitialized = false;

  private readonly handleUncaughtException = (error: Error) => {
    logError(DIAG_LOG_SCOPE, "Uncaught exception", {
      error: safeErrorMessage(error),
    });
  };

  private readonly handleUnhandledRejection = (reason: unknown) => {
    logError(DIAG_LOG_SCOPE, "Unhandled rejection", {
      error: safeErrorMessage(reason),
    });
  };

  private readonly handleBeforeExit = (code: number) => {
    logInfoSync(DIAG_LOG_SCOPE, "Main process beforeExit", { code });
  };

  private readonly handleProcessExit = (code: number) => {
    logInfoSync(DIAG_LOG_SCOPE, "Main process exit", { code });
  };

  private readonly handleAppWillQuit = () => {
    this.writeRunState({
      clean: true,
      exitedAt: new Date().toISOString(),
      pid: process.pid,
      startedAt: this.currentRunStartedAt ?? new Date().toISOString(),
      version: pkgJson.version,
    });
    logInfoSync(DIAG_LOG_SCOPE, "App run marked clean");
  };

  private readonly handleRenderProcessGone = (
    _event: Electron.Event,
    webContents: WebContents,
    details: Electron.RenderProcessGoneDetails,
  ) => {
    const fields = {
      ...createSafeWebContentsLogFields(webContents),
      exitCode: details.exitCode,
      reason: details.reason,
    };

    if (details.reason === "clean-exit") {
      logInfoSync(DIAG_LOG_SCOPE, "Renderer process exited", fields);
      return;
    }

    logError(DIAG_LOG_SCOPE, "Renderer process gone", fields);
  };

  private readonly handleChildProcessGone = (
    _event: Electron.Event,
    details: Electron.Details,
  ) => {
    const fields = {
      exitCode: details.exitCode,
      name: details.name ?? null,
      reason: details.reason,
      serviceName: details.serviceName ?? null,
      type: details.type,
    };

    if (details.reason === "clean-exit") {
      logInfoSync(DIAG_LOG_SCOPE, "Child process exited", fields);
      return;
    }

    logError(DIAG_LOG_SCOPE, "Child process gone", fields);
  };

  static getInstance(): DiagLogService {
    DiagLogService.instance ??= new DiagLogService();
    return DiagLogService.instance;
  }

  static resetForTests(): void {
    DiagLogService.instance?.disposeForTests();
    DiagLogService.instance = null;
  }

  private constructor() {
    this.setupHandlers();
  }

  initialize(options: DiagLogInitializeOptions = {}): void {
    this.registerProcessErrorHandlers();
    this.registerElectronCrashHandlers();
    this.logCrashDumpDirectory();
    this.initializeRunState();

    if (!options.startReporter || this.initialized) {
      return;
    }

    try {
      crashReporter.start({
        uploadToServer: false,
        productName: "Hinekora",
        globalExtra: {
          appVersion: pkgJson.version,
          platform: process.platform,
          arch: process.arch,
        },
      });
      this.initialized = true;

      logInfo(DIAG_LOG_SCOPE, "Local crash reporter started", {
        uploadToServer: false,
      });
    } catch (error) {
      logWarn(DIAG_LOG_SCOPE, "Local crash reporter failed to start", {
        error: safeErrorMessage(error),
      });
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  listRecentCrashDumpFiles(): DiagnosticCrashDumpFile[] {
    return listRecentCrashDumpFiles(app.getPath("crashDumps"));
  }

  revealLogFile(): DiagLogRevealResult {
    const logPath = resolveDiagnosticLogPath();

    try {
      shell.showItemInFolder(logPath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: safeErrorMessage(error),
      };
    }
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      DiagLogChannel.ClipPreviewEvent,
      [WindowName.ClipPreviewOverlay],
      (_event, input: unknown) => {
        try {
          const diagnostic = this.validateClipPreviewDiagnosticInput(input);
          logInfo(
            CLIP_PREVIEW_RENDERER_LOG_SCOPE,
            diagnostic.event,
            diagnostic.fields,
          );

          return { success: true };
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      DiagLogChannel.RevealLogFile,
      [WindowName.Main],
      () => this.revealLogFile(),
    );
  }

  private validateClipPreviewDiagnosticInput(
    value: unknown,
  ): ClipPreviewDiagnosticInput {
    const channel = DiagLogChannel.ClipPreviewEvent;
    assertObject(value, "clip preview diagnostic", channel);
    assertString(value.event, "event", channel, { min: 1, max: 64 });
    if (
      !clipPreviewDiagnosticEvents.has(
        value.event as ClipPreviewDiagnosticEvent,
      )
    ) {
      throw new IpcValidationError(channel, "event is not supported");
    }

    if (value.fields === undefined) {
      return { event: value.event as ClipPreviewDiagnosticEvent };
    }

    assertObject(value.fields, "fields", channel);
    const entries = Object.entries(value.fields);
    if (entries.length > maxClipPreviewDiagnosticFields) {
      throw new IpcValidationError(channel, "fields has too many entries");
    }

    const fields: Record<string, ClipPreviewDiagnosticFieldValue> = {};
    for (const [key, fieldValue] of entries) {
      assertString(key, "field name", channel, { min: 1, max: 64 });
      if (!/^[a-z][A-Za-z0-9]*$/.test(key)) {
        throw new IpcValidationError(channel, "field name is not supported");
      }

      if (fieldValue === null || typeof fieldValue === "boolean") {
        fields[key] = fieldValue;
        continue;
      }
      if (typeof fieldValue === "number") {
        assertNumber(fieldValue, key, channel);
        fields[key] = fieldValue;
        continue;
      }
      if (typeof fieldValue === "string") {
        assertString(fieldValue, key, channel, { max: 256 });
        fields[key] = safeErrorMessage(new Error(fieldValue));
        continue;
      }

      throw new IpcValidationError(
        channel,
        `${key} must be a primitive log value`,
      );
    }

    return {
      event: value.event as ClipPreviewDiagnosticEvent,
      fields,
    };
  }

  private registerProcessErrorHandlers(): void {
    if (this.processHandlersRegistered) {
      return;
    }

    this.processHandlersRegistered = true;
    process.on("uncaughtException", this.handleUncaughtException);
    process.on("unhandledRejection", this.handleUnhandledRejection);
    process.on("beforeExit", this.handleBeforeExit);
    process.on("exit", this.handleProcessExit);
  }

  private registerElectronCrashHandlers(): void {
    if (this.electronHandlersRegistered) {
      return;
    }

    this.electronHandlersRegistered = true;
    app.on("will-quit", this.handleAppWillQuit);
    app.on("render-process-gone", this.handleRenderProcessGone);
    app.on("child-process-gone", this.handleChildProcessGone);
  }

  private logCrashDumpDirectory(): void {
    if (this.pathsLogged) {
      return;
    }

    this.pathsLogged = true;
    const crashDumpDirectory = app.getPath("crashDumps");
    const recentDumps = listRecentCrashDumpFiles(crashDumpDirectory);
    logInfo(DIAG_LOG_SCOPE, "Crash dump directory ready", {
      ...createSafePathLogFields(crashDumpDirectory, "crashDumpDirectory"),
      crashDumpCount: recentDumps.length,
      latestCrashDumpFile: recentDumps[0]?.file ?? null,
      latestCrashDumpHash: recentDumps[0]?.hash ?? null,
      latestCrashDumpModifiedAt: recentDumps[0]?.modifiedAt ?? null,
    });
  }

  private initializeRunState(): void {
    if (this.runStateInitialized) {
      return;
    }

    this.runStateInitialized = true;
    const previousState = this.readRunState();
    if (previousState && !previousState.clean) {
      logWarn(DIAG_LOG_SCOPE, "Previous app run did not shut down cleanly", {
        previousPid: previousState.pid,
        previousStartedAt: previousState.startedAt,
        previousVersion: previousState.version,
      });
    }

    const startedAt = new Date().toISOString();
    this.currentRunStartedAt = startedAt;
    this.writeRunState({
      clean: false,
      pid: process.pid,
      startedAt,
      version: pkgJson.version,
    });
  }

  private readRunState(): DiagLogRunState | null {
    const path = this.resolveRunStatePath();
    if (!existsSync(path)) {
      return null;
    }

    try {
      const parsed = JSON.parse(
        readFileSync(path, "utf8"),
      ) as Partial<DiagLogRunState>;
      if (
        typeof parsed.clean !== "boolean" ||
        typeof parsed.pid !== "number" ||
        typeof parsed.startedAt !== "string" ||
        typeof parsed.version !== "string"
      ) {
        return null;
      }

      const state: DiagLogRunState = {
        clean: parsed.clean,
        pid: parsed.pid,
        startedAt: parsed.startedAt,
        version: parsed.version,
      };
      if (typeof parsed.exitedAt === "string") {
        state.exitedAt = parsed.exitedAt;
      }

      return state;
    } catch {
      return null;
    }
  }

  private writeRunState(state: DiagLogRunState): void {
    try {
      const path = this.resolveRunStatePath();
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(state, null, 2), "utf8");
    } catch {
      // Best-effort: diagnostics must never crash the app.
    }
  }

  private resolveRunStatePath(): string {
    return join(app.getPath("userData"), runStateFileName);
  }

  private disposeForTests(): void {
    if (this.processHandlersRegistered) {
      process.off("uncaughtException", this.handleUncaughtException);
      process.off("unhandledRejection", this.handleUnhandledRejection);
      process.off("beforeExit", this.handleBeforeExit);
      process.off("exit", this.handleProcessExit);
    }

    if (this.electronHandlersRegistered) {
      app.off("will-quit", this.handleAppWillQuit);
      app.off("render-process-gone", this.handleRenderProcessGone);
      app.off("child-process-gone", this.handleChildProcessGone);
    }
  }
}

function resolveDiagnosticLogPath(): string {
  return getAppLogFilePath() ?? join(app.getPath("logs"), "main.log");
}

function listRecentCrashDumpFiles(
  directory: string,
): DiagnosticCrashDumpFile[] {
  return collectCrashDumpFiles(directory)
    .sort((first, second) => second.modifiedAtMs - first.modifiedAtMs)
    .slice(0, recentCrashDumpLimit)
    .map((dump) => ({
      file: basename(dump.path),
      hash: createTextHash(dump.path),
      modifiedAt: new Date(dump.modifiedAtMs).toISOString(),
    }));
}

function collectCrashDumpFiles(
  directory: string,
): Array<{ modifiedAtMs: number; path: string }> {
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectCrashDumpFiles(path);
      }

      if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".dmp") {
        return [];
      }

      const stats = statSync(path);

      return [{ modifiedAtMs: stats.mtimeMs, path }];
    });
  } catch {
    return [];
  }
}

function createSafeWebContentsLogFields(webContents: WebContents): {
  urlHash: string | null;
  urlScheme: string | null;
  webContentsId: number;
  webContentsType: string;
} {
  let url: string | null = null;
  try {
    url = webContents.getURL();
  } catch {
    url = null;
  }

  return {
    urlHash: url ? createTextHash(url) : null,
    urlScheme: url ? parseUrlScheme(url) : null,
    webContentsId: webContents.id,
    webContentsType: webContents.getType(),
  };
}

function parseUrlScheme(url: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url);

  return match?.[1]?.toLowerCase() ?? null;
}

export { DiagLogService, listRecentCrashDumpFiles, resolveDiagnosticLogPath };
