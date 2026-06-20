import { app } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import {
  assertObject,
  handleValidationError,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import { type AppSettings, AppSettingsSchema } from "~/types";
import { SettingsStoreChannel } from "./SettingsStore.channels";
import { SettingsStoreRepository } from "./SettingsStore.repository";

const START_MINIMIZED_ARG = "--hidden";

class SettingsStoreService {
  private static instance: SettingsStoreService | null = null;

  private settingsCache: AppSettings | null = null;
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

    return storedSettings;
  }

  replace(settings: AppSettings): AppSettings {
    const storedSettings = this.repository.replace(settings);
    this.settingsCache = storedSettings;

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
      SettingsStoreChannel.Update,
      [WindowName.Main],
      (_event, input: unknown) => {
        try {
          assertObject(input, "settings", SettingsStoreChannel.Update);
          return this.update(input);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }
}

export { SettingsStoreService };
