import { BrowserWindow, globalShortcut } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { ReplayClipsService } from "~/main/modules/replay-clips";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { logInfo, logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import {
  getIpcWindowRole,
  registerGuardedIpcHandler,
} from "~/main/utils/ipc-window-roles";

import {
  type AppSettings,
  Keybind,
  type KeybindAction,
  keybindActionConfigs,
  keybindActions,
} from "~/types";
import { KeybindsChannel } from "./Keybinds.channels";
import type {
  KeybindRegistrationStatus,
  KeybindRegistrationStatusItem,
} from "./Keybinds.dto";

const KEYBINDS_LOG_SCOPE = "keybinds";
const keybindStatusChangeWindowRoles = new Set([WindowName.Main]);

class KeybindsService {
  private static instance: KeybindsService | null = null;

  private keybindSettingsSignature: string | null = null;
  private readonly registeredAccelerators = new Set<string>();
  private settingsUnsubscribe: (() => void) | null = null;
  private status: KeybindRegistrationStatus = createUnregisteredStatus();

  static getInstance(): KeybindsService {
    if (!KeybindsService.instance) {
      KeybindsService.instance = new KeybindsService();
    }

    return KeybindsService.instance;
  }

  static resetForTests(): void {
    KeybindsService.instance = null;
  }

  constructor() {
    this.setupHandlers();
  }

  initialize(): void {
    const settingsStore = SettingsStoreService.getInstance();
    this.registerFromSettings(settingsStore.get());
    this.settingsUnsubscribe ??= settingsStore.onDidChange((settings) => {
      this.registerFromSettings(settings);
    });
  }

  destroy(): void {
    this.settingsUnsubscribe?.();
    this.settingsUnsubscribe = null;
    this.unregisterAll();
    this.keybindSettingsSignature = null;
    this.status = createUnregisteredStatus();
    this.publishStatus();
  }

  getStatus(): KeybindRegistrationStatus {
    return this.status;
  }

  private registerFromSettings(settings: AppSettings): void {
    const keybindSettingsSignature = createKeybindSettingsSignature(settings);
    if (keybindSettingsSignature === this.keybindSettingsSignature) {
      return;
    }

    this.keybindSettingsSignature = keybindSettingsSignature;
    this.unregisterAll();

    const nextStatus = createUnregisteredStatus();
    const acceleratorOwners = new Map<string, KeybindAction>();

    for (const action of keybindActions) {
      const item = this.registerActionKeybind(
        action,
        settings,
        acceleratorOwners,
      );
      nextStatus[action] = item;
    }

    this.status = nextStatus;
    this.publishStatus();
  }

  private registerActionKeybind(
    action: KeybindAction,
    settings: AppSettings,
    acceleratorOwners: Map<string, KeybindAction>,
  ): KeybindRegistrationStatusItem {
    const config = keybindActionConfigs[action];
    const rawAccelerator = settings[config.settingKey];
    const keybind = Keybind.tryParse(rawAccelerator);
    if (!rawAccelerator) {
      return {
        accelerator: null,
        displayLabel: null,
        error: "No keybind set",
        registered: false,
      };
    }
    if (!keybind) {
      return {
        accelerator: rawAccelerator,
        displayLabel: rawAccelerator,
        error: "Invalid keybind",
        registered: false,
      };
    }

    const accelerator = keybind.toElectronAccelerator();
    const duplicateAction = acceleratorOwners.get(accelerator);
    if (duplicateAction) {
      return {
        accelerator,
        displayLabel: keybind.toDisplayLabel(),
        error: `Already used by ${keybindActionConfigs[duplicateAction].label}`,
        registered: false,
      };
    }

    acceleratorOwners.set(accelerator, action);
    const registered = globalShortcut.register(accelerator, () => {
      this.handleKeybindAction(action);
    });
    if (registered) {
      this.registeredAccelerators.add(accelerator);
    } else {
      logWarn(KEYBINDS_LOG_SCOPE, "Global keybind registration failed", {
        accelerator,
        action,
      });
    }

    return {
      accelerator,
      displayLabel: keybind.toDisplayLabel(),
      error: registered ? null : "Shortcut is unavailable",
      registered,
    };
  }

  private handleKeybindAction(action: KeybindAction): void {
    if (action === "manualBookmark") {
      this.createManualBookmark();
      return;
    }

    this.saveManualReplay();
  }

  private createManualBookmark(): void {
    const status = ManagedRecorderService.getInstance().getStatus();
    if (!status.runRecordingActive) {
      logInfo(KEYBINDS_LOG_SCOPE, "Manual bookmark keybind ignored", {
        bufferActive: status.bufferActive,
        runRecordingActive: status.runRecordingActive,
      });
      return;
    }

    const result = BookmarksService.getInstance().createManualBookmark();
    if (!result.ok) {
      logWarn(KEYBINDS_LOG_SCOPE, "Manual bookmark keybind failed", {
        error: result.error,
      });
    }
  }

  private saveManualReplay(): void {
    const status = ManagedRecorderService.getInstance().getStatus();
    if (!status.bufferActive) {
      logInfo(KEYBINDS_LOG_SCOPE, "Manual replay keybind ignored", {
        bufferActive: status.bufferActive,
        runRecordingActive: status.runRecordingActive,
      });
      return;
    }

    void ReplayClipsService.getInstance()
      .saveManualReplay()
      .catch((error) => {
        logWarn(KEYBINDS_LOG_SCOPE, "Manual replay keybind failed", {
          error: safeErrorMessage(error),
        });
      });
  }

  private unregisterAll(): void {
    for (const accelerator of this.registeredAccelerators) {
      globalShortcut.unregister(accelerator);
    }
    this.registeredAccelerators.clear();
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      KeybindsChannel.GetStatus,
      [WindowName.Main],
      () => this.getStatus(),
    );
  }

  private publishStatus(): void {
    const windows = BrowserWindow?.getAllWindows?.() ?? [];

    for (const window of windows) {
      if (window.isDestroyed()) {
        continue;
      }

      const role = getIpcWindowRole({ sender: window.webContents });
      if (role && keybindStatusChangeWindowRoles.has(role)) {
        window.webContents.send(KeybindsChannel.StatusChanged, this.status);
      }
    }
  }
}

function createKeybindSettingsSignature(settings: AppSettings): string {
  return keybindActions
    .map((action) => {
      const config = keybindActionConfigs[action];

      return settings[config.settingKey] ?? "";
    })
    .join("\u0000");
}

function createUnregisteredStatus(): KeybindRegistrationStatus {
  return keybindActions.reduce((status, action) => {
    status[action] = {
      accelerator: null,
      displayLabel: null,
      error: "Not registered",
      registered: false,
    };

    return status;
  }, {} as KeybindRegistrationStatus);
}

export { KeybindsService };
