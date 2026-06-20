import { existsSync, mkdtempSync, rmSync } from "node:fs";
import fsPromises from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { ProfilesService } from "~/main/modules/profiles";
import { ReplayClipsService } from "~/main/modules/replay-clips";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createReplayClip } from "~/main/test/factories/replayClip";
import { mockIpcMainHandlers } from "~/main/test/ipc";

import { createDefaultSettings, type StateBundle } from "~/types";
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

function createBundle(overrides: Partial<StateBundle> = {}): StateBundle {
  return {
    format: "hinekora-state",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: "0.0.0",
    sections: {
      profiles: [],
      settings: createDefaultSettings(),
      replayClips: [],
    },
    ...overrides,
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
    database.kysely.insertInto("settings").values({
      key: "activeGame",
      value_json: JSON.stringify("poe2"),
      updated_at: new Date().toISOString(),
    }),
  );
  electronMocks.getPath.mockReturnValue(join(directory, "videos"));
  electronMocks.getVersion.mockReturnValue("1.2.3");
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
      replayClipCount: 1,
      settingsIncluded: true,
    });
  });

  it("rejects import when no bundle has been previewed", () => {
    const service = new StateTransferService();

    expect(service.importPortable("replace")).toEqual({
      ok: false,
      backupPath: null,
      error: "No import bundle has been previewed",
    });
  });

  it("backs up the database and sanitizes imported replay paths against the pre-import storage root", () => {
    const replaceAllProfiles = vi.fn();
    const replaceSettings = vi.fn();
    const replaceAllReplayClips = vi.fn();
    const importedClipPath = join(importedRoot, "2026-06-12_10-30-00.mp4");
    const bundle = createBundle({
      sections: {
        profiles: [],
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
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      replaceAll: replaceAllReplayClips,
    } as unknown as ReplayClipsService);
    const result = service.importPortable("replace");

    expect(result.ok).toBe(true);
    expect(result.backupPath).toEqual(expect.stringMatching(/\.sqlite$/));
    expect(result.backupPath && existsSync(result.backupPath)).toBe(true);
    expect(replaceSettings).toHaveBeenCalledWith(
      sanitizeImportedSettings(bundle.sections.settings),
    );
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

  it("replaces imported state without a backup for in-memory databases", () => {
    const memoryDatabase = new DatabaseService(":memory:");
    const replaceAllProfiles = vi.fn();
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
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      replaceAll: replaceAllReplayClips,
    } as unknown as ReplayClipsService);

    try {
      expect(service.importPortable("replace")).toEqual({
        ok: true,
        backupPath: null,
        error: null,
      });
      expect(replaceAllProfiles).toHaveBeenCalledWith([]);
      expect(replaceSettings).toHaveBeenCalledWith(
        sanitizeImportedSettings(bundle.sections.settings),
      );
      expect(replaceAllReplayClips).toHaveBeenCalledWith(
        [],
        expect.any(String),
      );
    } finally {
      memoryDatabase.close();
    }
  });

  it("merges imported state without creating a database backup", () => {
    const upsertProfiles = vi.fn();
    const updateSettings = vi.fn();
    const upsertReplayClips = vi.fn();
    const clipPath = join(trustedRoot, "2026-06-12_10-30-00.mp4");
    const bundle = createBundle({
      sections: {
        profiles: [],
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
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      upsertMany: upsertReplayClips,
    } as unknown as ReplayClipsService);

    expect(service.importPortable("merge")).toEqual({
      ok: true,
      backupPath: null,
      error: null,
    });
    expect(upsertProfiles).toHaveBeenCalledWith([]);
    expect(updateSettings).toHaveBeenCalledWith(
      sanitizeImportedSettings(bundle.sections.settings),
    );
    expect(upsertReplayClips).toHaveBeenCalledWith(
      [expect.objectContaining({ processedClipPath: clipPath })],
      trustedRoot,
    );
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

  it("keeps a safe failure result when a replace import service fails", () => {
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

    expect(service.importPortable("replace")).toEqual({
      ok: false,
      backupPath: null,
      error: "failed while reading [path]",
    });
  });

  it("keeps a safe failure result if the pending bundle disappears during import", () => {
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

    expect(service.importPortable("merge")).toEqual({
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
    expect(
      handlers.get(StateTransferChannel.ImportPortable)?.({}, "replace"),
    ).toEqual({
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
