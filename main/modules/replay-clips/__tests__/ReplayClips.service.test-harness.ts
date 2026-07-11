import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, type Mock, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import { createDefaultSettings } from "~/types";
import { ReplayClipPreviewService } from "../ReplayClips.preview";
import { ReplayClipsRepository } from "../ReplayClips.repository";
import { ReplayClipsService } from "../ReplayClips.service";

interface ReplayClipsElectronMocks {
  getAllWindows: ReturnType<typeof vi.fn>;
  getPath: ReturnType<typeof vi.fn>;
  openPath: ReturnType<typeof vi.fn>;
  showItemInFolder: ReturnType<typeof vi.fn>;
}

let database: DatabaseService;
let repository: ReplayClipsRepository;
let service: ReplayClipsService;
let root: string;
let outsideRoot: string;
let openPath: Mock<(path: string) => Promise<string>>;
let send: Mock<(channel: string, payload: unknown) => void>;
let showItemInFolder: Mock<(path: string) => void>;

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function setupReplayClipsServiceTestHarness(
  electronMocks: ReplayClipsElectronMocks,
): void {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "hinekora-replay-service-root-"));
    outsideRoot = mkdtempSync(
      join(tmpdir(), "hinekora-replay-service-outside-"),
    );
    database = DatabaseService.getInstance(":memory:");
    repository = new ReplayClipsRepository(database);
    openPath = vi.fn<(path: string) => Promise<string>>().mockResolvedValue("");
    send = vi.fn<(channel: string, payload: unknown) => void>();
    showItemInFolder = vi.fn<(path: string) => void>();
    const webContents = { id: 100, send };
    registerIpcWindowRole(webContents, WindowName.ClipPreviewOverlay);
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents },
    ]);
    electronMocks.getPath.mockReturnValue(join(root, "videos"));
    electronMocks.openPath.mockImplementation(openPath);
    electronMocks.showItemInFolder.mockImplementation(showItemInFolder);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ReplayClipPreviewService.prototype, "prepare").mockResolvedValue(
      null,
    );
    vi.spyOn(ReplayClipPreviewService.prototype, "remove").mockResolvedValue();
    service = new ReplayClipsService();
  });

  afterEach(() => {
    electronMocks.getAllWindows.mockReset();
    electronMocks.getPath.mockReset();
    electronMocks.openPath.mockReset();
    electronMocks.showItemInFolder.mockReset();
    vi.restoreAllMocks();
    clearIpcWindowRolesForTests();
    database.close();
    DatabaseService.resetForTests();
    rmSync(root, { force: true, recursive: true });
    rmSync(outsideRoot, { force: true, recursive: true });
  });
}

export type { ReplayClipsElectronMocks };
export {
  createDeferred,
  database,
  openPath,
  outsideRoot,
  repository,
  root,
  send,
  service,
  setupReplayClipsServiceTestHarness,
  showItemInFolder,
};
