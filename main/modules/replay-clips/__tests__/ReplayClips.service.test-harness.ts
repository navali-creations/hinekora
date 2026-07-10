import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { fetchLocalFileForTests } from "~/main/test/local-file-fetch";
import { clearIpcWindowRolesForTests } from "~/main/utils/ipc-window-roles";

import { createDefaultSettings } from "~/types";
import { ReplayClipsRepository } from "../ReplayClips.repository";
import { ReplayClipsService } from "../ReplayClips.service";

interface ReplayClipsElectronMocks {
  getAllWindows: ReturnType<typeof vi.fn>;
  getPath: ReturnType<typeof vi.fn>;
  isProtocolHandled: ReturnType<typeof vi.fn>;
  netFetch: ReturnType<typeof vi.fn>;
  openPath: ReturnType<typeof vi.fn>;
  protocolHandle: ReturnType<typeof vi.fn>;
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
let activeElectronMocks: ReplayClipsElectronMocks;

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function getReplayMediaProtocolHandler(): (
  request: Request,
) => Promise<Response> {
  const protocolHandler = activeElectronMocks.protocolHandle.mock
    .calls[0]?.[1] as ((request: Request) => Promise<Response>) | undefined;
  expect(protocolHandler).toBeDefined();

  return protocolHandler as (request: Request) => Promise<Response>;
}

function setupReplayClipsServiceTestHarness(
  electronMocks: ReplayClipsElectronMocks,
): void {
  activeElectronMocks = electronMocks;
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
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: { send } },
    ]);
    electronMocks.getPath.mockReturnValue(join(root, "videos"));
    electronMocks.isProtocolHandled.mockReturnValue(false);
    electronMocks.netFetch.mockReset();
    electronMocks.netFetch.mockImplementation(fetchLocalFileForTests);
    electronMocks.openPath.mockImplementation(openPath);
    electronMocks.showItemInFolder.mockImplementation(showItemInFolder);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    service = new ReplayClipsService();
  });

  afterEach(() => {
    electronMocks.getAllWindows.mockReset();
    electronMocks.getPath.mockReset();
    electronMocks.isProtocolHandled.mockReset();
    electronMocks.openPath.mockReset();
    electronMocks.protocolHandle.mockReset();
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
  getReplayMediaProtocolHandler,
  openPath,
  outsideRoot,
  repository,
  root,
  send,
  service,
  setupReplayClipsServiceTestHarness,
  showItemInFolder,
};
