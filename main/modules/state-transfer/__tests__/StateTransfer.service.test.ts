import { existsSync, mkdtempSync, rmSync } from "node:fs";
import fsPromises from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaptureProfilesService } from "~/main/modules/capture-profiles";
import { DatabaseService } from "~/main/modules/database";
import { ProfilesService } from "~/main/modules/profiles";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { ReplayClipsService } from "~/main/modules/replay-clips";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createReplayClip } from "~/main/test/factories/replayClip";
import { mockIpcMainHandlers } from "~/main/test/ipc";

import {
  createDefaultCaptureProfile,
  createDefaultSettings,
  type StateBundle,
} from "~/types";
import { StateTransferChannel } from "../StateTransfer.channels";
import {
  StateTransferService,
  sanitizeImportedSettings,
} from "../StateTransfer.service";

const electronMocks = vi.hoisted(() => ({
  getPath: vi.fn(),
  getVersion: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: electronMocks.getPath,
    getVersion: electronMocks.getVersion,
  },
  dialog: {
    showOpenDialog: electronMocks.showOpenDialog,
    showSaveDialog: electronMocks.showSaveDialog,
  },
}));

let directory: string;
let trustedRoot: string;
let importedRoot: string;
let database: DatabaseService;
let cleanupRecordingStorage: ReturnType<typeof vi.fn>;

function createBundle(
  overrides: Partial<Omit<StateBundle, "sections">> & {
    sections?: Partial<StateBundle["sections"]>;
  } = {},
): StateBundle {
  const bundle: StateBundle = {
    format: "hinekora-state",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: "0.0.0",
    sections: {
      profiles: [],
      captureProfiles: [],
      settings: createDefaultSettings(),
      replayClips: [],
    },
  };

  return {
    ...bundle,
    ...overrides,
    sections: {
      ...bundle.sections,
      ...overrides.sections,
    },
  };
}

function setPendingBundle(
  service: StateTransferService,
  bundle: StateBundle,
): void {
  (
    service as unknown as { pendingImportBundle: StateBundle | null }
  ).pendingImportBundle = bundle;
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hinekora-state-transfer-"));
  trustedRoot = join(directory, "trusted-recordings");
  importedRoot = join(directory, "imported-recordings");
  database = new DatabaseService(join(directory, "hinekora.sqlite"));
  database.runQuery(
    database.kysely
      .insertInto("settings")
      .values({
        key: "activeGame",
        value_json: JSON.stringify("poe2"),
        updated_at: new Date().toISOString(),
      })
      .onConflict((conflict) =>
        conflict.column("key").doUpdateSet({
          value_json: JSON.stringify("poe2"),
          updated_at: new Date().toISOString(),
        }),
      ),
  );
  electronMocks.getPath.mockReturnValue(join(directory, "videos"));
  electronMocks.getVersion.mockReturnValue("1.2.3");
  cleanupRecordingStorage = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
    scheduleCleanup: cleanupRecordingStorage,
  } as unknown as RecordingStorageService);
});

afterEach(() => {
  electronMocks.getPath.mockReset();
  electronMocks.getVersion.mockReset();
  electronMocks.showOpenDialog.mockReset();
  electronMocks.showSaveDialog.mockReset();
  vi.restoreAllMocks();
  database.close();
  rmSync(directory, { force: true, recursive: true });
});

describe("StateTransferService", () => {
  it("creates and reuses the singleton instance", () => {
    const singletonAccess = StateTransferService as unknown as {
      instance: StateTransferService | null;
    };
    singletonAccess.instance = null;

    const first = StateTransferService.getInstance();
    const second = StateTransferService.getInstance();

    expect(first).toBe(second);
    singletonAccess.instance = null;
  });

  it("exports a portable state bundle through the save dialog", async () => {
    const writeFile = vi
      .spyOn(fsPromises, "writeFile")
      .mockResolvedValue(undefined);
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      list: () => [],
    } as unknown as ProfilesService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [],
    } as unknown as CaptureProfilesService);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => createDefaultSettings(),
    } as unknown as SettingsStoreService);
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      list: () => [],
    } as unknown as ReplayClipsService);
    electronMocks.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: join(directory, "backup.json"),
    });
    const service = new StateTransferService();

    await expect(service.exportPortable()).resolves.toEqual({
      ok: true,
      path: join(directory, "backup.json"),
      error: null,
    });
    expect(JSON.parse(writeFile.mock.calls[0]?.[1] as string)).toMatchObject({
      format: "hinekora-state",
      appVersion: "1.2.3",
      sections: {
        profiles: [],
        captureProfiles: [],
        replayClips: [],
      },
    });
  });

  it("returns null when export or preview dialogs are canceled", async () => {
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    electronMocks.showSaveDialog.mockResolvedValue({
      canceled: true,
    });
    const service = new StateTransferService();

    await expect(service.exportPortable()).resolves.toEqual({
      ok: false,
      path: null,
      error: null,
    });
    await expect(service.previewImport()).resolves.toBeNull();
  });

  it("returns a safe export failure when the save dialog fails", async () => {
    electronMocks.showSaveDialog.mockRejectedValue(
      new Error("cannot save C:\\Users\\seb\\Videos\\backup.json"),
    );
    const service = new StateTransferService();

    await expect(service.exportPortable()).resolves.toEqual({
      ok: false,
      path: null,
      error: "cannot save [path]",
    });
  });

  it("previews an import bundle and stores it for import", async () => {
    const bundle = createBundle({
      sections: {
        profiles: [],
        captureProfiles: [],
        settings: createDefaultSettings(),
        replayClips: [createReplayClip()],
      },
    });
    vi.spyOn(fsPromises, "readFile").mockResolvedValue(JSON.stringify(bundle));
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [join(directory, "backup.json")],
    });
    const service = new StateTransferService();

    await expect(service.previewImport()).resolves.toEqual({
      profileCount: 0,
      captureProfileCount: 0,
      replayClipCount: 1,
      settingsIncluded: true,
    });
  });

  it("previews old import bundles without capture profile sections", async () => {
    const bundle = createBundle({
      sections: {
        settings: createDefaultSettings(),
      },
    });
    const legacyBundle = JSON.parse(JSON.stringify(bundle));
    delete legacyBundle.sections.captureProfiles;
    vi.spyOn(fsPromises, "readFile").mockResolvedValue(
      JSON.stringify(legacyBundle),
    );
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [join(directory, "legacy-backup.json")],
    });
    const service = new StateTransferService();

    await expect(service.previewImport()).resolves.toEqual({
      profileCount: 0,
      captureProfileCount: 0,
      replayClipCount: 0,
      settingsIncluded: true,
    });
  });

  it("rejects import when no bundle has been previewed", async () => {
    const service = new StateTransferService();

    await expect(service.importPortable("replace")).resolves.toEqual({
      ok: false,
      backupPath: null,
      error: "No import bundle has been previewed",
    });
  });

  it("backs up the database and sanitizes imported replay paths against the pre-import storage root", async () => {
    const replaceAllProfiles = vi.fn();
    const replaceAllCaptureProfiles = vi.fn();
    const replaceSettings = vi.fn();
    const replaceAllReplayClips = vi.fn();
    const captureProfile = {
      ...createDefaultCaptureProfile({
        name: "Capture import",
        game: "poe2",
      }),
      id: "capture-profile-import",
    };
    const importedClipPath = join(importedRoot, "2026-06-12_10-30-00.mp4");
    const bundle = createBundle({
      sections: {
        profiles: [],
        captureProfiles: [captureProfile],
        settings: {
          ...createDefaultSettings(),
          recordingStoragePath: importedRoot,
        },
        replayClips: [
          createReplayClip({
            originalObsPath: importedClipPath,
            processedClipPath: importedClipPath,
          }),
        ],
      },
    });
    const service = new StateTransferService();
    setPendingBundle(service, bundle);
    vi.spyOn(DatabaseService, "getInstance").mockReturnValue(database);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: trustedRoot,
      }),
      replace: replaceSettings,
    } as unknown as SettingsStoreService);
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      replaceAll: replaceAllProfiles,
    } as unknown as ProfilesService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      replaceAll: replaceAllCaptureProfiles,
    } as unknown as CaptureProfilesService);
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      replaceAll: replaceAllReplayClips,
    } as unknown as ReplayClipsService);
    const result = await service.importPortable("replace");

    expect(result.ok).toBe(true);
    expect(result.backupPath).toEqual(expect.stringMatching(/\.sqlite$/));
    expect(result.backupPath && existsSync(result.backupPath)).toBe(true);
    expect(replaceSettings).toHaveBeenCalledWith(
      sanitizeImportedSettings(bundle.sections.settings, [captureProfile]),
    );
    expect(replaceAllCaptureProfiles).toHaveBeenCalledWith([captureProfile]);
    expect(replaceAllReplayClips).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          originalObsPath: null,
          processedClipPath: null,
          status: "failed",
        }),
      ],
      trustedRoot,
    );

    const backup = new DatabaseSync(result.backupPath ?? "", {
      readOnly: true,
    });
    try {
      expect(
        backup
          .prepare("SELECT value_json FROM settings WHERE key = ?")
          .get("activeGame"),
      ).toEqual({ value_json: JSON.stringify("poe2") });
    } finally {
      backup.close();
    }
  });

  it("replaces imported state without a backup for in-memory databases", async () => {
    const memoryDatabase = new DatabaseService(":memory:");
    const replaceAllProfiles = vi.fn();
    const replaceAllCaptureProfiles = vi.fn();
    const replaceSettings = vi.fn();
    const replaceAllReplayClips = vi.fn();
    const bundle = createBundle();
    const service = new StateTransferService();
    setPendingBundle(service, bundle);
    vi.spyOn(DatabaseService, "getInstance").mockReturnValue(memoryDatabase);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => createDefaultSettings(),
      replace: replaceSettings,
    } as unknown as SettingsStoreService);
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      replaceAll: replaceAllProfiles,
    } as unknown as ProfilesService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      replaceAll: replaceAllCaptureProfiles,
    } as unknown as CaptureProfilesService);
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      replaceAll: replaceAllReplayClips,
    } as unknown as ReplayClipsService);

    try {
      await expect(service.importPortable("replace")).resolves.toEqual({
        ok: true,
        backupPath: null,
        error: null,
      });
      expect(replaceAllProfiles).toHaveBeenCalledWith([]);
      expect(replaceAllCaptureProfiles).toHaveBeenCalledWith([]);
      expect(replaceSettings).toHaveBeenCalledWith(
        sanitizeImportedSettings(bundle.sections.settings, []),
      );
      expect(replaceAllReplayClips).toHaveBeenCalledWith(
        [],
        expect.any(String),
      );
    } finally {
      memoryDatabase.close();
    }
  });

  it("merges imported state without creating a database backup", async () => {
    const upsertProfiles = vi.fn();
    const upsertCaptureProfiles = vi.fn();
    const updateSettings = vi.fn();
    const upsertReplayClips = vi.fn();
    const captureProfile = {
      ...createDefaultCaptureProfile({
        name: "Capture merge",
        game: "poe1",
      }),
      id: "capture-profile-merge",
    };
    const clipPath = join(trustedRoot, "2026-06-12_10-30-00.mp4");
    const bundle = createBundle({
      sections: {
        profiles: [],
        captureProfiles: [captureProfile],
        settings: createDefaultSettings(),
        replayClips: [createReplayClip({ processedClipPath: clipPath })],
      },
    });
    const service = new StateTransferService();
    setPendingBundle(service, bundle);
    vi.spyOn(DatabaseService, "getInstance").mockReturnValue(database);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: trustedRoot,
      }),
      update: updateSettings,
    } as unknown as SettingsStoreService);
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      upsertMany: upsertProfiles,
    } as unknown as ProfilesService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      upsertMany: upsertCaptureProfiles,
    } as unknown as CaptureProfilesService);
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      upsertMany: upsertReplayClips,
    } as unknown as ReplayClipsService);

    await expect(service.importPortable("merge")).resolves.toEqual({
      ok: true,
      backupPath: null,
      error: null,
    });
    expect(upsertProfiles).toHaveBeenCalledWith([]);
    expect(upsertCaptureProfiles).toHaveBeenCalledWith([captureProfile]);
    expect(updateSettings).toHaveBeenCalledWith(
      sanitizeImportedSettings(bundle.sections.settings, [captureProfile]),
    );
    expect(upsertReplayClips).toHaveBeenCalledWith(
      [expect.objectContaining({ processedClipPath: clipPath })],
      trustedRoot,
    );
  });

  it("reports a committed import as successful when post-import cleanup fails", async () => {
    const bundle = createBundle();
    const service = new StateTransferService();
    setPendingBundle(service, bundle);
    cleanupRecordingStorage.mockImplementationOnce(() => {
      throw new Error("cleanup failed");
    });
    vi.spyOn(DatabaseService, "getInstance").mockReturnValue(database);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: trustedRoot,
      }),
      update: vi.fn(),
    } as unknown as SettingsStoreService);
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      upsertMany: vi.fn(),
    } as unknown as ProfilesService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      upsertMany: vi.fn(),
    } as unknown as CaptureProfilesService);
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      upsertMany: vi.fn(),
    } as unknown as ReplayClipsService);

    await expect(service.importPortable("merge")).resolves.toEqual({
      ok: true,
      backupPath: null,
      error: null,
    });
    expect(cleanupRecordingStorage).toHaveBeenCalledTimes(1);
    await expect(service.importPortable("merge")).resolves.toEqual({
      ok: false,
      backupPath: null,
      error: "No import bundle has been previewed",
    });
  });

  it("clears machine-local paths from imported settings", () => {
    expect(
      sanitizeImportedSettings({
        ...createDefaultSettings(),
        poe1ClientTxtPath: "C:\\Games\\Path of Exile\\logs\\Client.txt",
        poe2ClientTxtPath: "C:\\Games\\Path of Exile 2\\logs\\Client.txt",
        recordingStoragePath: "D:\\Recordings",
      }),
    ).toMatchObject({
      poe1ClientTxtPath: null,
      poe2ClientTxtPath: null,
      recordingStoragePath: null,
    });
  });

  it("normalizes imported capture profile game and league settings", () => {
    const captureProfile = {
      ...createDefaultCaptureProfile({
        name: "PoE 2 Capture",
        game: "poe2",
      }),
      id: "capture-profile-poe2",
    };

    expect(
      sanitizeImportedSettings(
        {
          ...createDefaultSettings(),
          activeGame: "poe1",
          activeLeague: "Settlers",
          poe1SelectedLeague: "Settlers",
          poe2SelectedLeague: "Runes of Aldur",
          selectedCaptureProfileId: captureProfile.id,
          selectedCaptureProfileIdsByGame: {
            poe2: captureProfile.id,
          },
        },
        [captureProfile],
      ),
    ).toMatchObject({
      activeGame: "poe2",
      activeLeague: "Runes of Aldur",
      selectedCaptureProfileId: captureProfile.id,
      selectedCaptureProfileIdsByGame: {
        poe2: captureProfile.id,
      },
    });
  });

  it("repairs stale imported capture profile selections", () => {
    const captureProfile = {
      ...createDefaultCaptureProfile({
        name: "PoE 2 Capture",
        game: "poe2",
      }),
      id: "capture-profile-poe2",
    };

    expect(
      sanitizeImportedSettings(
        {
          ...createDefaultSettings(),
          activeGame: "poe1",
          activeLeague: "Settlers",
          poe1SelectedLeague: "Settlers",
          poe2SelectedLeague: "Runes of Aldur",
          selectedCaptureProfileId: "missing-capture-profile",
          selectedCaptureProfileIdsByGame: {
            poe1: "stale-poe1",
            poe2: captureProfile.id,
          },
        },
        [captureProfile],
      ),
    ).toMatchObject({
      activeGame: "poe2",
      activeLeague: "Runes of Aldur",
      selectedCaptureProfileId: captureProfile.id,
      selectedCaptureProfileIdsByGame: {
        poe2: captureProfile.id,
      },
    });
  });

  it("restores imported selection from per-game capture profile memory", () => {
    const captureProfile = {
      ...createDefaultCaptureProfile({
        name: "PoE 2 Capture",
        game: "poe2",
      }),
      id: "capture-profile-poe2",
    };

    expect(
      sanitizeImportedSettings(
        {
          ...createDefaultSettings(),
          activeGame: "poe2",
          activeLeague: "Runes of Aldur",
          poe2SelectedLeague: "Runes of Aldur",
          selectedCaptureProfileId: null,
          selectedCaptureProfileIdsByGame: {
            poe2: captureProfile.id,
          },
        },
        [captureProfile],
      ),
    ).toMatchObject({
      activeGame: "poe2",
      activeLeague: "Runes of Aldur",
      selectedCaptureProfileId: captureProfile.id,
      selectedCaptureProfileIdsByGame: {
        poe2: captureProfile.id,
      },
    });
  });

  it("ignores stale imported per-game capture profile memory without a selected profile", () => {
    expect(
      sanitizeImportedSettings(
        {
          ...createDefaultSettings(),
          activeGame: "poe2",
          activeLeague: "Runes of Aldur",
          poe2SelectedLeague: "Runes of Aldur",
          selectedCaptureProfileId: null,
          selectedCaptureProfileIdsByGame: {
            poe2: "missing-capture-profile",
          },
        },
        [],
      ),
    ).toMatchObject({
      activeGame: "poe2",
      activeLeague: "Runes of Aldur",
      selectedCaptureProfileId: null,
      selectedCaptureProfileIdsByGame: {},
    });
  });

  it("resets stale imported capture profile selections when no capture profiles are imported", () => {
    expect(
      sanitizeImportedSettings(
        {
          ...createDefaultSettings(),
          activeGame: "poe2",
          activeLeague: "Runes of Aldur",
          poe2SelectedLeague: "Runes of Aldur",
          selectedCaptureProfileId: "missing-capture-profile",
          selectedCaptureProfileIdsByGame: {
            poe2: "missing-capture-profile",
          },
        },
        [],
      ),
    ).toMatchObject({
      activeGame: "poe2",
      activeLeague: "Runes of Aldur",
      selectedCaptureProfileId: null,
      selectedCaptureProfileIdsByGame: {},
    });
  });

  it("keeps a safe failure result when a replace import service fails", async () => {
    const bundle = createBundle();
    const service = new StateTransferService();
    setPendingBundle(service, bundle);
    vi.spyOn(DatabaseService, "getInstance").mockReturnValue(database);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: trustedRoot,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ProfilesService, "getInstance").mockReturnValue({
      replaceAll: () => {
        throw new Error(
          "failed while reading C:\\Users\\seb\\Videos\\bad-backup.json",
        );
      },
    } as unknown as ProfilesService);

    await expect(service.importPortable("replace")).resolves.toEqual({
      ok: false,
      backupPath: null,
      error: "failed while reading [path]",
    });
  });

  it("keeps a safe failure result if the pending bundle disappears during import", async () => {
    const bundle = createBundle();
    const service = new StateTransferService();
    setPendingBundle(service, bundle);
    vi.spyOn(DatabaseService, "getInstance").mockReturnValue({
      transaction: (work: () => unknown) => {
        (
          service as unknown as { pendingImportBundle: StateBundle | null }
        ).pendingImportBundle = null;
        return work();
      },
    } as unknown as DatabaseService);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => createDefaultSettings(),
    } as unknown as SettingsStoreService);

    await expect(service.importPortable("merge")).resolves.toEqual({
      ok: false,
      backupPath: null,
      error: "No import bundle has been previewed",
    });
  });

  it("registers IPC handlers with validation", async () => {
    const { handle, handlers } = mockIpcMainHandlers();
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    electronMocks.showSaveDialog.mockResolvedValue({
      canceled: true,
    });
    const service = new StateTransferService();

    await expect(
      handlers.get(StateTransferChannel.ExportPortable)?.({}),
    ).resolves.toEqual({
      ok: false,
      path: null,
      error: null,
    });
    await expect(
      handlers.get(StateTransferChannel.PreviewImport)?.({}),
    ).resolves.toBeNull();
    await expect(
      handlers.get(StateTransferChannel.ImportPortable)?.({}, "replace"),
    ).resolves.toEqual({
      ok: false,
      backupPath: null,
      error: "No import bundle has been previewed",
    });
    expect(
      handlers.get(StateTransferChannel.ImportPortable)?.({}, "invalid-mode"),
    ).toMatchObject({
      ok: false,
      error: expect.any(String),
    });
    expect(service).toBeInstanceOf(StateTransferService);
    expect(handle).toHaveBeenCalledTimes(3);
  });

  it("returns a validation result when IPC preview import fails", async () => {
    const { handlers } = mockIpcMainHandlers();
    vi.spyOn(fsPromises, "readFile").mockResolvedValue("{not json");
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [join(directory, "bad-backup.json")],
    });
    electronMocks.showSaveDialog.mockResolvedValue({
      canceled: true,
    });
    new StateTransferService();

    await expect(
      handlers.get(StateTransferChannel.PreviewImport)?.({}),
    ).resolves.toEqual({
      ok: false,
      error: expect.any(String),
    });
  });
});
