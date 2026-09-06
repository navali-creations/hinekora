import { app, BrowserWindow } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { resolveEditorExportStorageRoot } from "~/main/modules/editor/EditorExport.paths";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { resolveRecordingStorageRoot } from "~/main/modules/recording-storage/RecordingStorage.utils";
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
import { storagePathsOverlap } from "~/main/utils/storage-files";

import {
  type AppSettings,
  type AppSettingsUpdate,
  AppSettingsUpdateSchema,
} from "~/types";
import { SettingsStoreChannel } from "./SettingsStore.channels";
import {
  auraOverlaySettingsUpdateKeys,
  createSettingsStoreAuraOverlaySnapshot,
  createSettingsStoreClipPreviewOverlaySnapshot,
  createSettingsStoreRecorderOverlaySnapshot,
} from "./SettingsStore.dto";
import { normalizeLeagueSettingsUpdate } from "./SettingsStore.normalization";
import { SettingsStoreRepository } from "./SettingsStore.repository";

const START_MINIMIZED_ARG = "--hidden";
const SETTINGS_STORE_SCOPE = "settings-store";
const settingsStoreFullChangeWindowRoles = new Set([WindowName.Main]);
const settingsStoreOverlayChangeWindowRoles = new Set([
  WindowName.AuraOverlay,
  WindowName.RecorderOverlay,
]);
const clipPreviewOverlaySettingsUpdateKeys = new Set<keyof AppSettings>([
  "clipPreviewInfoAlertDismissed",
]);
const auraOverlaySettingsUpdateKeySet = new Set<string>(
  auraOverlaySettingsUpdateKeys,
);

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

  update(input: AppSettingsUpdate): AppSettings {
    const parsedInput = AppSettingsUpdateSchema.parse(input);
    const normalizedInput = normalizeLeagueSettingsUpdate(
      this.get(),
      parsedInput,
    );
    if (
      Object.hasOwn(normalizedInput, "recordingStoragePath") ||
      Object.hasOwn(normalizedInput, "editorExportStoragePath")
    ) {
      assertStorageRootsDoNotOverlap({ ...this.get(), ...normalizedInput });
    }
    const shouldApplyStartupSettings =
      Object.hasOwn(normalizedInput, "appLaunchOnStartup") ||
      Object.hasOwn(normalizedInput, "appStartMinimized");
    const storedSettings = this.repository.setMany(normalizedInput);
    this.settingsCache = storedSettings;

    if (shouldApplyStartupSettings) {
      this.applyStartupSettings(storedSettings);
    }

    this.notifyChangeListeners(storedSettings);

    return storedSettings;
  }

  refreshCatalogDefaults(): AppSettings {
    const previous = this.settingsCache;
    const next = this.repository.get();
    this.settingsCache = next;

    if (
      previous &&
      previous.activeLeague === next.activeLeague &&
      previous.poe1SelectedLeague === next.poe1SelectedLeague &&
      previous.poe2SelectedLeague === next.poe2SelectedLeague
    ) {
      return next;
    }

    this.notifyChangeListeners(next);
    return next;
  }

  replace(settings: AppSettings): AppSettings {
    assertStorageRootsDoNotOverlap(settings);
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
      [WindowName.AuraOverlay, WindowName.RecorderOverlay],
      (event) =>
        getIpcWindowRole(event) === WindowName.RecorderOverlay
          ? createSettingsStoreRecorderOverlaySnapshot(this.get())
          : createSettingsStoreAuraOverlaySnapshot(this.get()),
    );
    registerGuardedIpcHandler(
      SettingsStoreChannel.GetClipPreviewOverlaySnapshot,
      [WindowName.ClipPreviewOverlay],
      () => createSettingsStoreClipPreviewOverlaySnapshot(this.get()),
    );
    registerGuardedIpcHandler(
      SettingsStoreChannel.Update,
      [WindowName.Main, WindowName.AuraOverlay, WindowName.ClipPreviewOverlay],
      (event, input: unknown) => {
        try {
          assertObject(input, "settings", SettingsStoreChannel.Update);
          const role = getIpcWindowRole(event);
          if (role === WindowName.AuraOverlay) {
            assertAuraOverlaySettingsUpdate(input);
          } else if (role === WindowName.ClipPreviewOverlay) {
            assertClipPreviewOverlaySettingsUpdate(input);
          }

          const settings = this.update(input);
          if (role === WindowName.AuraOverlay) {
            return createSettingsStoreAuraOverlaySnapshot(settings);
          }
          if (role === WindowName.ClipPreviewOverlay) {
            return createSettingsStoreClipPreviewOverlaySnapshot(settings);
          }

          return settings;
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
          role === WindowName.RecorderOverlay
            ? createSettingsStoreRecorderOverlaySnapshot(settings)
            : createSettingsStoreAuraOverlaySnapshot(settings),
        );
      }
      if (role === WindowName.ClipPreviewOverlay) {
        window.webContents.send(
          SettingsStoreChannel.ClipPreviewOverlayChanged,
          createSettingsStoreClipPreviewOverlaySnapshot(settings),
        );
      }
    }
  }
}

function assertStorageRootsDoNotOverlap(settings: AppSettings): void {
  const videosPath = app.getPath("videos");
  const recordingRoot = resolveRecordingStorageRoot(
    settings.recordingStoragePath,
    videosPath,
  );
  const exportRoot = resolveEditorExportStorageRoot(
    settings.editorExportStoragePath,
    videosPath,
  );
  if (storagePathsOverlap(recordingRoot, exportRoot)) {
    throw new Error("Recording and export folders must not contain each other");
  }
}

function assertAuraOverlaySettingsUpdate(input: Record<string, unknown>): void {
  for (const key of Object.keys(input)) {
    if (!auraOverlaySettingsUpdateKeySet.has(key)) {
      throw new IpcValidationError(
        SettingsStoreChannel.Update,
        `${key} cannot be updated from this window`,
      );
    }
  }

  for (const key of auraOverlaySettingsUpdateKeys) {
    assertOptionalBoolean(input[key], key, SettingsStoreChannel.Update);
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
