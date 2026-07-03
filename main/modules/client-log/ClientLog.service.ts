import EventEmitter from "node:events";
import fs from "node:fs";

import { BrowserWindow } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { PoeProcessService } from "~/main/modules/poe-process";
import { ReplayClipsService } from "~/main/modules/replay-clips";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  createSafePathLogFields,
  createTextHash,
  logError,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import {
  assertObject,
  assertString,
  handleValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import type { AppSettings, ClientLogStatus, GameId } from "~/types";
import { ClientLogChannel } from "./ClientLog.channels";
import type {
  ClientLogActiveGameInput,
  ClientLogDeathEvent,
  ClientLogPathInput,
} from "./ClientLog.dto";
import {
  findLatestFocusState,
  hashDeathLine,
  parseClientLogEvents,
} from "./ClientLog.matcher";
import { extractCompleteLogLines } from "./ClientLog.reader";

const CLIENT_LOG_SCOPE = "client-log";
const CLIENT_LOG_WATCH_INTERVAL_MS = 1_000;
const CLIENT_LOG_READ_CHUNK_BYTES = 64 * 1024;
const CLIENT_LOG_MAX_PARTIAL_LINE_CHARS = 64 * 1024;
const CLIENT_LOG_FOCUS_STATE_TAIL_BYTES = 8 * 1024;
const CLIENT_LOG_ACTIVITY_STATE_TAIL_BYTES = 512 * 1024;
const CLIENT_LOG_FOCUS_STATE_SCAN_CHUNK_BYTES = 8 * 1024;
const CLIENT_LOG_STARTUP_FOCUS_STATE_MAX_BYTES = 512 * 1024;

class ClientLogService extends EventEmitter {
  private static instance: ClientLogService | null = null;

  private status: ClientLogStatus = {
    activeGame: "poe1",
    activeGameFocused: null,
    path: null,
    watching: false,
    lastError: null,
  };
  private fd: number | null = null;
  private lastKnownSize = 0;
  private partialLine = "";
  private isProcessing = false;
  private lastUnavailableLogAt = 0;
  private characterNames: Record<GameId, string> = {
    poe1: "",
    poe2: "",
  };
  private settingsUnsubscribe: (() => void) | null = null;

  static getInstance(): ClientLogService {
    if (!ClientLogService.instance) {
      ClientLogService.instance = new ClientLogService();
    }

    return ClientLogService.instance;
  }

  constructor() {
    super();
    this.setupHandlers();
  }

  initializeFromSettings(): void {
    const settingsStore = SettingsStoreService.getInstance();
    const settings = settingsStore.get();
    const path = this.resolveClientLogPath(settings, settings.activeGame);

    this.syncCharacterNames(settings);
    this.watchSettingsChanges(settingsStore);

    this.status = {
      ...this.status,
      activeGame: settings.activeGame,
      path,
    };

    if (path) {
      this.watchFile(path, settings.activeGame);
    } else {
      logWarn(
        CLIENT_LOG_SCOPE,
        "Client log watcher was not started: path missing",
        {
          activeGame: settings.activeGame,
        },
      );
    }
  }

  getStatus(): ClientLogStatus {
    return this.status;
  }

  reconcilePoeFocusStateFromRecentLog(): boolean | null {
    if (!this.status.watching || !this.status.path) {
      return null;
    }

    const recentFocusState = this.readLatestFocusStateFromRecentFileTail(
      this.status.path,
      this.getCurrentLogFileSize(),
    );
    if (recentFocusState === null) {
      return null;
    }

    this.setPoeFocusActive(recentFocusState);
    return recentFocusState;
  }

  setPath(input: ClientLogPathInput): ClientLogStatus {
    const settings = SettingsStoreService.getInstance();
    const updatedSettings = settings.update({
      activeGame: input.game,
      ...(input.game === "poe1"
        ? { poe1ClientTxtPath: input.path }
        : { poe2ClientTxtPath: input.path }),
    });
    this.syncCharacterNames(updatedSettings);

    this.watchFile(input.path, input.game);
    logInfo(CLIENT_LOG_SCOPE, "Client log path updated", {
      game: input.game,
      ...createSafePathLogFields(input.path, "clientLog"),
    });

    return this.status;
  }

  setActiveGame(input: ClientLogActiveGameInput): ClientLogStatus {
    const settingsStore = SettingsStoreService.getInstance();
    if (
      this.status.activeGame === input.game &&
      this.status.lastError === null
    ) {
      const currentSettings = settingsStore.get();
      const currentPath = this.resolveClientLogPath(
        currentSettings,
        input.game,
      );

      if (
        currentSettings.activeGame === input.game &&
        this.isCurrentActiveGameStatus(input.game, currentPath)
      ) {
        this.syncCharacterNames(currentSettings);
        return this.status;
      }
    }

    const settings = settingsStore.update({ activeGame: input.game });
    this.syncCharacterNames(settings);
    const path = this.resolveClientLogPath(settings, input.game);

    if (this.isCurrentActiveGameStatus(input.game, path)) {
      return this.status;
    }

    if (!path) {
      this.stopWatchFile();
      this.status = {
        activeGame: input.game,
        activeGameFocused: null,
        path: null,
        watching: false,
        lastError: null,
      };
      logWarn(
        CLIENT_LOG_SCOPE,
        "Client log watcher was not started: path missing",
        {
          activeGame: input.game,
        },
      );
      this.publishStatus();
      this.refreshPoeProcessStateAfterActiveGameChange(input.game);

      return this.status;
    }

    this.watchFile(path, input.game);
    this.refreshPoeProcessStateAfterActiveGameChange(input.game);

    return this.status;
  }

  private isCurrentActiveGameStatus(
    game: GameId,
    path: string | null,
  ): boolean {
    return (
      this.status.activeGame === game &&
      this.status.path === path &&
      this.status.watching === Boolean(path) &&
      this.status.lastError === null
    );
  }

  private resolveClientLogPath(
    settings: AppSettings,
    game: GameId,
  ): string | null {
    return game === "poe1"
      ? settings.poe1ClientTxtPath
      : settings.poe2ClientTxtPath;
  }

  private syncCharacterNames(settings: AppSettings): void {
    this.characterNames = {
      poe1: settings.poe1CharacterName.trim(),
      poe2: settings.poe2CharacterName.trim(),
    };
  }

  private watchSettingsChanges(settingsStore: SettingsStoreService): void {
    if (this.settingsUnsubscribe !== null) {
      return;
    }

    if (typeof settingsStore.onDidChange !== "function") {
      return;
    }

    this.settingsUnsubscribe = settingsStore.onDidChange((settings) => {
      this.syncCharacterNames(settings);
    });
  }

  watchFile(filePath: string, game: GameId): void {
    this.stopWatchFile();
    this.status = {
      activeGame: game,
      activeGameFocused: null,
      path: filePath,
      watching: true,
      lastError: null,
    };
    this.lastUnavailableLogAt = 0;
    this.openFileDescriptor(filePath);
    this.seedClientLogActivityState(filePath, game);
    this.seedPoeFocusState(filePath);
    logInfo(CLIENT_LOG_SCOPE, "Client log watcher started", {
      game,
      initialSize: this.lastKnownSize,
      opened: this.fd !== null,
      ...createSafePathLogFields(filePath, "clientLog"),
    });

    fs.watchFile(
      filePath,
      { interval: CLIENT_LOG_WATCH_INTERVAL_MS },
      async (curr) => {
        if (this.isProcessing) {
          return;
        }

        if (curr.size === 0 && curr.birthtimeMs === 0) {
          this.closeFileDescriptor();
          this.lastKnownSize = 0;
          this.partialLine = "";
          this.logFileUnavailable(filePath, game);
          return;
        }

        if (curr.size <= this.lastKnownSize) {
          if (curr.size < this.lastKnownSize) {
            logWarn(
              CLIENT_LOG_SCOPE,
              "Client log file was truncated or rotated",
              {
                game,
                previousSize: this.lastKnownSize,
                currentSize: curr.size,
                ...createSafePathLogFields(filePath, "clientLog"),
              },
            );
            this.openFileDescriptor(filePath);
          }
          return;
        }

        this.isProcessing = true;
        try {
          await this.processNewBytes(filePath, curr.size, game);
        } catch (error) {
          logError(CLIENT_LOG_SCOPE, "Client log processing failed", {
            game,
            error: safeErrorMessage(error),
          });
          this.status = {
            ...this.status,
            lastError: safeErrorMessage(error),
          };
          this.publishStatus();
        } finally {
          this.isProcessing = false;
        }
      },
    );

    this.publishStatus();
  }

  stopWatchFile(): void {
    if (this.status.watching && this.status.path) {
      logInfo(CLIENT_LOG_SCOPE, "Client log watcher stopped", {
        activeGame: this.status.activeGame,
        ...createSafePathLogFields(this.status.path, "clientLog"),
      });
      fs.unwatchFile(this.status.path);
    }
    this.closeFileDescriptor();
    this.lastKnownSize = 0;
    this.partialLine = "";
    this.isProcessing = false;
    this.status = { ...this.status, watching: false };
  }

  private openFileDescriptor(filePath: string): void {
    this.closeFileDescriptor();
    try {
      this.fd = fs.openSync(filePath, "r");
      this.lastKnownSize = fs.fstatSync(this.fd).size;
    } catch (error) {
      this.fd = null;
      this.lastKnownSize = 0;
      logError(CLIENT_LOG_SCOPE, "Client log file open failed", {
        error: safeErrorMessage(error),
        ...createSafePathLogFields(filePath, "clientLog"),
      });
    }
    this.partialLine = "";
  }

  private logFileUnavailable(filePath: string, game: GameId): void {
    const now = Date.now();
    if (now - this.lastUnavailableLogAt < 10_000) {
      return;
    }

    this.lastUnavailableLogAt = now;
    logWarn(CLIENT_LOG_SCOPE, "Client log file is unavailable", {
      game,
      ...createSafePathLogFields(filePath, "clientLog"),
    });
  }

  private closeFileDescriptor(): void {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        // The fd may already be invalid after deletion or rotation.
      }
      this.fd = null;
    }
  }

  private async processNewBytes(
    filePath: string,
    currentSize: number,
    game: GameId,
  ): Promise<void> {
    if (this.fd === null) {
      this.openFileDescriptor(filePath);
      return;
    }

    let position = this.lastKnownSize;
    while (position < currentSize) {
      const bytesToRead = Math.min(
        CLIENT_LOG_READ_CHUNK_BYTES,
        currentSize - position,
      );
      const buffer = Buffer.allocUnsafe(bytesToRead);
      const bytesRead = fs.readSync(this.fd, buffer, 0, bytesToRead, position);
      if (bytesRead <= 0) {
        break;
      }

      position += bytesRead;
      this.lastKnownSize = position;
      this.processLogChunk(buffer.toString("utf-8", 0, bytesRead), game);
    }
  }

  private processLogChunk(chunk: string, game: GameId): void {
    const result = extractCompleteLogLines(this.partialLine + chunk);
    this.partialLine = this.normalizePartialLine(result.partialLine);
    const textToParse = result.textToParse;
    if (!textToParse) {
      return;
    }

    const parsedEvents = parseClientLogEvents(textToParse, {
      characterName: this.characterNames[game],
    });
    BookmarksService.getInstance().handleClientLogActivityEvents(
      game,
      parsedEvents.activityEvents,
    );
    for (const focusEvent of parsedEvents.focusEvents) {
      logInfo(
        CLIENT_LOG_SCOPE,
        focusEvent.focused
          ? "Active game focus gained"
          : "Active game focus lost",
        {
          game,
          focused: focusEvent.focused,
          lineHash: createTextHash(focusEvent.line),
        },
      );
      this.setPoeFocusActive(focusEvent.focused);
    }

    const deathLines = parsedEvents.deathLines;
    if (deathLines.length > 0) {
      logInfo(CLIENT_LOG_SCOPE, "Death log lines matched", {
        game,
        count: deathLines.length,
        chunkHash: createTextHash(textToParse),
      });
    }

    for (const line of deathLines) {
      const deathEvent: ClientLogDeathEvent = {
        game,
        line,
        lineHash: hashDeathLine(line),
        detectedAt: new Date().toISOString(),
      };
      logInfo(CLIENT_LOG_SCOPE, "Dispatching death event", {
        game,
        lineHash: deathEvent.lineHash,
      });
      this.emit("death", deathEvent);
      BookmarksService.getInstance().handleClientLogDeath(deathEvent);
      void ReplayClipsService.getInstance().handleDeathEvent(deathEvent);
    }
  }

  private seedClientLogActivityState(filePath: string, game: GameId): void {
    if (this.fd === null || this.lastKnownSize <= 0) {
      return;
    }

    try {
      const chunks: string[] = [];
      const maxBytes = Math.min(
        this.lastKnownSize,
        CLIENT_LOG_ACTIVITY_STATE_TAIL_BYTES,
      );
      let scannedBytes = 0;
      let endPosition = this.lastKnownSize;

      while (scannedBytes < maxBytes) {
        const bytesToRead = Math.min(
          CLIENT_LOG_FOCUS_STATE_SCAN_CHUNK_BYTES,
          maxBytes - scannedBytes,
        );
        const position = endPosition - bytesToRead;
        const buffer = Buffer.allocUnsafe(bytesToRead);
        const bytesRead = fs.readSync(
          this.fd,
          buffer,
          0,
          bytesToRead,
          position,
        );
        if (bytesRead <= 0) {
          break;
        }

        chunks.unshift(buffer.toString("utf-8", 0, bytesRead));
        scannedBytes += bytesRead;
        endPosition = position;
      }

      if (chunks.length === 0) {
        return;
      }

      const parsedEvents = parseClientLogEvents(chunks.join(""), {
        characterName: this.characterNames[game],
      });
      if (parsedEvents.activityEvents.length === 0) {
        return;
      }

      BookmarksService.getInstance().seedClientLogActivityState(
        game,
        parsedEvents.activityEvents,
      );
    } catch (error) {
      logWarn(CLIENT_LOG_SCOPE, "Client log activity seed failed", {
        game,
        error: safeErrorMessage(error),
        ...createSafePathLogFields(filePath, "clientLog"),
      });
    }
  }

  private normalizePartialLine(line: string): string {
    return line.length > CLIENT_LOG_MAX_PARTIAL_LINE_CHARS
      ? line.slice(-CLIENT_LOG_MAX_PARTIAL_LINE_CHARS)
      : line;
  }

  private readLatestFocusStateFromRecentFileTail(
    filePath: string,
    fileSize = this.lastKnownSize,
    maxBytesToRead = CLIENT_LOG_FOCUS_STATE_TAIL_BYTES,
  ): boolean | null {
    if (this.fd === null || fileSize <= 0) {
      return null;
    }

    try {
      const maxBytes = Math.min(fileSize, maxBytesToRead);
      let scannedBytes = 0;
      let endPosition = fileSize;
      let leadingPartialLine = "";

      while (scannedBytes < maxBytes) {
        const bytesToRead = Math.min(
          CLIENT_LOG_FOCUS_STATE_SCAN_CHUNK_BYTES,
          maxBytes - scannedBytes,
        );
        const position = endPosition - bytesToRead;
        const buffer = Buffer.allocUnsafe(bytesToRead);
        const bytesRead = fs.readSync(
          this.fd,
          buffer,
          0,
          bytesToRead,
          position,
        );
        if (bytesRead <= 0) {
          return null;
        }

        scannedBytes += bytesRead;
        endPosition = position;
        const textToParse =
          buffer.toString("utf-8", 0, bytesRead) + leadingPartialLine;

        const focusState = findLatestFocusState(textToParse);
        if (focusState !== null) {
          return focusState;
        }

        const firstLineBreakIndex = textToParse.indexOf("\n");
        leadingPartialLine =
          firstLineBreakIndex === -1
            ? textToParse
            : textToParse.slice(0, firstLineBreakIndex);

        if (bytesRead < bytesToRead) {
          return null;
        }
      }

      return null;
    } catch (error) {
      logWarn(CLIENT_LOG_SCOPE, "Client log focus state read failed", {
        error: safeErrorMessage(error),
        ...createSafePathLogFields(filePath, "clientLog"),
      });
      return null;
    }
  }

  private getCurrentLogFileSize(): number {
    if (this.fd === null) {
      return 0;
    }

    try {
      return fs.fstatSync(this.fd).size;
    } catch {
      return this.lastKnownSize;
    }
  }

  private seedPoeFocusState(filePath: string): void {
    const recentFocusState = this.readLatestFocusStateFromRecentFileTail(
      filePath,
      this.lastKnownSize,
      CLIENT_LOG_STARTUP_FOCUS_STATE_MAX_BYTES,
    );
    if (recentFocusState !== null) {
      this.setPoeFocusActive(recentFocusState);
    }
  }

  private setPoeFocusActive(active: boolean): void {
    if (this.status.activeGameFocused !== active) {
      this.status = {
        ...this.status,
        activeGameFocused: active,
      };
      this.publishStatus();
    }

    OverlayWindowsService.getInstance().setPoeFocusActive(active);
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      ClientLogChannel.GetStatus,
      [WindowName.Main],
      () => this.getStatus(),
    );
    registerGuardedIpcHandler(
      ClientLogChannel.SetPath,
      [WindowName.Main],
      (_event, input: unknown) => {
        try {
          assertObject(input, "client log path", ClientLogChannel.SetPath);
          if (input.game !== "poe1" && input.game !== "poe2") {
            throw new Error("game must be poe1 or poe2");
          }
          assertString(input.path, "path", ClientLogChannel.SetPath, {
            min: 1,
            max: 2_048,
          });

          return this.setPath(input as unknown as ClientLogPathInput);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ClientLogChannel.SetActiveGame,
      [WindowName.Main],
      (_event, input: unknown) => {
        try {
          assertObject(
            input,
            "client log active game",
            ClientLogChannel.SetActiveGame,
          );
          if (input.game !== "poe1" && input.game !== "poe2") {
            throw new Error("game must be poe1 or poe2");
          }

          return this.setActiveGame(
            input as unknown as ClientLogActiveGameInput,
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }

  private publishStatus(): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(ClientLogChannel.StatusChanged, this.status);
      }
    }
  }

  private refreshPoeProcessStateAfterActiveGameChange(game: GameId): void {
    void PoeProcessService.getInstance()
      .refreshState()
      .then((state) => {
        logInfo(
          CLIENT_LOG_SCOPE,
          "PoE process state refreshed after game switch",
          {
            activeGame: game,
            processRunning: state.isRunning,
            processName: state.processName,
          },
        );
      })
      .catch((error) => {
        logWarn(
          CLIENT_LOG_SCOPE,
          "PoE process refresh after game switch failed",
          {
            activeGame: game,
            error: safeErrorMessage(error),
          },
        );
      });
  }
}

export { ClientLogService };
