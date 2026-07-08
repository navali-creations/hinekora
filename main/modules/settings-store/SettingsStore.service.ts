import { app, BrowserWindow } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { logWarn } from "~/main/utils/app-log";
import {
  assertObject,
  assertOptionalBoolean,
  handleValidationError,
  IpcValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import {
  getIpcWindowRole,
  registerGuardedIpcHandler,
} from "~/main/utils/ipc-window-roles";

import { type AppSettings, AppSettingsSchema } from "~/types";
import { SettingsStoreChannel } from "./SettingsStore.channels";
import { createSettingsStoreOverlaySnapshot } from "./SettingsStore.dto";
import { SettingsStoreRepository } from "./SettingsStore.repository";

const START_MINIMIZED_ARG = "--hidden";
const SETTINGS_STORE_SCOPE = "settings-store";
const settingsStoreFullChangeWindowRoles = new Set([WindowName.Main]);
const settingsStoreOverlayChangeWindowRoles = new Set([
  WindowName.AuraOverlay,
  WindowName.ClipPreviewOverlay,
  WindowName.RecorderOverlay,
]);
const clipPreviewOverlaySettingsUpdateKeys = new Set<keyof AppSettings>([
  "clipPreviewInfoAlertDismissed",
]);

type SettingsStoreChangeListener = (settings: AppSettings) => void;

class SettingsStoreService {
  private static instance: SettingsStoreService | null = null;

  private settingsCache: AppSettings | null = null;
  private readonly changeListeners = new Set<SettingsStoreChangeListener>();
  private readonly repository: SettingsStoreRepository;

  static getInstance(): SettingsStoreService {
    if (!SettingsStoreService.instance) {
      SettingsStoreService.instance = new SettingsStoreService();
    }

    return SettingsStoreService.instance;
  }

  static resetForTests(): void {
    SettingsStoreService.instance = null;
  }

  constructor() {
    this.repository = new SettingsStoreRepository(
      DatabaseService.getInstance(),
    );
    this.setupHandlers();
  }

  get(): AppSettings {
    this.settingsCache ??= this.repository.get();

    return this.settingsCache;
  }

  onDidChange(listener: SettingsStoreChangeListener): () => void {
    this.changeListeners.add(listener);

    return () => {
      this.changeListeners.delete(listener);
    };
  }

  update(input: Partial<AppSettings>): AppSettings {
    const current = this.get();
    const next = AppSettingsSchema.parse({ ...current, ...input });
    const shouldApplyStartupSettings =
      Object.hasOwn(input, "appLaunchOnStartup") ||
      Object.hasOwn(input, "appStartMinimized");
    const storedSettings = this.repository.setMany(next);
    this.settingsCache = storedSettings;

    if (shouldApplyStartupSettings) {
      this.applyStartupSettings(storedSettings);
    }

    this.notifyChangeListeners(storedSettings);

    return storedSettings;
  }

  replace(settings: AppSettings): AppSettings {
    const storedSettings = this.repository.replace(settings);
    this.settingsCache = storedSettings;
    this.notifyChangeListeners(storedSettings);

    return storedSettings;
  }

  applyStartupSettings(settings = this.get()): void {
    app.setLoginItemSettings({
      args: settings.appStartMinimized ? [START_MINIMIZED_ARG] : [],
      openAsHidden: settings.appStartMinimized,
      openAtLogin: settings.appLaunchOnStartup,
    });
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(SettingsStoreChannel.Get, [WindowName.Main], () =>
      this.get(),
    );
    registerGuardedIpcHandler(
      SettingsStoreChannel.GetOverlaySnapshot,
      [
        WindowName.AuraOverlay,
        WindowName.ClipPreviewOverlay,
        WindowName.RecorderOverlay,
      ],
      () => createSettingsStoreOverlaySnapshot(this.get()),
    );
    registerGuardedIpcHandler(
      SettingsStoreChannel.Update,
      [WindowName.Main, WindowName.ClipPreviewOverlay],
      (event, input: unknown) => {
        try {
          assertObject(input, "settings", SettingsStoreChannel.Update);
          if (getIpcWindowRole(event) === WindowName.ClipPreviewOverlay) {
            assertClipPreviewOverlaySettingsUpdate(input);
          }

          return this.update(input);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }

  private notifyChangeListeners(settings: AppSettings): void {
    for (const listener of this.changeListeners) {
      try {
        listener(settings);
      } catch (error) {
        logWarn(SETTINGS_STORE_SCOPE, "Settings change listener failed", {
          error: safeErrorMessage(error),
        });
      }
    }

    this.publishSettingsChanged(settings);
  }

  private publishSettingsChanged(settings: AppSettings): void {
    const windows = BrowserWindow?.getAllWindows?.() ?? [];

    for (const window of windows) {
      if (window.isDestroyed()) {
        continue;
      }

      const role = getIpcWindowRole({ sender: window.webContents });
      if (role && settingsStoreFullChangeWindowRoles.has(role)) {
        window.webContents.send(SettingsStoreChannel.Changed, settings);
      }
      if (role && settingsStoreOverlayChangeWindowRoles.has(role)) {
        window.webContents.send(
          SettingsStoreChannel.OverlayChanged,
          createSettingsStoreOverlaySnapshot(settings),
        );
      }
    }
  }
}

function assertClipPreviewOverlaySettingsUpdate(
  input: Record<string, unknown>,
): void {
  for (const key of Object.keys(input)) {
    if (!clipPreviewOverlaySettingsUpdateKeys.has(key as keyof AppSettings)) {
      throw new IpcValidationError(
        SettingsStoreChannel.Update,
        `${key} cannot be updated from this window`,
      );
    }
  }

  assertOptionalBoolean(
    input.clipPreviewInfoAlertDismissed,
    "clipPreviewInfoAlertDismissed",
    SettingsStoreChannel.Update,
  );
}

export { SettingsStoreService };
