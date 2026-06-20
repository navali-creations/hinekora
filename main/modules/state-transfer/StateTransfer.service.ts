import fs from "node:fs/promises";
import { dirname, join } from "node:path";

import { app, dialog } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ProfilesService } from "~/main/modules/profiles";
import { resolveRecordingStorageRoot } from "~/main/modules/recording-storage/RecordingStorage.utils";
import { ReplayClipsService } from "~/main/modules/replay-clips";
import { sanitizeReplayClipStoragePathList } from "~/main/modules/replay-clips/ReplayClips.files";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  handleValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import {
  type AppSettings,
  type StateBundle,
  StateBundleSchema,
  type StateImportMode,
  StateImportModeSchema,
  type StateImportPreview,
} from "~/types";
import { StateTransferChannel } from "./StateTransfer.channels";
import type {
  StateImportResult,
  StateTransferResult,
} from "./StateTransfer.dto";

function sanitizeImportedSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    recordingStoragePath: null,
    poe1ClientTxtPath: null,
    poe2ClientTxtPath: null,
  };
}

class StateTransferService {
  private static instance: StateTransferService | null = null;

  private pendingImportBundle: StateBundle | null = null;

  static getInstance(): StateTransferService {
    if (!StateTransferService.instance) {
      StateTransferService.instance = new StateTransferService();
    }

    return StateTransferService.instance;
  }

  constructor() {
    this.setupHandlers();
  }

  async exportPortable(): Promise<StateTransferResult> {
    try {
      const result = await dialog.showSaveDialog({
        title: "Export Hinekora Profile Backup",
        defaultPath: `hinekora-profile-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "Hinekora Profile Backup", extensions: ["json"] }],
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, path: null, error: null };
      }

      const bundle = this.createBundle();
      await fs.writeFile(
        result.filePath,
        JSON.stringify(bundle, null, 2),
        "utf8",
      );

      return { ok: true, path: result.filePath, error: null };
    } catch (error) {
      return { ok: false, path: null, error: safeErrorMessage(error) };
    }
  }

  async previewImport(): Promise<StateImportPreview | null> {
    const result = await dialog.showOpenDialog({
      title: "Import Hinekora Profile Backup",
      properties: ["openFile"],
      filters: [{ name: "Hinekora Profile Backup", extensions: ["json"] }],
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    const file = await fs.readFile(result.filePaths[0], "utf8");
    const bundle = StateBundleSchema.parse(JSON.parse(file));
    this.pendingImportBundle = bundle;

    return {
      profileCount: bundle.sections.profiles.length,
      replayClipCount: bundle.sections.replayClips.length,
      settingsIncluded: true,
    };
  }

  importPortable(mode: StateImportMode): StateImportResult {
    try {
      const parsedMode = StateImportModeSchema.parse(mode);
      if (!this.pendingImportBundle) {
        return {
          ok: false,
          backupPath: null,
          error: "No import bundle has been previewed",
        };
      }

      const backupPath =
        parsedMode === "replace" ? this.backupDatabaseFile() : null;

      const database = DatabaseService.getInstance();
      const replayClipStorageRoot = this.resolveReplayClipStorageRoot();
      database.transaction(() => {
        const bundle = this.pendingImportBundle;
        if (!bundle) {
          throw new Error("No import bundle has been previewed");
        }
        const replayClips = sanitizeReplayClipStoragePathList(
          bundle.sections.replayClips,
          replayClipStorageRoot,
        );
        const settings = sanitizeImportedSettings(bundle.sections.settings);

        if (parsedMode === "replace") {
          ProfilesService.getInstance().replaceAll(bundle.sections.profiles);
          SettingsStoreService.getInstance().replace(settings);
          ReplayClipsService.getInstance().replaceAll(
            replayClips,
            replayClipStorageRoot,
          );
          return;
        }

        ProfilesService.getInstance().upsertMany(bundle.sections.profiles);
        SettingsStoreService.getInstance().update(settings);
        ReplayClipsService.getInstance().upsertMany(
          replayClips,
          replayClipStorageRoot,
        );
      });

      this.pendingImportBundle = null;
      return { ok: true, backupPath, error: null };
    } catch (error) {
      return { ok: false, backupPath: null, error: safeErrorMessage(error) };
    }
  }

  private createBundle(): StateBundle {
    return StateBundleSchema.parse({
      format: "hinekora-state",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      sections: {
        profiles: ProfilesService.getInstance().list(),
        settings: SettingsStoreService.getInstance().get(),
        replayClips: ReplayClipsService.getInstance().list(),
      },
    });
  }

  private backupDatabaseFile(): string | null {
    const databasePath = DatabaseService.getInstance().path;
    if (databasePath === ":memory:") {
      return null;
    }

    const backupPath = join(
      dirname(databasePath),
      `hinekora-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
    );
    DatabaseService.getInstance().backupToFile(backupPath);

    return backupPath;
  }

  private resolveReplayClipStorageRoot(): string {
    const settings = SettingsStoreService.getInstance().get();
    return resolveRecordingStorageRoot(
      settings.recordingStoragePath,
      app.getPath("videos"),
    );
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      StateTransferChannel.ExportPortable,
      [WindowName.Main],
      () => this.exportPortable(),
    );
    registerGuardedIpcHandler(
      StateTransferChannel.PreviewImport,
      [WindowName.Main],
      async () => {
        try {
          return await this.previewImport();
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      StateTransferChannel.ImportPortable,
      [WindowName.Main],
      (_event, mode: unknown) => {
        try {
          return this.importPortable(StateImportModeSchema.parse(mode));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }
}

export { StateTransferService, sanitizeImportedSettings };
