import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { createReplayClip } from "~/main/test/factories/replayClip";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import * as FileClipboard from "~/main/utils/file-clipboard";
import {
  clearIpcWindowRolesForTests,
  registerIpcWindowRole,
} from "~/main/utils/ipc-window-roles";

import { createDefaultSettings } from "~/types";
import { ReplayClipsChannel } from "../ReplayClips.channels";
import { ReplayClipsRepository } from "../ReplayClips.repository";
import { ReplayClipsService } from "../ReplayClips.service";

const electronMocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
  getPath: vi.fn(),
  isProtocolHandled: vi.fn(),
  openPath: vi.fn(),
  protocolHandle: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: electronMocks.getPath,
  },
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
  protocol: {
    handle: electronMocks.protocolHandle,
    isProtocolHandled: electronMocks.isProtocolHandled,
  },
  shell: {
    openPath: electronMocks.openPath,
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

let database: DatabaseService;
let repository: ReplayClipsRepository;
let service: ReplayClipsService;
let root: string;
let outsideRoot: string;
let openPath: Mock<(path: string) => Promise<string>>;
let send: Mock<(channel: string, payload: unknown) => void>;
let showItemInFolder: Mock<(path: string) => void>;

function getReplayMediaProtocolHandler(): (request: Request) => Response {
  const protocolHandler = electronMocks.protocolHandle.mock.calls[0]?.[1] as
    | ((request: Request) => Response)
    | undefined;
  expect(protocolHandler).toBeDefined();

  return protocolHandler as (request: Request) => Response;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hinekora-replay-service-root-"));
  outsideRoot = mkdtempSync(join(tmpdir(), "hinekora-replay-service-outside-"));
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

describe("ReplayClipsService file actions", () => {
  it("creates and reuses the singleton instance", () => {
    ReplayClipsService.resetForTests();

    const first = ReplayClipsService.getInstance();
    const second = ReplayClipsService.getInstance();

    expect(first).toBe(second);
    ReplayClipsService.resetForTests();
  });

  it("lists stored clip file sizes", () => {
    const path = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    writeFileSync(path, "clip-data");
    repository.upsert(
      createReplayClip({ originalObsPath: path, processedClipPath: path }),
    );

    expect(service.list()).toEqual([
      expect.objectContaining({
        processedClipPath: resolve(path),
        sizeBytes: 9,
      }),
    ]);
  });

  it("returns clip details with app media URLs", () => {
    const path = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    writeFileSync(path, "clip-data");
    repository.upsert(
      createReplayClip({
        id: "clip-1",
        originalObsPath: path,
        processedClipPath: path,
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "missing-media",
        originalObsPath: join(root, "missing.mp4"),
        processedClipPath: null,
      }),
    );

    expect(service.getClip("clip-1")).toEqual({
      clip: expect.objectContaining({ id: "clip-1", sizeBytes: 9 }),
      durationSeconds: null,
      mediaUrl: "hinekora-media://replay-clip/clip-1",
    });
    expect(service.getClip("missing-media")).toEqual({
      clip: expect.objectContaining({ id: "missing-media", sizeBytes: 0 }),
      durationSeconds: null,
      mediaUrl: null,
    });
    expect(service.getClip("missing")).toBeNull();
  });

  it("renames replay clip files and publishes refreshed metadata", async () => {
    const directory = join(root, "Death Clips");
    mkdirSync(directory);
    const path = join(directory, "clip-1.mp4");
    writeFileSync(path, "clip-data");
    repository.upsert(
      createReplayClip({
        id: "clip-1",
        originalObsPath: path,
        processedClipPath: path,
      }),
    );

    await expect(
      service.updateClipFile({ id: "clip-1", name: "Boss: kill" }),
    ).resolves.toEqual({
      detail: {
        clip: expect.objectContaining({
          id: "clip-1",
          originalObsPath: resolve(join(directory, "Boss kill.mp4")),
          processedClipPath: resolve(join(directory, "Boss kill.mp4")),
          sizeBytes: 9,
        }),
        durationSeconds: null,
        mediaUrl: "hinekora-media://replay-clip/clip-1",
      },
      error: null,
      ok: true,
    });
    expect(existsSync(path)).toBe(false);
    expect(existsSync(join(directory, "Boss kill.mp4"))).toBe(true);
    expect(send).toHaveBeenCalledWith(
      ReplayClipsChannel.StatusChanged,
      expect.objectContaining({
        id: "clip-1",
        processedClipPath: resolve(join(directory, "Boss kill.mp4")),
      }),
    );
  });

  it("lists paged replay details for the editor media rail", () => {
    const path = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    writeFileSync(path, "clip-data");
    const presentClip = createReplayClip({
      id: "clip-1",
      kind: "death",
      originalObsPath: path,
      processedClipPath: path,
      sizeBytes: 9,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      createdAt: "2026-06-12T10:00:00.000Z",
    });
    repository.upsert(presentClip);
    const missingMediaClip = createReplayClip({
      id: "missing-media",
      kind: "death",
      originalObsPath: join(root, "missing.mp4"),
      processedClipPath: null,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      createdAt: "2026-06-12T11:00:00.000Z",
    });
    repository.upsert(missingMediaClip);
    const staleSizeClip = createReplayClip({
      id: "stale-size",
      kind: "death",
      originalObsPath: join(root, "stale-size.mp4"),
      processedClipPath: null,
      sizeBytes: 4096,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      createdAt: "2026-06-12T12:00:00.000Z",
    });
    repository.upsert(staleSizeClip);

    const editorPage = service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 10,
    });

    expect(editorPage).toEqual({
      items: [
        {
          clip: expect.objectContaining({ id: "clip-1", sizeBytes: 9 }),
          durationSeconds: null,
          mediaUrl: "hinekora-media://replay-clip/clip-1",
        },
      ],
      totalCount: 1,
    });
    expect(
      service.listEditorReplayDetailPage({
        game: "poe2",
        kind: "death",
        league: "Standard",
        pageIndex: 0,
        pageSize: 10,
      }).items,
    ).toHaveLength(1);
    expect(
      service.listEditorReplayDetailPage({
        createdAfter: "2026-06-12T10:30:00.000Z",
        excludeIds: [presentClip.id],
        includeIds: [presentClip.id, missingMediaClip.id],
        kind: "death",
        pageIndex: 0,
        pageSize: 10,
      }),
    ).toEqual({ items: [], totalCount: 0 });
    expect(repository.get("missing-media")?.sizeBytes).toBe(0);
    expect(repository.get("clip-1")?.sizeBytes).toBe(9);
    expect(repository.get("stale-size")?.sizeBytes).toBe(0);
  });

  it("fills editor replay pages by replacing stale rows", () => {
    for (let index = 0; index < 6; index += 1) {
      repository.upsert(
        createReplayClip({
          id: `stale-${index}`,
          kind: "death",
          processedClipPath: join(root, `stale-${index}.mp4`),
          sizeBytes: 4096,
          createdAt: `2026-06-12T12:0${5 - index}:00.000Z`,
        }),
      );
    }
    const availableAlphaPath = join(root, "2026-06-12_10-01-00-death-10s.mp4");
    const availableBetaPath = join(root, "2026-06-12_10-00-00-death-10s.mp4");
    writeFileSync(availableAlphaPath, "alpha");
    writeFileSync(availableBetaPath, "beta");
    repository.upsert(
      createReplayClip({
        id: "available-alpha",
        kind: "death",
        processedClipPath: availableAlphaPath,
        sizeBytes: 5,
        createdAt: "2026-06-12T10:01:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "available-beta",
        kind: "death",
        processedClipPath: availableBetaPath,
        sizeBytes: 4,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );
    const listLibraryPageSpy = vi.spyOn(
      ReplayClipsRepository.prototype,
      "listLibraryPage",
    );

    const page = service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 5,
    });
    const nextPage = service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 1,
      pageSize: 5,
    });

    expect(page.items.map((detail) => detail.clip.id)).toEqual([
      "available-alpha",
      "available-beta",
    ]);
    expect(page.totalCount).toBe(2);
    expect(nextPage.items).toEqual([]);
    expect(nextPage.totalCount).toBe(2);
    expect(listLibraryPageSpy).toHaveBeenCalledTimes(3);
    expect(listLibraryPageSpy).toHaveBeenNthCalledWith(1, {
      filter: {
        kind: "death",
        mediaPathOnly: true,
        positiveMediaOnly: true,
      },
      pageIndex: 0,
      pageSize: 5,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
    expect(listLibraryPageSpy).toHaveBeenNthCalledWith(2, {
      filter: {
        kind: "death",
        mediaPathOnly: true,
        positiveMediaOnly: true,
      },
      pageIndex: 0,
      pageSize: 5,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
    expect(listLibraryPageSpy).toHaveBeenNthCalledWith(3, {
      filter: {
        kind: "death",
        mediaPathOnly: true,
        positiveMediaOnly: true,
      },
      pageIndex: 1,
      pageSize: 5,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
    expect(repository.get("stale-0")?.sizeBytes).toBe(0);
    expect(repository.get("stale-4")?.sizeBytes).toBe(0);
    expect(repository.get("stale-5")?.sizeBytes).toBe(0);
  });

  it("stops editor replay pages at the requested page size", () => {
    const availablePath = join(root, "2026-06-12_10-00-00-death-10s.mp4");
    writeFileSync(availablePath, "available");
    repository.upsert(
      createReplayClip({
        id: "available-page-size",
        kind: "death",
        processedClipPath: availablePath,
        sizeBytes: 9,
      }),
    );

    const page = service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 1,
    });

    expect(page.items.map((detail) => detail.clip.id)).toEqual([
      "available-page-size",
    ]);
    expect(page.totalCount).toBe(1);
  });

  it("skips already collected editor candidates after repairing a full page", () => {
    repository.upsert(
      createReplayClip({
        id: "stale-front",
        kind: "death",
        processedClipPath: join(root, "stale-front.mp4"),
        sizeBytes: 4096,
        createdAt: "2026-06-12T12:00:00.000Z",
      }),
    );
    const availablePath = join(root, "2026-06-12_10-00-00-death-10s.mp4");
    writeFileSync(availablePath, "available");
    repository.upsert(
      createReplayClip({
        id: "available-after-repair",
        kind: "death",
        processedClipPath: availablePath,
        sizeBytes: 9,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );

    const page = service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 2,
    });

    expect(page.items.map((detail) => detail.clip.id)).toEqual([
      "available-after-repair",
    ]);
    expect(page.totalCount).toBe(1);
    expect(repository.get("stale-front")?.sizeBytes).toBe(0);
  });

  it("keeps editor replay pages from landing empty after many stale rows", () => {
    for (let index = 0; index < 55; index += 1) {
      repository.upsert(
        createReplayClip({
          id: `stale-bulk-${index}`,
          kind: "death",
          processedClipPath: join(root, `stale-bulk-${index}.mp4`),
          sizeBytes: 4096,
          createdAt: new Date(
            Date.parse("2026-06-12T12:00:00.000Z") - index * 1_000,
          ).toISOString(),
        }),
      );
    }
    const availablePath = join(root, "2026-06-12_10-00-00-death-10s.mp4");
    writeFileSync(availablePath, "available");
    repository.upsert(
      createReplayClip({
        id: "available-after-stale",
        kind: "death",
        processedClipPath: availablePath,
        sizeBytes: 9,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );

    const page = service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 5,
    });

    expect(page.items.map((detail) => detail.clip.id)).toEqual([
      "available-after-stale",
    ]);
    expect(page.totalCount).toBe(1);
    expect(repository.get("stale-bulk-0")?.sizeBytes).toBe(0);
    expect(repository.get("stale-bulk-54")?.sizeBytes).toBe(0);
  });

  it("continues bounded editor replay repair after the validation window", () => {
    for (let index = 0; index < 501; index += 1) {
      repository.upsert(
        createReplayClip({
          id: `stale-window-${index}`,
          kind: "death",
          processedClipPath: join(root, `stale-window-${index}.mp4`),
          sizeBytes: 4096,
          createdAt: new Date(
            Date.parse("2026-06-12T12:00:00.000Z") - index * 1_000,
          ).toISOString(),
        }),
      );
    }
    const availablePath = join(root, "2026-06-12_10-00-00-death-10s.mp4");
    writeFileSync(availablePath, "available");
    repository.upsert(
      createReplayClip({
        id: "available-after-validation-window",
        kind: "death",
        processedClipPath: availablePath,
        sizeBytes: 9,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );

    const firstPage = service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 7,
    });
    const repairedPage = service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 0,
      pageSize: 7,
    });

    expect(firstPage.items).toEqual([]);
    expect(firstPage.totalCount).toBe(2);
    expect(repairedPage.items.map((detail) => detail.clip.id)).toEqual([
      "available-after-validation-window",
    ]);
    expect(repairedPage.totalCount).toBe(1);
    expect(repository.get("stale-window-0")?.sizeBytes).toBe(0);
    expect(repository.get("stale-window-499")?.sizeBytes).toBe(0);
    expect(repository.get("stale-window-500")?.sizeBytes).toBe(0);
  });

  it("does not scan from the first editor replay page for high page indexes", () => {
    for (let index = 0; index < 10; index += 1) {
      repository.upsert(
        createReplayClip({
          id: `positive-candidate-${index}`,
          kind: "death",
          processedClipPath: join(root, `positive-candidate-${index}.mp4`),
          sizeBytes: 4096,
          createdAt: new Date(
            Date.parse("2026-06-12T12:00:00.000Z") - index * 1_000,
          ).toISOString(),
        }),
      );
    }
    const listLibraryPageSpy = vi.spyOn(
      ReplayClipsRepository.prototype,
      "listLibraryPage",
    );

    const page = service.listEditorReplayDetailPage({
      kind: "death",
      pageIndex: 1000,
      pageSize: 5,
    });

    expect(page).toEqual({ items: [], totalCount: 10 });
    expect(listLibraryPageSpy).toHaveBeenCalledTimes(1);
    expect(listLibraryPageSpy).toHaveBeenCalledWith({
      filter: {
        kind: "death",
        mediaPathOnly: true,
        positiveMediaOnly: true,
      },
      pageIndex: 1000,
      pageSize: 5,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
  });

  it("delegates clip library filtering to the repository", () => {
    repository.upsert(
      createReplayClip({ id: "death-clip", kind: "death", sourceGame: "poe2" }),
    );
    repository.upsert(
      createReplayClip({
        id: "manual-clip",
        kind: "manual",
        sourceGame: "poe2",
      }),
    );

    expect(service.list({ game: "poe2", kind: "manual" })).toEqual([
      expect.objectContaining({ id: "manual-clip", kind: "manual" }),
    ]);
  });

  it("returns paged clip library data sorted in the main process", () => {
    const smallPath = join(root, "2026-06-12_10-30-00-death-10s.mp4");
    const largePath = join(root, "2026-06-12_10-31-00-death-10s.mp4");
    writeFileSync(smallPath, "small");
    writeFileSync(largePath, "larger-clip");
    repository.upsert(
      createReplayClip({
        id: "small",
        kind: "death",
        sourceGame: "poe2",
        sourceLeague: "Standard",
        processedClipPath: smallPath,
        createdAt: "2026-06-12T10:30:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "large",
        kind: "death",
        sourceGame: "poe2",
        sourceLeague: "Hardcore",
        processedClipPath: largePath,
        createdAt: "2026-06-12T10:31:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "manual",
        kind: "manual",
        sourceGame: "poe2",
        sourceLeague: "Standard",
      }),
    );

    expect(
      service.listLibrary({
        game: "poe2",
        kind: "death",
        pageIndex: 0,
        pageSize: 1,
        sortBy: "sizeBytes",
        sortDirection: "desc",
      }),
    ).toMatchObject({
      availableLeagues: ["Hardcore", "Standard"],
      pageCount: 2,
      pageIndex: 0,
      pageSize: 1,
      totalCount: 2,
      items: [expect.objectContaining({ id: "large", sizeBytes: 11 })],
    });
  });

  it("refreshes stale clip library sizes when media files are missing", () => {
    const missingPath = join(root, "2026-06-12_10-32-00-death-10s.mp4");
    repository.upsert(
      createReplayClip({
        id: "stale-size",
        kind: "death",
        processedClipPath: missingPath,
        sizeBytes: 4096,
      }),
    );

    const page = service.listLibrary({ kind: "death" });

    expect(page.items).toEqual([
      expect.objectContaining({ id: "stale-size", sizeBytes: 0 }),
    ]);
    expect(repository.get("stale-size")?.sizeBytes).toBe(0);
  });

  it("refreshes clip size from available media paths while ignoring stale alternates", () => {
    const availablePath = join(root, "2026-06-12_10-33-00-death-10s.mp4");
    const missingPath = join(root, "2026-06-12_10-34-00-death-10s.mp4");
    writeFileSync(availablePath, "available");
    repository.upsert(
      createReplayClip({
        id: "partially-stale-size",
        kind: "death",
        originalObsPath: missingPath,
        processedClipPath: availablePath,
        sizeBytes: 0,
      }),
    );

    const page = service.listLibrary({ kind: "death" });

    expect(page.items).toEqual([
      expect.objectContaining({
        id: "partially-stale-size",
        sizeBytes: 9,
      }),
    ]);
    expect(repository.get("partially-stale-size")?.sizeBytes).toBe(9);
  });

  it("sorts clip library rows by display fields and applies query defaults", () => {
    const alphaPath = join(root, "alpha-death.mp4");
    const betaPath = join(root, "beta-death.mp4");
    const missingPath = join(root, "missing-death.mp4");
    writeFileSync(alphaPath, "alpha");
    writeFileSync(betaPath, "beta");
    repository.upsert(
      createReplayClip({
        id: "alpha",
        kind: "death",
        sourceGame: "poe1",
        sourceLeague: "Alpha",
        processedClipPath: alphaPath,
        targetDurationSeconds: 30,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "beta",
        kind: "death",
        sourceGame: "poe1",
        sourceLeague: "Beta",
        processedClipPath: betaPath,
        targetDurationSeconds: 5,
        createdAt: "2026-06-12T10:01:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "missing-path",
        kind: "death",
        sourceGame: "poe1",
        sourceLeague: "Beta",
        processedClipPath: missingPath,
        targetDurationSeconds: 20,
        createdAt: "2026-06-12T10:02:00.000Z",
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "no-path",
        kind: "death",
        sourceGame: "poe1",
        sourceLeague: "Gamma",
        processedClipPath: null,
        originalObsPath: null,
        targetDurationSeconds: 10,
        createdAt: "2026-06-12T10:03:00.000Z",
      }),
    );

    expect(service.listLibrary()).toMatchObject({
      pageIndex: 0,
      pageSize: 20,
      sortBy: "createdAt",
      sortDirection: "desc",
      totalCount: 4,
    });
    expect(
      service
        .listLibrary({ sortBy: "name", sortDirection: "asc" })
        .items.map((clip) => clip.id),
    ).toEqual(["no-path", "alpha", "beta", "missing-path"]);
    expect(
      service
        .listLibrary({ sortBy: "sourceLeague", sortDirection: "asc" })
        .items.map((clip) => clip.id),
    ).toEqual(["alpha", "missing-path", "beta", "no-path"]);
    expect(
      service
        .listLibrary({
          sortBy: "targetDurationSeconds",
          sortDirection: "asc",
        })
        .items.map((clip) => clip.id),
    ).toEqual(["beta", "no-path", "missing-path", "alpha"]);
    expect(
      service
        .listLibrary({ sortBy: "createdAt", sortDirection: "asc" })
        .items.map((clip) => clip.id),
    ).toEqual(["alpha", "beta", "missing-path", "no-path"]);
    expect(
      service.listLibrary({ league: "Alpha" }).items.map((clip) => clip.id),
    ).toEqual(["alpha"]);
  });

  it("returns a safe error when a clip is missing", async () => {
    await expect(service.openClip("missing")).resolves.toEqual({
      ok: false,
      error: "Clip file path is not available",
    });
    expect(service.revealClip("missing")).toEqual({
      ok: false,
      error: "Clip file path is not available",
    });
    await expect(service.deleteClip("missing")).resolves.toEqual({
      ok: false,
      error: "Clip was not found",
    });
  });

  it("skips existing media protocol handlers and logs setup failures", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    electronMocks.protocolHandle.mockClear();
    electronMocks.isProtocolHandled.mockReturnValue(true);
    new ReplayClipsService();
    expect(electronMocks.protocolHandle).not.toHaveBeenCalled();

    electronMocks.isProtocolHandled.mockImplementation(() => {
      throw new Error("protocol unavailable");
    });
    new ReplayClipsService();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "WARN [replay-clips] Replay media protocol setup failed",
      ),
      { error: "protocol unavailable" },
    );
  });

  it("opens only existing managed clip files", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(service.openClip("clip-1")).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(openPath).toHaveBeenCalledWith(resolve(path));
  });

  it("returns shell open failures without throwing", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    openPath.mockResolvedValue("No application is associated with this file");

    await expect(service.openClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "No application is associated with this file",
    });
  });

  it("blocks shell open for imported paths outside managed storage", async () => {
    const path = join(outsideRoot, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(service.openClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "Clip file path is not available",
    });
    expect(openPath).not.toHaveBeenCalled();
  });

  it("reveals only existing managed clip files", () => {
    const directory = join(root, "Hinekora-2026-06-12_10-30-00");
    const path = join(directory, "recording.mkv");
    mkdirSync(directory);
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    expect(service.revealClip("clip-1")).toEqual({ ok: true, error: null });
    expect(showItemInFolder).toHaveBeenCalledWith(resolve(path));
  });

  it("copies only existing managed clip files to the clipboard", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const copyFileToClipboard = vi
      .spyOn(FileClipboard, "copyFileToClipboard")
      .mockResolvedValue({ ok: true, error: null });

    await expect(service.copyClipToClipboard("clip-1")).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(copyFileToClipboard).toHaveBeenCalledWith(resolve(path));
  });

  it("renders selected trim ranges before copying clips to the clipboard", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(
      createReplayClip({
        durationSeconds: 51.6,
        processedClipPath: path,
        targetDurationSeconds: 52,
      }),
    );
    const copyFileToClipboard = vi
      .spyOn(FileClipboard, "copyFileToClipboard")
      .mockResolvedValue({ ok: true, error: null });
    const renderReplayClipQuickTrim = vi
      .spyOn(
        service as unknown as {
          renderReplayClipQuickTrim: (input: {
            outputPath: string;
            sourcePath: string;
            trim: { inSeconds: number; outSeconds: number };
          }) => Promise<void>;
        },
        "renderReplayClipQuickTrim",
      )
      .mockImplementation(async (input) => {
        writeFileSync(input.outputPath, "trimmed");
      });

    await expect(
      service.copyClipToClipboard({
        id: "clip-1",
        trim: { inSeconds: 14.76, outSeconds: 36.46 },
      }),
    ).resolves.toEqual({
      ok: true,
      error: null,
    });

    expect(renderReplayClipQuickTrim).toHaveBeenCalledWith({
      outputPath: expect.stringContaining("2026-06-12_10-30-00-"),
      sourcePath: resolve(path),
      trim: { inSeconds: 14.76, outSeconds: 36.46 },
    });
    const copiedPath = copyFileToClipboard.mock.calls[0]?.[0];
    expect(copiedPath).not.toBe(resolve(path));
    expect(readFileSync(copiedPath ?? "", "utf8")).toBe("trimmed");
  });

  it("returns safe errors when clip clipboard copy throws", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    vi.spyOn(FileClipboard, "copyFileToClipboard").mockRejectedValue(
      new Error("clipboard exploded"),
    );

    await expect(service.copyClipToClipboard("clip-1")).resolves.toEqual({
      ok: false,
      error: "clipboard exploded",
    });
  });

  it("blocks clipboard copy for imported paths outside managed storage", async () => {
    const path = join(outsideRoot, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const copyFileToClipboard = vi.spyOn(FileClipboard, "copyFileToClipboard");

    await expect(service.copyClipToClipboard("clip-1")).resolves.toEqual({
      ok: false,
      error: "Clip file path is not available",
    });
    expect(copyFileToClipboard).not.toHaveBeenCalled();
  });

  it("deletes the row but never unlinks unsafe imported paths", async () => {
    const path = join(outsideRoot, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(service.deleteClip("clip-1")).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(existsSync(path)).toBe(true);
    expect(repository.get("clip-1")).toBeNull();
  });

  it("deletes managed clip files and their database rows", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(service.deleteClip("clip-1")).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(existsSync(path)).toBe(false);
    expect(repository.get("clip-1")).toBeNull();
  });

  it("reports clip file cleanup failures after deleting database rows", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>();

      return {
        ...actual,
        unlink: vi.fn(async () => {
          throw new Error("unlink failed");
        }),
      };
    });

    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    let resetDynamicDatabase: () => void = () => {};
    try {
      const { DatabaseService: MockedDatabaseService } = await import(
        "~/main/modules/database"
      );
      resetDynamicDatabase = () => MockedDatabaseService.resetForTests();
      const { mockIpcMainHandlers: mockDynamicIpcMainHandlers } = await import(
        "~/main/test/ipc"
      );
      const { SettingsStoreService: MockedSettingsStoreService } = await import(
        "~/main/modules/settings-store"
      );
      const { ReplayClipsRepository: MockedReplayClipsRepository } =
        await import("../ReplayClips.repository");
      const { ReplayClipsService: MockedReplayClipsService } = await import(
        "../ReplayClips.service"
      );
      mockDynamicIpcMainHandlers();
      const mockedDatabase = MockedDatabaseService.getInstance(":memory:");
      const mockedRepository = new MockedReplayClipsRepository(mockedDatabase);
      vi.spyOn(MockedSettingsStoreService, "getInstance").mockReturnValue({
        get: () => ({
          ...createDefaultSettings(),
          recordingStoragePath: root,
        }),
      } as unknown as typeof MockedSettingsStoreService.prototype);
      mockedRepository.upsert(createReplayClip({ processedClipPath: path }));
      const mockedService = new MockedReplayClipsService();

      await expect(mockedService.deleteClip("clip-1")).resolves.toEqual({
        ok: true,
        error: null,
        cleanupError: "unlink failed",
      });
      expect(existsSync(path)).toBe(true);
      expect(mockedRepository.get("clip-1")).toBeNull();

      mockedRepository.upsert(createReplayClip({ processedClipPath: path }));
      await expect(mockedService.deleteManyClips(["clip-1"])).resolves.toEqual({
        ok: true,
        error: null,
        deletedIds: ["clip-1"],
        failed: [],
        cleanupErrors: [{ id: "clip-1", error: "unlink failed" }],
      });
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("node:fs/promises");
      vi.resetModules();
    }
  });

  it("deletes many clips with per-id failures", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(
      service.deleteManyClips(["clip-1", "missing"]),
    ).resolves.toEqual({
      ok: false,
      error: "Some clips could not be deleted",
      deletedIds: ["clip-1"],
      failed: [{ id: "missing", error: "Clip was not found" }],
    });
    expect(existsSync(path)).toBe(false);
  });

  it("deletes many clips without failures", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));

    await expect(service.deleteManyClips(["clip-1"])).resolves.toEqual({
      ok: true,
      error: null,
      deletedIds: ["clip-1"],
      failed: [],
    });
    expect(existsSync(path)).toBe(false);
  });

  it("uses a generic message when a bulk clip delete failure has no error", async () => {
    vi.spyOn(service, "deleteClip").mockResolvedValue({
      ok: false,
      error: null,
    });

    await expect(service.deleteManyClips(["clip-1"])).resolves.toEqual({
      ok: false,
      error: "Some clips could not be deleted",
      deletedIds: [],
      failed: [{ id: "clip-1", error: "Clip delete failed" }],
    });
  });

  it("sanitizes bulk-imported replay clips before persistence", () => {
    const safePath = join(root, "2026-06-12_10-30-00.mp4");
    const unsafePath = join(outsideRoot, "2026-06-12_10-30-00.mp4");

    service.replaceAll([
      createReplayClip({
        originalObsPath: unsafePath,
        processedClipPath: safePath,
      }),
    ]);

    expect(repository.get("clip-1")).toMatchObject({
      originalObsPath: null,
      processedClipPath: resolve(safePath),
      status: "ready",
    });

    service.upsertMany([
      createReplayClip({
        id: "clip-2",
        originalObsPath: unsafePath,
        processedClipPath: safePath,
      }),
    ]);
    expect(repository.get("clip-2")).toMatchObject({
      originalObsPath: null,
      processedClipPath: resolve(safePath),
    });
  });

  it("serves managed clip media ranges", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const protocolHandler = getReplayMediaProtocolHandler();

    const response = protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=1-3" },
      }),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 1-3/5");
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "ide",
    );
    expect(
      protocolHandler(
        new Request("hinekora-media://replay-clip/clip-1", {
          headers: { range: "bytes=0-0" },
        }),
      ).status,
    ).toBe(206);
  });

  it("serves run recording media ranges through the app media protocol", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      getRecordingMediaPath: () => path,
    } as unknown as RecordingStorageService);
    const protocolHandler = getReplayMediaProtocolHandler();

    const response = protocolHandler(
      new Request("hinekora-media://run-recording/recording-1", {
        headers: { range: "bytes=0-1" },
      }),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-1/5");
    await expect(response.text()).resolves.toBe("vi");
  });

  it("rejects invalid replay media requests", () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const protocolHandler = getReplayMediaProtocolHandler();

    expect(
      protocolHandler(new Request("hinekora-media://wrong-host/clip-1")).status,
    ).toBe(404);
    expect(
      protocolHandler(
        new Request("hinekora-media://replay-clip/clip-1", {
          headers: { range: "bytes=10-12" },
        }),
      ).status,
    ).toBe(416);
  });

  it("handles media helper branches for HEAD, suffix ranges, and content types", async () => {
    const path = join(root, "2026-06-12_10-30-00.mkv");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const protocolHandler = getReplayMediaProtocolHandler();

    const headResponse = protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1", { method: "HEAD" }),
    );
    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get("Content-Length")).toBe("5");
    expect(headResponse.headers.get("Content-Type")).toBe("video/x-matroska");

    const fullResponse = protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1"),
    );
    expect(fullResponse.status).toBe(200);
    expect(Buffer.from(await fullResponse.arrayBuffer()).toString()).toBe(
      "video",
    );

    const suffixResponse = protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=-2" },
      }),
    );
    expect(suffixResponse.status).toBe(206);
    expect(suffixResponse.headers.get("Content-Range")).toBe("bytes 3-4/5");
    expect(Buffer.from(await suffixResponse.arrayBuffer()).toString()).toBe(
      "eo",
    );

    const openEndedRangeResponse = protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1", {
        headers: { range: "bytes=2-" },
      }),
    );
    expect(openEndedRangeResponse.status).toBe(206);
    expect(openEndedRangeResponse.headers.get("Content-Range")).toBe(
      "bytes 2-4/5",
    );

    const headRangeResponse = protocolHandler(
      new Request("hinekora-media://replay-clip/clip-1", {
        method: "HEAD",
        headers: { range: "bytes=1-2" },
      }),
    );
    expect(headRangeResponse.status).toBe(206);
    expect(await headRangeResponse.text()).toBe("");

    expect(
      protocolHandler(
        new Request("hinekora-media://replay-clip/clip-1", {
          headers: { range: "bytes=-0" },
        }),
      ).status,
    ).toBe(416);
    expect(
      protocolHandler(
        new Request("hinekora-media://replay-clip/clip-1", {
          headers: { range: "bytes=-" },
        }),
      ).status,
    ).toBe(416);
    expect(
      protocolHandler(
        new Request("hinekora-media://replay-clip/clip-1", {
          headers: { range: "not a range" },
        }),
      ).status,
    ).toBe(416);
    expect(
      protocolHandler(
        new Request("hinekora-media://replay-clip/clip-1", {
          headers: { range: "bytes=3-2" },
        }),
      ).status,
    ).toBe(416);

    const movPath = join(root, "2026-06-12_10-31-00.mov");
    const webmPath = join(root, "2026-06-12_10-32-00.webm");
    const flvPath = join(root, "2026-06-12_10-33-00.flv");
    writeFileSync(movPath, "video");
    writeFileSync(webmPath, "video");
    writeFileSync(flvPath, "video");
    repository.upsert(
      createReplayClip({ id: "clip-mov", processedClipPath: movPath }),
    );
    repository.upsert(
      createReplayClip({ id: "clip-webm", processedClipPath: webmPath }),
    );
    repository.upsert(
      createReplayClip({ id: "clip-flv", processedClipPath: flvPath }),
    );
    expect(
      protocolHandler(
        new Request("hinekora-media://replay-clip/clip-mov"),
      ).headers.get("Content-Type"),
    ).toBe("video/quicktime");
    expect(
      protocolHandler(
        new Request("hinekora-media://replay-clip/clip-webm"),
      ).headers.get("Content-Type"),
    ).toBe("video/webm");
    expect(
      protocolHandler(
        new Request("hinekora-media://replay-clip/clip-flv"),
      ).headers.get("Content-Type"),
    ).toBe("application/octet-stream");
    expect(protocolHandler(new Request("https://example.test")).status).toBe(
      404,
    );
    expect(
      protocolHandler(
        new Request(`hinekora-media://replay-clip/${"x".repeat(129)}`),
      ).status,
    ).toBe(404);
  });

  it("returns media misses as bounded responses", () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    const protocolHandler = getReplayMediaProtocolHandler();

    expect(
      protocolHandler(new Request("hinekora-media://replay-clip/missing"))
        .status,
    ).toBe(404);
  });

  it("returns media read failures as bounded protocol responses", async () => {
    vi.resetModules();
    vi.doMock("../ReplayClips.media", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../ReplayClips.media")>();

      return {
        ...actual,
        createReplayClipMediaFileResponse: vi.fn(() => {
          throw new Error("read failed");
        }),
      };
    });

    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    let resetDynamicDatabase: () => void = () => {};
    try {
      const { DatabaseService: MockedDatabaseService } = await import(
        "~/main/modules/database"
      );
      resetDynamicDatabase = () => MockedDatabaseService.resetForTests();
      const { mockIpcMainHandlers: mockDynamicIpcMainHandlers } = await import(
        "~/main/test/ipc"
      );
      const { SettingsStoreService: MockedSettingsStoreService } = await import(
        "~/main/modules/settings-store"
      );
      const { ReplayClipsRepository: MockedReplayClipsRepository } =
        await import("../ReplayClips.repository");
      const { ReplayClipsService: MockedReplayClipsService } = await import(
        "../ReplayClips.service"
      );
      mockDynamicIpcMainHandlers();
      const mockedDatabase = MockedDatabaseService.getInstance(":memory:");
      const mockedRepository = new MockedReplayClipsRepository(mockedDatabase);
      vi.spyOn(MockedSettingsStoreService, "getInstance").mockReturnValue({
        get: () => ({
          ...createDefaultSettings(),
          recordingStoragePath: root,
        }),
      } as unknown as typeof MockedSettingsStoreService.prototype);
      mockedRepository.upsert(createReplayClip({ processedClipPath: path }));
      new MockedReplayClipsService();
      const protocolHandler = electronMocks.protocolHandle.mock.calls.at(
        -1,
      )?.[1] as ((request: Request) => Response) | undefined;

      expect(protocolHandler).toBeDefined();
      expect(
        protocolHandler?.(new Request("hinekora-media://replay-clip/clip-1"))
          .status,
      ).toBe(500);
    } finally {
      resetDynamicDatabase();
      vi.doUnmock("../ReplayClips.media");
      vi.resetModules();
    }
  });

  it("returns safe errors when shell or repository actions throw", async () => {
    const path = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(path, "video");
    repository.upsert(createReplayClip({ processedClipPath: path }));
    openPath.mockImplementation(() => {
      throw new Error("open failed");
    });
    showItemInFolder.mockImplementation(() => {
      throw new Error("reveal failed");
    });

    await expect(service.openClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "open failed",
    });
    expect(service.revealClip("clip-1")).toEqual({
      ok: false,
      error: "reveal failed",
    });

    vi.spyOn(ReplayClipsRepository.prototype, "delete").mockImplementation(
      () => {
        throw new Error("delete failed");
      },
    );
    const failingService = new ReplayClipsService();
    await expect(failingService.deleteClip("clip-1")).resolves.toEqual({
      ok: false,
      error: "delete failed",
    });
    expect(existsSync(path)).toBe(true);
    expect(repository.get("clip-1")).not.toBeNull();
  });

  it("continues when ready clip storage cleanup fails", async () => {
    const replayPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(replayPath, "video");
    const cleanup = vi.fn(() => {
      throw new Error("cleanup failed");
    });
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: true,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay: vi.fn().mockResolvedValue({
        ok: true,
        path: replayPath,
        error: null,
      }),
    } as unknown as ManagedRecorderService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup,
    } as unknown as RecordingStorageService);
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      showClipPreviewOverlay: vi.fn(),
    } as unknown as OverlayWindowsService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "cleanup-failure",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      processedClipPath: resolve(replayPath),
    });
    expect(cleanup).toHaveBeenCalledWith({
      protectedPaths: [resolve(replayPath), resolve(replayPath)],
    });
  });

  it("skips previews for failed clips and destroyed windows", async () => {
    const showClipPreviewOverlay = vi.fn();
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      showClipPreviewOverlay,
    } as unknown as OverlayWindowsService);
    const destroyedSend = vi.fn();
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => true, webContents: { send: destroyedSend } },
    ]);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: true,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay: vi.fn().mockResolvedValue({
        ok: false,
        path: null,
        error: "save failed",
      }),
    } as unknown as ManagedRecorderService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "failed-preview",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({ status: "failed" });
    expect(showClipPreviewOverlay).not.toHaveBeenCalled();
    expect(destroyedSend).not.toHaveBeenCalled();
  });

  it("resolves the default storage root from settings", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const defaultStorageService = new ReplayClipsService();

    await expect(defaultStorageService.openClip("missing")).resolves.toEqual({
      ok: false,
      error: "Clip file path is not available",
    });
    const originalOnlyPath = join(root, "2026-06-12_10-31-00.mp4");
    writeFileSync(originalOnlyPath, "video");
    repository.upsert(
      createReplayClip({
        id: "original-only",
        originalObsPath: originalOnlyPath,
        processedClipPath: null,
      }),
    );
    await expect(
      defaultStorageService.openClip("original-only"),
    ).resolves.toEqual({
      ok: true,
      error: null,
    });
    expect(openPath).toHaveBeenCalledWith(resolve(originalOnlyPath));
  });

  it("registers media protocol setup defensively", () => {
    expect(new ReplayClipsService()).toBeInstanceOf(ReplayClipsService);
  });

  it("registers IPC handlers with validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    const ipcService = new ReplayClipsService();
    const clip = createReplayClip();
    vi.spyOn(ipcService, "list").mockReturnValue([clip]);
    vi.spyOn(ipcService, "listLibrary").mockReturnValue({
      availableLeagues: ["Standard"],
      items: [clip],
      pageCount: 1,
      pageIndex: 0,
      pageSize: 20,
      sortBy: "createdAt",
      sortDirection: "desc",
      totalCount: 1,
    });
    vi.spyOn(ipcService, "getClip").mockReturnValue({
      clip,
      durationSeconds: null,
      mediaUrl: "hinekora-media://replay-clip/clip-1",
    });
    vi.spyOn(ipcService, "saveManualReplay").mockResolvedValue(clip);
    vi.spyOn(ipcService, "updateClipFile").mockResolvedValue({
      detail: {
        clip,
        durationSeconds: null,
        mediaUrl: "hinekora-media://replay-clip/clip-1",
      },
      error: null,
      ok: true,
    });
    vi.spyOn(ipcService, "openClip").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "revealClip").mockReturnValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "copyClipToClipboard").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "deleteClip").mockResolvedValue({
      ok: true,
      error: null,
    });
    vi.spyOn(ipcService, "deleteManyClips").mockResolvedValue({
      ok: true,
      error: null,
      deletedIds: ["clip-1"],
      failed: [],
    });

    expect(await handlers.get(ReplayClipsChannel.Get)?.({}, "clip-1")).toEqual({
      clip,
      durationSeconds: null,
      mediaUrl: "hinekora-media://replay-clip/clip-1",
    });
    expect(await handlers.get(ReplayClipsChannel.List)?.({})).toEqual([clip]);
    expect(
      await handlers.get(ReplayClipsChannel.List)?.(
        {},
        { game: "poe1", kind: "death", league: "Standard" },
      ),
    ).toEqual([clip]);
    expect(
      await handlers.get(ReplayClipsChannel.List)?.(
        {},
        { game: "poe1", kind: "death" },
      ),
    ).toEqual([clip]);
    expect(await handlers.get(ReplayClipsChannel.ListLibrary)?.({})).toEqual(
      expect.objectContaining({ items: [clip] }),
    );
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { game: "poe1", kind: "death" },
      ),
    ).toEqual(expect.objectContaining({ items: [clip] }));
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        {
          pageIndex: 0,
          pageSize: 20,
          sortBy: "createdAt",
          sortDirection: "asc",
        },
      ),
    ).toEqual(expect.objectContaining({ items: [clip] }));
    expect(await handlers.get(ReplayClipsChannel.SaveManualReplay)?.({})).toBe(
      clip,
    );
    expect(
      await handlers.get(ReplayClipsChannel.Update)?.(
        {},
        {
          id: "clip-1",
          name: "Renamed clip",
          trim: { inSeconds: 1, outSeconds: 2 },
        },
      ),
    ).toEqual({
      detail: {
        clip,
        durationSeconds: null,
        mediaUrl: "hinekora-media://replay-clip/clip-1",
      },
      error: null,
      ok: true,
    });
    expect(await handlers.get(ReplayClipsChannel.Open)?.({}, "clip-1")).toEqual(
      {
        ok: true,
        error: null,
      },
    );
    expect(
      await handlers.get(ReplayClipsChannel.Reveal)?.({}, "clip-1"),
    ).toEqual({
      ok: true,
      error: null,
    });
    registerIpcWindowRole({ id: 42 }, WindowName.ClipPreviewOverlay);
    expect(
      await handlers.get(ReplayClipsChannel.Copy)?.(
        { sender: { id: 42 } },
        {
          id: "clip-1",
          trim: { inSeconds: 1, outSeconds: 2 },
        },
      ),
    ).toEqual({
      ok: true,
      error: null,
    });
    expect(
      await handlers.get(ReplayClipsChannel.Delete)?.({}, "clip-1"),
    ).toEqual({
      ok: true,
      error: null,
    });
    expect(
      await handlers.get(ReplayClipsChannel.DeleteMany)?.({}, ["clip-1"]),
    ).toEqual({
      ok: true,
      error: null,
      deletedIds: ["clip-1"],
      failed: [],
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { game: "poe3" },
      ),
    ).toEqual({
      ok: false,
      error: "game is invalid",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { kind: "boss" },
      ),
    ).toEqual({
      ok: false,
      error: "clip kind is invalid",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.({}, { league: "" }),
    ).toEqual({
      ok: false,
      error: "league is too short",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { pageIndex: -1 },
      ),
    ).toEqual({
      ok: false,
      error: "page index is too small",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { pageSize: 101 },
      ),
    ).toEqual({
      ok: false,
      error: "page size is too large",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { sortDirection: "sideways" },
      ),
    ).toEqual({
      ok: false,
      error: "sort direction is invalid",
    });
    expect(
      await handlers.get(ReplayClipsChannel.List)?.({}, { game: "poe3" }),
    ).toEqual({
      ok: false,
      error: "game is invalid",
    });
    expect(
      await handlers.get(ReplayClipsChannel.List)?.({}, { kind: "boss" }),
    ).toEqual({
      ok: false,
      error: "clip kind is invalid",
    });
    expect(
      await handlers.get(ReplayClipsChannel.List)?.({}, { league: "" }),
    ).toEqual({
      ok: false,
      error: "league is too short",
    });
    expect(
      await handlers.get(ReplayClipsChannel.ListLibrary)?.(
        {},
        { sortBy: "unknown" },
      ),
    ).toEqual({
      ok: false,
      error: "sort field is invalid",
    });
    expect(await handlers.get(ReplayClipsChannel.Open)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.Get)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.Update)?.({}, {})).toEqual({
      ok: false,
      error: "id must be a string",
    });
    expect(
      await handlers.get(ReplayClipsChannel.Update)?.(
        {},
        { id: "clip-1", trim: { inSeconds: 1, outSeconds: 1.05 } },
      ),
    ).toEqual({
      ok: false,
      error: "trim range is too short",
    });
    expect(
      await handlers.get(ReplayClipsChannel.Copy)?.(
        {},
        { id: "clip-1", trim: { inSeconds: 1, outSeconds: 1.05 } },
      ),
    ).toEqual({
      ok: false,
      error: "trim range is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.Reveal)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.Copy)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.Delete)?.({}, "")).toEqual({
      ok: false,
      error: "id is too short",
    });
    expect(await handlers.get(ReplayClipsChannel.DeleteMany)?.({}, "")).toEqual(
      {
        ok: false,
        error: "ids must be an array",
      },
    );
    expect(
      await handlers.get(ReplayClipsChannel.DeleteMany)?.(
        {},
        Array.from({ length: 101 }, (_, index) => `clip-${index}`),
      ),
    ).toEqual({
      ok: false,
      error: "ids is too large",
    });
    expect(
      await handlers.get(ReplayClipsChannel.DeleteMany)?.({}, [""]),
    ).toEqual({
      ok: false,
      error: "id is too short",
    });
  });
});

describe("ReplayClipsService death-event workflow", () => {
  it("saves manual replays using current settings", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe2",
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const clip = createReplayClip({ sourceGame: "poe2" });
    const handleDeathEvent = vi
      .spyOn(service, "handleDeathEvent")
      .mockResolvedValue(clip);

    await expect(service.saveManualReplay()).resolves.toBe(clip);
    expect(handleDeathEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "manual",
        game: "poe2",
        line: "Manual replay save",
        lineHash: expect.stringMatching(/^[a-f0-9]{32}$/),
      }),
    );
  });

  it("skips death replay saves when the managed replay buffer is inactive", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Hardcore",
        deathClipSeconds: 12,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const saveReplay = vi.fn();
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: false,
        recording: false,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay,
    } as unknown as ManagedRecorderService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "death-hash",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toBeNull();
    expect(saveReplay).not.toHaveBeenCalled();
    expect(repository.list()).toEqual([]);
    expect(send).not.toHaveBeenCalledWith(
      ReplayClipsChannel.StatusChanged,
      expect.objectContaining({ triggerLineHash: "death-hash" }),
    );
  });

  it("keeps the managed replay save guard for inactive buffers", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const getStatus = vi
      .fn()
      .mockReturnValueOnce({
        available: true,
        initialized: true,
        bufferActive: true,
        gameRunning: true,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      })
      .mockReturnValue({
        available: true,
        initialized: true,
        bufferActive: false,
        gameRunning: true,
        recording: false,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      });
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus,
    } as unknown as ManagedRecorderService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "inactive-buffer-save",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "Managed replay buffer is not active",
    });
  });

  it("skips death replay saves when the active game is not running", async () => {
    const saveReplay = vi.fn();
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: true,
        gameRunning: false,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay,
    } as unknown as ManagedRecorderService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "offline-death-hash",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toBeNull();
    expect(saveReplay).not.toHaveBeenCalled();
    expect(repository.list()).toEqual([]);
  });

  it("marks clips failed when managed replay saving fails or returns unsafe paths", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const status = {
      available: true,
      initialized: true,
      bufferActive: true,
      recording: true,
      isStartingRecording: false,
      isStoppingRecording: false,
      runRecordingActive: false,
      runtime: "packaged_obs",
      runtimePath: null,
      outputDirectory: root,
      outputResolution: "native",
      fps: 60,
      encoder: "hardware_h264",
      lastRecordingPath: null,
      runRecordingPath: null,
      activeSessionDirectory: null,
      recordingStartedAt: null,
      runRecordingStartedAt: null,
      error: null,
    };
    const saveReplay = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, path: null, error: "save failed" })
      .mockResolvedValueOnce({ ok: false, path: null, error: null })
      .mockResolvedValueOnce({ ok: true, path: null, error: null })
      .mockResolvedValueOnce({
        ok: true,
        path: join(outsideRoot, "2026-06-12_10-30-00.mp4"),
        error: null,
      });
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => status,
      saveReplay,
    } as unknown as ManagedRecorderService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "save-failed",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "save failed",
    });
    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "fallback-error",
        detectedAt: "2026-06-12T10:00:00.500Z",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "Managed recorder save failed",
    });
    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "null-path",
        detectedAt: "2026-06-12T10:00:01.000Z",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "Recorder did not return a saved replay path",
    });
    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "unsafe-path",
        detectedAt: "2026-06-12T10:00:02.000Z",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "Recorder returned a replay path outside managed storage",
    });
  });

  it("continues processing when a recent duplicate hash has no stored clip", async () => {
    const replayPath = join(root, "2026-06-12_10-31-00.mp4");
    writeFileSync(replayPath, "video");
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    const inactiveStatus = {
      available: true,
      initialized: true,
      bufferActive: false,
      recording: false,
      isStartingRecording: false,
      isStoppingRecording: false,
      runRecordingActive: false,
      runtime: "packaged_obs",
      runtimePath: null,
      outputDirectory: root,
      outputResolution: "native",
      fps: 60,
      encoder: "hardware_h264",
      lastRecordingPath: null,
      runRecordingPath: null,
      activeSessionDirectory: null,
      recordingStartedAt: null,
      runRecordingStartedAt: null,
      error: null,
    };
    const activeStatus = {
      available: true,
      initialized: true,
      bufferActive: true,
      recording: true,
      isStartingRecording: false,
      isStoppingRecording: false,
      runRecordingActive: false,
      runtime: "packaged_obs",
      runtimePath: null,
      outputDirectory: root,
      outputResolution: "native",
      fps: 60,
      encoder: "hardware_h264",
      lastRecordingPath: null,
      runRecordingPath: null,
      activeSessionDirectory: null,
      recordingStartedAt: null,
      runRecordingStartedAt: null,
      error: null,
    };
    const getStatus = vi
      .fn()
      .mockReturnValueOnce(inactiveStatus)
      .mockReturnValue(activeStatus);
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus,
      saveReplay: vi.fn().mockResolvedValue({
        ok: true,
        path: replayPath,
        error: null,
      }),
    } as unknown as ManagedRecorderService);
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      showClipPreviewOverlay: vi.fn(),
    } as unknown as OverlayWindowsService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup: vi.fn(),
    } as unknown as RecordingStorageService);

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "orphan-duplicate",
        detectedAt: "2026-06-12T09:59:59.000Z",
      }),
    ).resolves.toBeNull();

    await expect(
      service.handleDeathEvent({
        game: "poe1",
        line: "You have died.",
        lineHash: "orphan-duplicate",
        detectedAt: "2026-06-12T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      processedClipPath: resolve(replayPath),
    });
  });

  it("saves a ready managed replay, shows the preview, cleans storage, and ignores duplicates", async () => {
    const replayPath = join(root, "2026-06-12_10-30-00.mp4");
    writeFileSync(replayPath, "video");
    const showClipPreviewOverlay = vi.fn().mockResolvedValue(undefined);
    const cleanup = vi.fn();
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        activeLeague: "Standard",
        deathClipSeconds: 10,
        recordingStoragePath: root,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(ManagedRecorderService, "getInstance").mockReturnValue({
      getStatus: () => ({
        available: true,
        initialized: true,
        bufferActive: true,
        recording: true,
        isStartingRecording: false,
        isStoppingRecording: false,
        runRecordingActive: false,
        runtime: "packaged_obs",
        runtimePath: null,
        outputDirectory: root,
        outputResolution: "native",
        fps: 60,
        encoder: "hardware_h264",
        lastRecordingPath: null,
        runRecordingPath: null,
        activeSessionDirectory: null,
        recordingStartedAt: null,
        runRecordingStartedAt: null,
        error: null,
      }),
      saveReplay: vi.fn().mockResolvedValue({
        ok: true,
        path: replayPath,
        error: null,
      }),
    } as unknown as ManagedRecorderService);
    vi.spyOn(OverlayWindowsService, "getInstance").mockReturnValue({
      showClipPreviewOverlay,
    } as unknown as OverlayWindowsService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup,
    } as unknown as RecordingStorageService);

    const event = {
      game: "poe1" as const,
      line: "You have died.",
      lineHash: "ready-hash",
      detectedAt: "2026-06-12T10:00:00.000Z",
    };
    const ready = await service.handleDeathEvent(event);
    expect(ready).not.toBeNull();
    if (!ready) {
      throw new Error("expected ready clip");
    }
    const duplicate = await service.handleDeathEvent(event);
    expect(duplicate).not.toBeNull();
    if (!duplicate) {
      throw new Error("expected duplicate clip");
    }

    expect(ready).toMatchObject({
      kind: "death",
      status: "ready",
      processedClipPath: resolve(replayPath),
      targetDurationSeconds: 10,
    });
    expect(duplicate.id).toBe(ready.id);
    expect(showClipPreviewOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ id: ready.id, status: "ready" }),
    );
    expect(cleanup).toHaveBeenCalledWith({
      protectedPaths: [resolve(replayPath), resolve(replayPath)],
    });
  });
});
