import {
  type ChildProcess,
  type SpawnOptions,
  spawn,
} from "node:child_process";
import EventEmitter from "node:events";
import { existsSync } from "node:fs";

import {
  createPoeProcessSnapshot,
  createStoppedPoeProcessStates,
  hasAnyRunningPoeProcess,
  type PoeProcessSnapshot,
  type PoeProcessState,
  type PoeProcessStatesByGame,
} from "~/main/modules/poe-process/PoeProcess.dto";
import { logWarn } from "~/main/utils/app-log";

import type { GameId } from "~/types";
import {
  type PathExists,
  resolveWindowsPoeProcessHelperPath,
} from "./PoeProcessHelperPath";
import {
  createHelperExitMessage,
  HELPER_STDOUT_LINE_MAX_CHARS,
  normalizeHelperProcessStates,
  type PoeProcessWatcherPayload,
} from "./PoeProcessHelperProtocol";

type PoeProcessWatcherChild = ChildProcess;
type SpawnProcess = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => PoeProcessWatcherChild;
type PoeProcessWatcherMode = "helper" | "stopped" | "unavailable";

interface PoeProcessWatcherOptions {
  helperPath?: string | null;
  isPackaged?: boolean;
  pathExists?: PathExists;
  platform?: NodeJS.Platform;
  spawnProcess?: SpawnProcess;
}

const HELPER_INITIAL_STATE_TIMEOUT_MS = 3_000;
const HELPER_MESSAGE_TIMEOUT_MS = 45_000;
const HELPER_RESTART_BASE_DELAY_MS = 1_000;
const HELPER_RESTART_MAX_DELAY_MS = 10_000;
const HELPER_MAX_RESTART_ATTEMPTS = 3;
const HELPER_RESTART_STABLE_MS = 30_000;
const HELPER_DIAGNOSTIC_LOG_LIMIT = 3;
const HELPER_PROCESS_TITLE = "Hinekora PoE Process Watcher";
const POE_PROCESS_SCOPE = "poe-process";

class PoeProcessWatcher extends EventEmitter {
  private readonly helperPath: string | null | undefined;
  private readonly isPackaged: boolean;
  private readonly pathExists: PathExists;
  private readonly platform: NodeJS.Platform;
  private readonly spawnProcess: SpawnProcess;
  private active = false;
  private helper: PoeProcessWatcherChild | null = null;
  private helperDiagnosticLogCount = 0;
  private helperHasState = false;
  private helperHealthTimeout: NodeJS.Timeout | null = null;
  private helperRestartAttempts = 0;
  private helperRestartTimeout: NodeJS.Timeout | null = null;
  private helperStartedAtMs = 0;
  private helperStderrBuffer = "";
  private helperStates: PoeProcessStatesByGame | null = null;
  private helperStopRequested = false;
  private mode: PoeProcessWatcherMode = "stopped";
  private previousSnapshot: PoeProcessSnapshot | undefined;
  private processExitCleanupRegistered = false;
  private readonly processExitCleanup = () => {
    this.stop();
  };
  private running = false;
  private stdoutBuffer = "";

  constructor(
    private readonly resolveActiveGame?: () => GameId | null,
    options: PoeProcessWatcherOptions = {},
  ) {
    super();
    this.helperPath = options.helperPath;
    this.isPackaged = options.isPackaged ?? false;
    this.pathExists = options.pathExists ?? existsSync;
    this.platform = options.platform ?? process.platform;
    this.spawnProcess = options.spawnProcess ?? spawn;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.helperRestartAttempts = 0;
    this.helperStartedAtMs = 0;
    this.registerProcessExitCleanup();
    if (this.platform !== "win32") {
      this.markHelperUnavailable();
      return;
    }

    this.startHelper();
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.unregisterProcessExitCleanup();
    this.clearHelperRestartTimeout();
    this.stopHelper();
    this.active = false;
    this.helperStderrBuffer = "";
    this.helperRestartAttempts = 0;
    this.helperDiagnosticLogCount = 0;
    this.mode = "stopped";
    this.previousSnapshot = undefined;
    this.helperStates = null;
    this.stdoutBuffer = "";
  }

  async pollSnapshot(): Promise<PoeProcessSnapshot> {
    return this.resolveSnapshotFromHelperStates();
  }

  getMode(): PoeProcessWatcherMode {
    return this.mode;
  }

  private startHelper(): void {
    this.clearHelperRestartTimeout();
    /* v8 ignore next -- Private guard for late restart timers after stop; public stop cancellation is covered. */
    if (!this.running) {
      return;
    }

    const command = this.resolveHelperPath();
    if (!command) {
      this.emit(
        "error",
        new Error("PoE process watcher helper executable was not found"),
      );
      this.markHelperUnavailable();
      return;
    }

    try {
      this.helperStopRequested = false;
      const helper = this.spawnProcess(
        command,
        ["--title", HELPER_PROCESS_TITLE, "--parent-pid", String(process.pid)],
        {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      this.helper = helper;
      this.helperDiagnosticLogCount = 0;
      this.helperHasState = false;
      this.helperStartedAtMs = Date.now();
      this.helperStderrBuffer = "";
      this.mode = "helper";
      this.armHelperHealthTimeout(HELPER_INITIAL_STATE_TIMEOUT_MS);
      this.setupHelperListeners(helper);
    } catch (error) {
      this.handleHelperFailure(
        error instanceof Error
          ? error
          : new Error("PoE process watcher helper failed to start"),
      );
    }
  }

  private resolveHelperPath(): string | null {
    if (this.helperPath !== undefined) {
      return this.helperPath;
    }

    return resolveWindowsPoeProcessHelperPath({
      isPackaged: this.isPackaged,
      pathExists: this.pathExists,
    });
  }

  private setupHelperListeners(helper: PoeProcessWatcherChild): void {
    helper.stdout?.setEncoding("utf8");
    helper.stdout?.on("data", (chunk: string | Buffer) => {
      if (this.helper !== helper) {
        return;
      }

      this.handleHelperStdout(String(chunk));
    });
    helper.stderr?.setEncoding("utf8");
    helper.stderr?.on("data", (chunk: string | Buffer) => {
      if (this.helper !== helper) {
        return;
      }

      this.appendHelperStderr(String(chunk));
    });
    helper.once("error", (error) => {
      if (this.helper !== helper) {
        return;
      }

      this.handleHelperFailure(error);
    });
    helper.once("exit", (code, signal) => {
      if (this.helper !== helper) {
        return;
      }

      this.helper = null;
      this.clearHelperHealthTimeout();
      /* v8 ignore next -- Defensive child-process race guard; normal stop clears the helper reference first. */
      if (!this.running || this.helperStopRequested) {
        return;
      }

      this.emit(
        "error",
        new Error(
          createHelperExitMessage(code, signal, this.consumeHelperStderr()),
        ),
      );
      this.scheduleHelperRestartOrMarkUnavailable();
    });
  }

  private stopHelper(): void {
    this.clearHelperHealthTimeout();
    if (!this.helper) {
      return;
    }

    const helper = this.helper;
    this.helper = null;
    this.helperStopRequested = true;
    helper.kill();
  }

  private handleHelperFailure(error: Error): void {
    this.stopHelper();
    this.emit("error", error);
    this.scheduleHelperRestartOrMarkUnavailable();
  }

  private scheduleHelperRestartOrMarkUnavailable(): void {
    this.clearHelperHealthTimeout();
    this.clearHelperRestartTimeout();
    this.stdoutBuffer = "";
    /* v8 ignore next -- Defensive guard for late private failure handling after stop. */
    if (!this.running) {
      return;
    }

    if (this.helperRestartAttempts >= HELPER_MAX_RESTART_ATTEMPTS) {
      this.markHelperUnavailable();
      return;
    }

    const attempt = this.helperRestartAttempts + 1;
    const delayMs = Math.min(
      HELPER_RESTART_BASE_DELAY_MS * 2 ** (attempt - 1),
      HELPER_RESTART_MAX_DELAY_MS,
    );
    this.helperRestartAttempts = attempt;
    this.mode = "helper";
    this.helperRestartTimeout = setTimeout(() => {
      this.helperRestartTimeout = null;
      this.startHelper();
    }, delayMs);
    this.helperRestartTimeout.unref?.();
  }

  private armHelperHealthTimeout(timeoutMs: number): void {
    this.clearHelperHealthTimeout();
    this.helperHealthTimeout = setTimeout(() => {
      const message = this.helperHasState
        ? "PoE process watcher helper stopped sending health updates"
        : "PoE process watcher helper did not emit an initial state";
      this.handleHelperFailure(new Error(message));
    }, timeoutMs);
    this.helperHealthTimeout.unref?.();
  }

  private clearHelperHealthTimeout(): void {
    if (!this.helperHealthTimeout) {
      return;
    }

    clearTimeout(this.helperHealthTimeout);
    this.helperHealthTimeout = null;
  }

  private clearHelperRestartTimeout(): void {
    if (!this.helperRestartTimeout) {
      return;
    }

    clearTimeout(this.helperRestartTimeout);
    this.helperRestartTimeout = null;
  }

  private appendHelperStderr(chunk: string): void {
    const message = chunk.trim();
    if (message.length === 0) {
      return;
    }

    this.helperStderrBuffer = `${this.helperStderrBuffer}\n${message}`
      .trim()
      .slice(-1_024);

    this.logHelperDiagnostic(message);
  }

  private consumeHelperStderr(): string {
    const message = this.helperStderrBuffer;
    this.helperStderrBuffer = "";

    return message;
  }

  private registerProcessExitCleanup(): void {
    /* v8 ignore next -- start() only registers once; guard protects private duplicate calls. */
    if (this.processExitCleanupRegistered) {
      return;
    }

    this.processExitCleanupRegistered = true;
    process.once("exit", this.processExitCleanup);
  }

  private unregisterProcessExitCleanup(): void {
    /* v8 ignore next -- stop() only unregisters after start; guard protects private duplicate calls. */
    if (!this.processExitCleanupRegistered) {
      return;
    }

    this.processExitCleanupRegistered = false;
    process.off("exit", this.processExitCleanup);
  }

  private handleHelperStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    /* v8 ignore next -- String#split always returns at least one item. */
    this.stdoutBuffer = lines.pop() ?? "";
    if (this.stdoutBuffer.length > HELPER_STDOUT_LINE_MAX_CHARS) {
      this.handleHelperFailure(
        new Error("PoE process watcher helper stdout line was too large"),
      );
      return;
    }

    for (const line of lines) {
      if (line.length > HELPER_STDOUT_LINE_MAX_CHARS) {
        this.handleHelperFailure(
          new Error("PoE process watcher helper stdout line was too large"),
        );
        return;
      }
      this.handleHelperLine(line);
    }
  }

  private handleHelperLine(line: string): void {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
      return;
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(trimmedLine) as unknown;
    } catch {
      this.handleHelperFailure(
        new Error("PoE process watcher helper emitted invalid JSON"),
      );
      return;
    }
    if (
      typeof parsedPayload !== "object" ||
      parsedPayload === null ||
      Array.isArray(parsedPayload)
    ) {
      this.handleHelperFailure(
        new Error("PoE process watcher helper emitted invalid JSON payload"),
      );
      return;
    }

    const payload = parsedPayload as PoeProcessWatcherPayload;

    if (payload.type === "error") {
      this.handleHelperFailure(
        new Error(
          typeof payload.message === "string"
            ? payload.message
            : "PoE process watcher helper failed",
        ),
      );
      return;
    }

    if (payload.type === "heartbeat") {
      this.resetHelperRestartAttemptsIfStable();
      this.armHelperHealthTimeout(HELPER_MESSAGE_TIMEOUT_MS);
      return;
    }

    if (payload.type !== "state") {
      this.handleHelperFailure(
        new Error("PoE process watcher helper emitted unknown payload type"),
      );
      return;
    }

    this.helperHasState = true;
    this.resetHelperRestartAttemptsIfStable();
    this.armHelperHealthTimeout(HELPER_MESSAGE_TIMEOUT_MS);
    try {
      this.helperStates = normalizeHelperProcessStates(payload.states);
    } catch (error) {
      this.handleHelperFailure(
        error instanceof Error
          ? error
          : new Error(
              "PoE process watcher helper emitted invalid state payload",
            ),
      );
      return;
    }
    this.handleDetectedSnapshot(this.resolveSnapshotFromHelperStates());
  }

  private logHelperDiagnostic(message: string): void {
    if (this.helperDiagnosticLogCount >= HELPER_DIAGNOSTIC_LOG_LIMIT) {
      return;
    }

    this.helperDiagnosticLogCount += 1;
    logWarn(POE_PROCESS_SCOPE, "PoE process watcher helper diagnostic", {
      message,
      watcherMode: this.mode,
    });
  }

  private resetHelperRestartAttemptsIfStable(): void {
    if (this.helperRestartAttempts === 0) {
      return;
    }

    if (Date.now() - this.helperStartedAtMs >= HELPER_RESTART_STABLE_MS) {
      this.helperRestartAttempts = 0;
    }
  }

  private resolveSnapshotFromHelperStates(): PoeProcessSnapshot {
    return createPoeProcessSnapshot(
      this.helperStates ?? createStoppedPoeProcessStates(),
      this.resolveActiveGame?.() ?? null,
    );
  }

  private markHelperUnavailable(): void {
    /* v8 ignore next -- start() is the public entrypoint for unavailable handling. */
    if (!this.running) {
      return;
    }

    this.clearHelperRestartTimeout();
    this.mode = "unavailable";
    this.helperHasState = false;
    this.helperStates = null;
    this.stdoutBuffer = "";
    this.forceStoppedState();
  }

  private forceStoppedState(): void {
    const previousSnapshot = this.previousSnapshot;
    const stoppedSnapshot = this.resolveSnapshotFromHelperStates();
    this.previousSnapshot = stoppedSnapshot;
    this.emit("data", stoppedSnapshot);

    if (this.active) {
      this.active = false;
      /* v8 ignore next -- Active watcher states are created with a previous snapshot; fallback protects corrupted state. */
      if (previousSnapshot) {
        this.emit("stop", previousSnapshot);
        return;
      }

      /* v8 ignore start -- Active watcher states are created with a previous snapshot; fallback protects corrupted state. */
      this.emit(
        "stop",
        createPoeProcessSnapshot(
          createStoppedPoeProcessStates(),
          this.resolveActiveGame?.() ?? null,
        ),
      );
      /* v8 ignore stop */
    }
  }

  private handleDetectedSnapshot(
    snapshot: PoeProcessSnapshot,
  ): PoeProcessSnapshot {
    this.emit("data", snapshot);

    if (hasProcessSnapshotChanged(this.previousSnapshot, snapshot)) {
      const currentActive = hasAnyRunningPoeProcess(snapshot);
      if (!this.active && currentActive) {
        this.active = true;
        this.emit("start", snapshot);
      } else if (this.active && !currentActive) {
        this.active = false;
        this.emit("stop", this.previousSnapshot);
      }

      this.previousSnapshot = snapshot;
    }

    return snapshot;
  }
}

function hasProcessStateChanged(
  previous: PoeProcessState | undefined,
  current: PoeProcessState,
): boolean {
  return (
    previous?.isRunning !== current.isRunning ||
    previous?.game !== current.game ||
    previous?.pid !== current.pid ||
    previous?.processName !== current.processName ||
    previous?.windowTitle !== current.windowTitle
  );
}

function hasProcessSnapshotChanged(
  previous: PoeProcessSnapshot | undefined,
  current: PoeProcessSnapshot,
): boolean {
  return (
    previous?.activeGame !== current.activeGame ||
    hasProcessStateChanged(previous?.states.poe1, current.states.poe1) ||
    hasProcessStateChanged(previous?.states.poe2, current.states.poe2)
  );
}

export type { PoeProcessWatcherMode, PoeProcessWatcherOptions };
export { PoeProcessWatcher };
