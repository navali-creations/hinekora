import { app, BrowserWindow, powerMonitor } from "electron";

import { CapturePreviewChannel } from "~/main/modules/capture-preview/CapturePreview.channels";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import {
  createPoeProcessSnapshot,
  createStoppedPoeProcessState,
  createStoppedPoeProcessStates,
  getPoeProcessStateForGame,
  hasAnyRunningPoeProcess,
  isPoeProcessSnapshotRunningForGame,
  type PoeProcessSnapshot,
  type PoeProcessState,
} from "~/main/modules/poe-process/PoeProcess.dto";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  clearPoeProcessStateProvider,
  type PoeProcessStateProvider,
  PoeProcessWatcher,
  setPoeProcessStateProvider,
} from "~/main/pollers";
import { logInfo, logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import type { GameId } from "~/types";
import { PoeProcessChannel } from "./PoeProcess.channels";

const POE_PROCESS_SCOPE = "poe-process";

interface PoeProcessRefreshOptions {
  preferredGame?: GameId | null;
  requestCapturePreviewRefresh?: boolean;
}

class PoeProcessService {
  private static instance: PoeProcessService | null = null;

  private readonly watcher: PoeProcessWatcher;
  private readonly stateProvider: PoeProcessStateProvider;
  private activeGame: GameId = "poe1";
  private currentSnapshot: PoeProcessSnapshot = createPoeProcessSnapshot(
    createStoppedPoeProcessStates(),
  );
  private initialized = false;
  private settingsUnsubscribe: (() => void) | null = null;
  private systemSuspended = false;
  private readonly handleSystemSuspend = () => {
    logInfo(POE_PROCESS_SCOPE, "System suspending; stopping process watcher");
    this.systemSuspended = true;
    this.watcher.stop();
    const stoppedSnapshot = this.createStoppedSnapshot();
    this.currentSnapshot = stoppedSnapshot;
    this.syncGameRunningConsumers();
    this.sendToRenderer(PoeProcessChannel.Stop, stoppedSnapshot);
    this.requestCapturePreviewRefresh();
  };
  private readonly handleSystemResume = () => {
    logInfo(POE_PROCESS_SCOPE, "System resumed; starting process watcher");
    this.systemSuspended = false;
    if (this.initialized) {
      this.watcher.start();
    }
  };
  private readonly handleScreenLock = () => {
    logInfo(POE_PROCESS_SCOPE, "Screen locked");
  };
  private readonly handleScreenUnlock = () => {
    logInfo(POE_PROCESS_SCOPE, "Screen unlocked");
  };

  static getInstance(): PoeProcessService {
    if (!PoeProcessService.instance) {
      PoeProcessService.instance = new PoeProcessService();
    }

    return PoeProcessService.instance;
  }

  static resetForTests(): void {
    PoeProcessService.instance?.dispose();
    PoeProcessService.instance = null;
    clearPoeProcessStateProvider();
  }

  constructor() {
    this.activeGame = SettingsStoreService.getInstance().get().activeGame;
    this.currentSnapshot = this.createStoppedSnapshot();
    this.watcher = new PoeProcessWatcher(() => this.activeGame, {
      isPackaged: app.isPackaged,
    });
    this.stateProvider = {
      refreshState: (preferredGame) => {
        return this.refreshState({
          preferredGame,
          requestCapturePreviewRefresh: false,
        });
      },
    };
    setPoeProcessStateProvider(this.stateProvider);
    this.setupWatcherListeners();
    this.setupHandlers();
    this.setupSettingsListener();
    this.setupPowerMonitor();
  }

  initialize(): void {
    this.initialized = true;
    if (!this.systemSuspended) {
      this.watcher.start();
    }
  }

  stop(): void {
    this.initialized = false;
    this.watcher.stop();
  }

  dispose(): void {
    this.stop();
    this.settingsUnsubscribe?.();
    this.settingsUnsubscribe = null;
    powerMonitor.off("suspend", this.handleSystemSuspend);
    powerMonitor.off("resume", this.handleSystemResume);
    powerMonitor.off("lock-screen", this.handleScreenLock);
    powerMonitor.off("unlock-screen", this.handleScreenUnlock);
    clearPoeProcessStateProvider(this.stateProvider);
  }

  getState(): PoeProcessState {
    return this.getStateForGame(this.activeGame);
  }

  getSnapshot(): PoeProcessSnapshot {
    return this.createSnapshotForActiveGame(this.currentSnapshot.states);
  }

  getStateForGame(game: GameId): PoeProcessState {
    const state = getPoeProcessStateForGame(this.currentSnapshot, game);

    return state.isRunning ? state : createStoppedPoeProcessState();
  }

  async refreshState(
    options: PoeProcessRefreshOptions = {},
  ): Promise<PoeProcessState> {
    if (this.systemSuspended) {
      return options.preferredGame
        ? this.getStateForGame(options.preferredGame)
        : this.getState();
    }

    try {
      const snapshot = await this.watcher.pollSnapshot();
      if (this.hasProcessSnapshotChanged(this.currentSnapshot, snapshot)) {
        this.handleSnapshotChanged(
          PoeProcessChannel.SnapshotChanged,
          snapshot,
          {
            requestCapturePreviewRefresh:
              options.requestCapturePreviewRefresh !== false,
          },
        );
      } else {
        this.currentSnapshot = this.createSnapshotForActiveGame(
          snapshot.states,
        );
        this.syncGameRunningConsumers();
      }

      return options.preferredGame
        ? this.normalizeResolvedState(
            getPoeProcessStateForGame(snapshot, options.preferredGame),
          )
        : this.getState();
    } catch (error) {
      logWarn(POE_PROCESS_SCOPE, "PoE process refresh failed", {
        error: safeErrorMessage(error),
        watcherMode: this.watcher.getMode(),
      });

      return options.preferredGame
        ? this.getStateForGame(options.preferredGame)
        : this.getState();
    }
  }

  async refreshSnapshot(
    options: Omit<PoeProcessRefreshOptions, "preferredGame"> = {},
  ): Promise<PoeProcessSnapshot> {
    if (this.systemSuspended) {
      return this.getSnapshot();
    }

    try {
      const snapshot = await this.watcher.pollSnapshot();
      if (this.hasProcessSnapshotChanged(this.currentSnapshot, snapshot)) {
        this.handleSnapshotChanged(
          PoeProcessChannel.SnapshotChanged,
          snapshot,
          {
            requestCapturePreviewRefresh:
              options.requestCapturePreviewRefresh !== false,
          },
        );
      } else {
        this.currentSnapshot = this.createSnapshotForActiveGame(
          snapshot.states,
        );
        this.syncGameRunningConsumers();
      }

      return this.getSnapshot();
    } catch (error) {
      logWarn(POE_PROCESS_SCOPE, "PoE process refresh failed", {
        error: safeErrorMessage(error),
        watcherMode: this.watcher.getMode(),
      });

      return this.getSnapshot();
    }
  }

  isActiveGameRunning(
    snapshot: PoeProcessSnapshot = this.currentSnapshot,
  ): boolean {
    return isPoeProcessSnapshotRunningForGame(snapshot, this.activeGame);
  }

  private setupWatcherListeners(): void {
    this.watcher.on("start", (snapshot: PoeProcessSnapshot) => {
      if (!this.shouldHandleWatcherEvent()) {
        return;
      }

      this.handleSnapshotChanged(PoeProcessChannel.Start, snapshot);
    });

    this.watcher.on("stop", (_previousSnapshot: PoeProcessSnapshot) => {
      if (!this.shouldHandleWatcherEvent()) {
        return;
      }

      const previousActiveState = this.getState();
      logInfo(POE_PROCESS_SCOPE, "PoE process monitor stopped", {
        activeGame: this.activeGame,
        previousGame: previousActiveState.game ?? null,
        previousIsRunning: previousActiveState.isRunning,
        previousPid: previousActiveState.pid ?? null,
        previousProcessName: previousActiveState.processName,
        previousWindowTitle: previousActiveState.windowTitle ?? null,
        watcherMode: this.watcher.getMode(),
      });
      const stoppedSnapshot = this.createStoppedSnapshot();
      this.currentSnapshot = stoppedSnapshot;
      this.syncGameRunningConsumers();
      this.sendToRenderer(PoeProcessChannel.Stop, stoppedSnapshot);
      this.requestCapturePreviewRefresh();
    });

    this.watcher.on("data", (snapshot: PoeProcessSnapshot) => {
      if (!this.shouldHandleWatcherEvent()) {
        return;
      }
      if (!this.shouldHandleWatcherDataEvent(snapshot)) {
        return;
      }

      this.handleSnapshotChanged(PoeProcessChannel.SnapshotChanged, snapshot);
    });

    this.watcher.on("error", (error: Error) => {
      if (!this.shouldHandleWatcherEvent()) {
        return;
      }

      const message = safeErrorMessage(error);
      logWarn(POE_PROCESS_SCOPE, "PoE process watcher error", {
        error: message,
        watcherMode: this.watcher.getMode(),
      });
      this.sendToRenderer(PoeProcessChannel.GetError, { error: message });
    });
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      PoeProcessChannel.GetSnapshot,
      [WindowName.Main, WindowName.AuraOverlay],
      () => this.getSnapshot(),
    );
  }

  private setupSettingsListener(): void {
    const settingsStore = SettingsStoreService.getInstance();
    let previousActiveGame = this.activeGame;

    this.settingsUnsubscribe?.();
    this.settingsUnsubscribe = settingsStore.onDidChange((settings) => {
      if (settings.activeGame === previousActiveGame) {
        return;
      }

      previousActiveGame = settings.activeGame;
      this.activeGame = settings.activeGame;
      void this.refreshStateAfterActiveGameChange();
    });
  }

  private async refreshStateAfterActiveGameChange(): Promise<void> {
    if (this.systemSuspended) {
      this.syncGameRunningConsumers();
      this.sendToRenderer(
        PoeProcessChannel.SnapshotChanged,
        this.getSnapshot(),
      );
      this.requestCapturePreviewRefresh();
      return;
    }

    try {
      const snapshot = await this.watcher.pollSnapshot();
      if (this.hasProcessSnapshotChanged(this.currentSnapshot, snapshot)) {
        this.handleSnapshotChanged(
          PoeProcessChannel.SnapshotChanged,
          snapshot,
          {
            requestCapturePreviewRefresh: false,
          },
        );
      } else {
        this.currentSnapshot = this.createSnapshotForActiveGame(
          snapshot.states,
        );
        this.syncGameRunningConsumers();
        this.sendToRenderer(
          PoeProcessChannel.SnapshotChanged,
          this.getSnapshot(),
        );
      }
    } catch (error) {
      logWarn(POE_PROCESS_SCOPE, "PoE process active-game refresh failed", {
        error: safeErrorMessage(error),
        watcherMode: this.watcher.getMode(),
      });
      this.syncGameRunningConsumers();
      this.sendToRenderer(
        PoeProcessChannel.SnapshotChanged,
        this.getSnapshot(),
      );
    }

    this.requestCapturePreviewRefresh();
  }

  private setupPowerMonitor(): void {
    powerMonitor.on("suspend", this.handleSystemSuspend);
    powerMonitor.on("resume", this.handleSystemResume);
    powerMonitor.on("lock-screen", this.handleScreenLock);
    powerMonitor.on("unlock-screen", this.handleScreenUnlock);
  }

  private handleSnapshotChanged(
    channel: PoeProcessChannel.Start | PoeProcessChannel.SnapshotChanged,
    snapshot: PoeProcessSnapshot,
    options: PoeProcessRefreshOptions = {},
  ): void {
    const previousSnapshot = this.currentSnapshot;
    const previousActiveState = this.getState();
    const nextSnapshot = this.createSnapshotForActiveGame(snapshot.states);
    const nextActiveState = nextSnapshot.activeState;
    this.currentSnapshot = nextSnapshot;
    logInfo(POE_PROCESS_SCOPE, "PoE process monitor state changed", {
      activeGame: this.activeGame,
      channel,
      isActiveGameRunning: this.isActiveGameRunning(nextSnapshot),
      anyGameRunning: hasAnyRunningPoeProcess(nextSnapshot),
      previousActiveGame: previousSnapshot.activeGame,
      previousGame: previousActiveState.game ?? null,
      previousIsRunning: previousActiveState.isRunning,
      previousPid: previousActiveState.pid ?? null,
      previousProcessName: previousActiveState.processName,
      previousWindowTitle: previousActiveState.windowTitle ?? null,
      resolvedGame: nextActiveState.game ?? null,
      isRunning: nextActiveState.isRunning,
      pid: nextActiveState.pid ?? null,
      processName: nextActiveState.processName,
      windowTitle: nextActiveState.windowTitle ?? null,
      poe1Running: nextSnapshot.states.poe1.isRunning,
      poe2Running: nextSnapshot.states.poe2.isRunning,
      watcherMode: this.watcher.getMode(),
    });
    this.syncGameRunningConsumers();
    this.sendToRenderer(channel, nextSnapshot);
    if (options.requestCapturePreviewRefresh !== false) {
      this.requestCapturePreviewRefresh();
    }
  }

  private shouldHandleWatcherEvent(): boolean {
    return this.initialized && !this.systemSuspended;
  }

  private shouldHandleWatcherDataEvent(snapshot: PoeProcessSnapshot): boolean {
    if (!this.hasProcessSnapshotChanged(this.currentSnapshot, snapshot)) {
      return false;
    }

    return (
      hasAnyRunningPoeProcess(this.currentSnapshot) ===
      hasAnyRunningPoeProcess(snapshot)
    );
  }

  private hasProcessSnapshotChanged(
    previous: PoeProcessSnapshot,
    current: PoeProcessSnapshot,
  ): boolean {
    return (
      previous.activeGame !== current.activeGame ||
      this.hasProcessStateChanged(previous.states.poe1, current.states.poe1) ||
      this.hasProcessStateChanged(previous.states.poe2, current.states.poe2)
    );
  }

  private hasProcessStateChanged(
    previous: PoeProcessState,
    current: PoeProcessState,
  ): boolean {
    return (
      previous.isRunning !== current.isRunning ||
      previous.game !== current.game ||
      previous.pid !== current.pid ||
      previous.processName !== current.processName ||
      previous.windowTitle !== current.windowTitle
    );
  }

  private normalizeResolvedState(state: PoeProcessState): PoeProcessState {
    return state.isRunning ? state : createStoppedPoeProcessState();
  }

  private createStoppedSnapshot(): PoeProcessSnapshot {
    return this.createSnapshotForActiveGame(createStoppedPoeProcessStates());
  }

  private createSnapshotForActiveGame(
    states: PoeProcessSnapshot["states"],
  ): PoeProcessSnapshot {
    return createPoeProcessSnapshot(states, this.activeGame);
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
