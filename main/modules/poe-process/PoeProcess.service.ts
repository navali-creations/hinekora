import { BrowserWindow, powerMonitor } from "electron";

import { CapturePreviewChannel } from "~/main/modules/capture-preview/CapturePreview.channels";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  isPoeProcessStateForGame,
  PoeProcessPoller,
  type ProcessState,
} from "~/main/pollers";
import { logInfo, logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import { PoeProcessChannel } from "./PoeProcess.channels";
import type { PoeProcessState } from "./PoeProcess.dto";

const POE_PROCESS_SCOPE = "poe-process";
const STOPPED_POE_PROCESS_STATE: PoeProcessState = {
  isRunning: false,
  processName: "",
};

interface PoeProcessRefreshOptions {
  requestCapturePreviewRefresh?: boolean;
}

class PoeProcessService {
  private static instance: PoeProcessService | null = null;

  private readonly poller: PoeProcessPoller;
  private currentState: PoeProcessState = STOPPED_POE_PROCESS_STATE;
  private initialized = false;
  private systemSuspended = false;

  static getInstance(): PoeProcessService {
    if (!PoeProcessService.instance) {
      PoeProcessService.instance = new PoeProcessService();
    }

    return PoeProcessService.instance;
  }

  constructor() {
    this.poller = new PoeProcessPoller(
      () => SettingsStoreService.getInstance().get().activeGame,
    );
    this.setupPollerListeners();
    this.setupHandlers();
    this.setupSettingsListener();
    this.setupPowerMonitor();
  }

  initialize(): void {
    this.initialized = true;
    if (!this.systemSuspended) {
      this.poller.start();
    }
  }

  stop(): void {
    this.initialized = false;
    this.poller.stop();
  }

  getState(): PoeProcessState {
    return this.currentState;
  }

  async refreshState(
    options: PoeProcessRefreshOptions = {},
  ): Promise<PoeProcessState> {
    if (this.systemSuspended) {
      return this.currentState;
    }

    try {
      const state = await this.poller.pollNow();
      if (this.hasProcessStateChanged(this.currentState, state)) {
        this.handleStateChanged(PoeProcessChannel.GetState, state, {
          requestCapturePreviewRefresh:
            options.requestCapturePreviewRefresh !== false,
        });
      } else {
        this.syncGameRunningConsumers();
      }

      return state;
    } catch (error) {
      logWarn(POE_PROCESS_SCOPE, "PoE process refresh failed", {
        error: safeErrorMessage(error),
      });

      return this.currentState;
    }
  }

  isActiveGameRunning(state: PoeProcessState = this.currentState): boolean {
    const { activeGame } = SettingsStoreService.getInstance().get();

    return isPoeProcessStateForGame(state, activeGame);
  }

  private setupPollerListeners(): void {
    this.poller.on("start", (state: ProcessState) => {
      if (!this.shouldHandlePollerEvent()) {
        return;
      }

      this.handleStateChanged(PoeProcessChannel.Start, state);
    });

    this.poller.on("stop", (_previousState: ProcessState) => {
      if (!this.shouldHandlePollerEvent()) {
        return;
      }

      logInfo(POE_PROCESS_SCOPE, "PoE process monitor stopped", {
        activeGame: SettingsStoreService.getInstance().get().activeGame,
        previousGame: this.currentState.game ?? null,
        previousIsRunning: this.currentState.isRunning,
        previousProcessName: this.currentState.processName,
      });
      this.currentState = STOPPED_POE_PROCESS_STATE;
      this.syncGameRunningConsumers();
      this.sendToRenderer(PoeProcessChannel.Stop, STOPPED_POE_PROCESS_STATE);
      this.requestCapturePreviewRefresh();
    });

    this.poller.on("data", (state: ProcessState) => {
      if (!this.shouldHandlePollerEvent()) {
        return;
      }
      if (!this.shouldHandlePollerDataEvent(state)) {
        return;
      }

      this.handleStateChanged(PoeProcessChannel.GetState, state);
    });

    this.poller.on("error", (error: Error) => {
      if (!this.shouldHandlePollerEvent()) {
        return;
      }

      const message = safeErrorMessage(error);
      logWarn(POE_PROCESS_SCOPE, "PoE process poller error", {
        error: message,
      });
      this.sendToRenderer(PoeProcessChannel.GetError, { error: message });
    });
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      PoeProcessChannel.IsRunning,
      [WindowName.Main, WindowName.AuraOverlay],
      () => this.getState(),
    );
  }

  private setupSettingsListener(): void {
    const settingsStore = SettingsStoreService.getInstance();
    let previousActiveGame = settingsStore.get().activeGame;

    settingsStore.onDidChange((settings) => {
      if (settings.activeGame === previousActiveGame) {
        return;
      }

      previousActiveGame = settings.activeGame;
      this.syncGameRunningConsumers();
      this.sendToRenderer(PoeProcessChannel.GetState, this.currentState);
      this.requestCapturePreviewRefresh();
    });
  }

  private setupPowerMonitor(): void {
    powerMonitor.on("suspend", () => {
      logInfo(POE_PROCESS_SCOPE, "System suspending; stopping process poller");
      this.systemSuspended = true;
      this.poller.stop();
      this.currentState = STOPPED_POE_PROCESS_STATE;
      this.syncGameRunningConsumers();
      this.sendToRenderer(PoeProcessChannel.Stop, STOPPED_POE_PROCESS_STATE);
      this.requestCapturePreviewRefresh();
    });

    powerMonitor.on("resume", () => {
      logInfo(POE_PROCESS_SCOPE, "System resumed; starting process poller");
      this.systemSuspended = false;
      if (this.initialized) {
        this.poller.start();
      }
    });

    powerMonitor.on("lock-screen", () => {
      logInfo(POE_PROCESS_SCOPE, "Screen locked");
    });

    powerMonitor.on("unlock-screen", () => {
      logInfo(POE_PROCESS_SCOPE, "Screen unlocked");
    });
  }

  private handleStateChanged(
    channel: PoeProcessChannel.Start | PoeProcessChannel.GetState,
    state: ProcessState,
    options: PoeProcessRefreshOptions = {},
  ): void {
    const previousState = this.currentState;
    this.currentState = state;
    logInfo(POE_PROCESS_SCOPE, "PoE process monitor state changed", {
      activeGame: SettingsStoreService.getInstance().get().activeGame,
      channel,
      isActiveGameRunning: this.isActiveGameRunning(state),
      previousGame: previousState.game ?? null,
      previousIsRunning: previousState.isRunning,
      previousProcessName: previousState.processName,
      resolvedGame: state.game ?? null,
      isRunning: state.isRunning,
      processName: state.processName,
    });
    this.syncGameRunningConsumers();
    this.sendToRenderer(channel, state);
    if (options.requestCapturePreviewRefresh !== false) {
      this.requestCapturePreviewRefresh();
    }
  }

  private shouldHandlePollerEvent(): boolean {
    return this.initialized && !this.systemSuspended;
  }

  private shouldHandlePollerDataEvent(state: ProcessState): boolean {
    if (!this.hasProcessStateChanged(this.currentState, state)) {
      return false;
    }

    return this.currentState.isRunning === state.isRunning;
  }

  private hasProcessStateChanged(
    previous: PoeProcessState,
    current: ProcessState,
  ): boolean {
    return (
      previous.isRunning !== current.isRunning ||
      previous.game !== current.game ||
      previous.processName !== current.processName
    );
  }

  private syncGameRunningConsumers(): void {
    const gameRunning = this.isActiveGameRunning();
    OverlayWindowsService.getInstance().setGameRunningActive(gameRunning);
    void ManagedRecorderService.getInstance()
      .setGameRunningState(gameRunning)
      .catch((error) => {
        logWarn(POE_PROCESS_SCOPE, "Failed to sync recorder game state", {
          error: safeErrorMessage(error),
        });
      });
  }

  private requestCapturePreviewRefresh(): void {
    this.sendToRenderer(CapturePreviewChannel.RefreshRequested);
  }

  private sendToRenderer(
    channel: PoeProcessChannel | CapturePreviewChannel,
    data?: unknown,
  ): void {
    for (const window of BrowserWindow.getAllWindows()) {
      try {
        if (window.isDestroyed()) {
          continue;
        }

        if (data === undefined) {
          window.webContents.send(channel);
        } else {
          window.webContents.send(channel, data);
        }
      } catch (error) {
        logWarn(POE_PROCESS_SCOPE, "Failed to send process state", {
          channel,
          error: safeErrorMessage(error),
        });
      }
    }
  }
}

export { PoeProcessService };
