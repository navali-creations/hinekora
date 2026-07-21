import {
  app,
  BrowserWindow,
  dialog,
  type OpenDialogOptions,
  powerMonitor,
} from "electron";

import { ClientLogService } from "~/main/modules/client-log";
import { DatabaseService } from "~/main/modules/database";
import { EditorService } from "~/main/modules/editor";
import { KeybindsService } from "~/main/modules/keybinds";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { PoeProcessService } from "~/main/modules/poe-process";
import { UpdaterService } from "~/main/modules/updater";
import { logError, logInfo, logWarn } from "~/main/utils/app-log";
import {
  handleValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import { AppChannel } from "./App.channels";
import type { AppSelectPathFilter, AppSelectPathInput } from "./App.dto";

interface AppBeforeQuitEvent {
  preventDefault?(): void;
}

const APP_SCOPE = "app";

class AppService {
  private static instance: AppService | null = null;
  private isShutdownCleanupRegistered = false;
  private isSystemPowerCleanupRegistered = false;
  private shutdownCleanupComplete = false;
  private shutdownCleanupPromise: Promise<void> | null = null;
  isQuitting = false;

  static getInstance(): AppService {
    if (!AppService.instance) {
      AppService.instance = new AppService();
    }

    return AppService.instance;
  }

  constructor() {
    registerGuardedIpcHandler(AppChannel.GetVersion, [WindowName.Main], () =>
      this.version(),
    );
    registerGuardedIpcHandler(
      AppChannel.SelectPath,
      [WindowName.Main],
      async (_event, input: unknown) => {
        try {
          return await this.selectPath(input);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }

  registerShutdownCleanup(): void {
    if (this.isShutdownCleanupRegistered) {
      return;
    }

    this.isShutdownCleanupRegistered = true;
    app.on("before-quit", (event) => {
      void this.handleBeforeQuit(event);
    });
  }

  registerSystemPowerCleanup(): void {
    if (this.isSystemPowerCleanupRegistered) {
      return;
    }

    this.isSystemPowerCleanupRegistered = true;
    powerMonitor.on("suspend", () => {
      this.handleSystemSuspend();
    });
    powerMonitor.on("resume", () => {
      void this.handleSystemOverlayRestore("System resumed");
    });
    powerMonitor.on("unlock-screen", () => {
      void this.handleSystemOverlayRestore("Screen unlocked");
    });
  }

  async selectPath(input: unknown): Promise<string | null> {
    const options = this.parseSelectPathInput(input);
    const parent =
      BrowserWindow.getFocusedWindow() ??
      BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
    const dialogOptions: OpenDialogOptions = {
      properties: options.properties,
    };
    if (options.title) {
      dialogOptions.title = options.title;
    }
    if (options.defaultPath) {
      dialogOptions.defaultPath = options.defaultPath;
    }
    if (options.filters) {
      dialogOptions.filters = options.filters;
    }
    const result = parent
      ? await dialog.showOpenDialog(parent, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    return result.canceled ? null : (result.filePaths[0] ?? null);
  }

  version(): string {
    return app.getVersion();
  }

  private async handleBeforeQuit(
    event: AppBeforeQuitEvent | undefined,
  ): Promise<void> {
    if (this.shutdownCleanupComplete) {
      return;
    }

    const isCleanupOwner = !this.shutdownCleanupPromise;
    const shouldResumeQuit =
      isCleanupOwner && typeof event?.preventDefault === "function";
    event?.preventDefault?.();

    if (!this.shutdownCleanupPromise) {
      this.shutdownCleanupPromise = this.runShutdownCleanup();
    }

    try {
      await this.shutdownCleanupPromise;
    } catch (error) {
      logError(APP_SCOPE, "Shutdown cleanup failed", {
        error: safeErrorMessage(error),
      });
    } finally {
      if (isCleanupOwner) {
        this.shutdownCleanupComplete = true;
        this.shutdownCleanupPromise = null;
        if (shouldResumeQuit) {
          app.quit();
        }
      }
    }
  }

  private async runShutdownCleanup(): Promise<void> {
    this.isQuitting = true;
    logInfo(APP_SCOPE, "Shutdown cleanup started");

    await this.runShutdownStep("Stopping client log watcher", () => {
      ClientLogService.getInstance().stopWatchFile();
    });

    await this.runShutdownStep("Stopping PoE process monitor", () => {
      PoeProcessService.getInstance().stop();
    });

    await this.runShutdownStep("Stopping managed recorder", async () => {
      const managedRecorder = ManagedRecorderService.getInstance();
      const status = managedRecorder.getStatus();
      if (status.runRecordingActive) {
        await managedRecorder.stopRunRecording();
      }
      if (status.bufferActive) {
        await managedRecorder.stopBuffer();
      }
    });

    await this.runShutdownStep("Stopping updater", () => {
      UpdaterService.getInstance().destroy();
    });

    await this.runShutdownStep("Unregistering keybinds", () => {
      KeybindsService.getInstance().destroy();
    });

    await this.runShutdownStep("Closing overlay windows", () => {
      OverlayWindowsService.getInstance().destroyAll();
    });

    await this.runShutdownStep("Stopping editor exports", () =>
      EditorService.shutdownIfInitialized(),
    );

    await this.runShutdownStep("Closing database", () => {
      DatabaseService.getInstance().close();
    });

    logInfo(APP_SCOPE, "Shutdown cleanup complete");
  }

  private handleSystemSuspend(): void {
    logInfo(APP_SCOPE, "System suspend detected; suspending overlay windows");

    try {
      OverlayWindowsService.getInstance().suspendForSystem();
      logInfo(APP_SCOPE, "System suspend overlay cleanup complete");
    } catch (error) {
      logError(APP_SCOPE, "System suspend overlay cleanup failed", {
        error: safeErrorMessage(error),
      });
    }
  }

  private async handleSystemOverlayRestore(reason: string): Promise<void> {
    logInfo(APP_SCOPE, `${reason}; restoring overlay windows`);

    this.reconcileSystemOverlayFocus(reason);

    try {
      await OverlayWindowsService.getInstance().restoreRequestedOverlays();
      logInfo(APP_SCOPE, `${reason} overlay restore complete`);
    } catch (error) {
      logError(APP_SCOPE, `${reason} overlay restore failed`, {
        error: safeErrorMessage(error),
      });
    }
  }

  private reconcileSystemOverlayFocus(reason: string): void {
    try {
      ClientLogService.getInstance().reconcilePoeFocusStateFromRecentLog();
    } catch (error) {
      logWarn(APP_SCOPE, `${reason} focus reconciliation failed`, {
        error: safeErrorMessage(error),
      });
    }
  }

  private async runShutdownStep(
    message: string,
    work: () => Promise<unknown> | unknown,
  ): Promise<void> {
    logInfo(APP_SCOPE, message);
    try {
      await work();
      logInfo(APP_SCOPE, `${message} complete`);
    } catch (error) {
      logError(APP_SCOPE, `${message} failed`, {
        error: safeErrorMessage(error),
      });
    }
  }

  private parseSelectPathInput(input: unknown): AppSelectPathInput {
    if (typeof input !== "object" || input === null) {
      throw new Error("select path options must be an object");
    }

    const record = input as Record<string, unknown>;
    const properties = this.parseProperties(record.properties);

    const parsed: AppSelectPathInput = { properties };
    const title = this.optionalString(record.title, 160);
    const defaultPath = this.optionalString(record.defaultPath, 2_048);
    const filters = this.parseFilters(record.filters);

    if (title) {
      parsed.title = title;
    }
    if (defaultPath) {
      parsed.defaultPath = defaultPath;
    }
    if (filters) {
      parsed.filters = filters;
    }

    return parsed;
  }

  private parseProperties(value: unknown): Array<"openFile" | "openDirectory"> {
    if (!Array.isArray(value)) {
      return ["openFile"];
    }

    const allowed = value.filter(
      (property): property is "openFile" | "openDirectory" =>
        property === "openFile" || property === "openDirectory",
    );

    if (allowed.includes("openDirectory")) {
      return ["openDirectory"];
    }

    return ["openFile"];
  }

  private parseFilters(value: unknown): AppSelectPathFilter[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.slice(0, 8).flatMap((filter): AppSelectPathFilter[] => {
      if (typeof filter !== "object" || filter === null) {
        return [];
      }

      const record = filter as Record<string, unknown>;
      const name = this.optionalString(record.name, 80) ?? "Files";
      const extensions = Array.isArray(record.extensions)
        ? record.extensions
            .filter(
              (extension): extension is string => typeof extension === "string",
            )
            .map((extension) => extension.replace(/^\./, "").slice(0, 16))
            .filter((extension) => /^[a-z0-9*]+$/i.test(extension))
            .slice(0, 16)
        : [];

      return extensions.length > 0 ? [{ name, extensions }] : [];
    });
  }

  private optionalString(
    value: unknown,
    maxLength: number,
  ): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    return trimmed.slice(0, maxLength);
  }
}

export { AppService };
