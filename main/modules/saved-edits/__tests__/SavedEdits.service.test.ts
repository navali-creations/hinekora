import { afterEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  ipcMainHandle: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.ipcMainHandle,
  },
  shell: {
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

import { DatabaseService } from "~/main/modules/database";
import {
  createEditorMediaAsset,
  createEditorProject,
  createEditorVideoTrackForAssets,
} from "~/main/modules/editor/__tests__/Editor.test-factories";
import { EditorProjectRepository } from "~/main/modules/editor/EditorProject.repository";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { ReplayClipsService } from "~/main/modules/replay-clips";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import { registerIpcWindowRole } from "~/main/utils/ipc-window-roles";

import { SavedEditsChannel } from "../SavedEdits.channels";
import { SavedEditsService } from "../SavedEdits.service";
import { validateSavedEditsLibraryQuery } from "../SavedEdits.validation";

let database: DatabaseService | null = null;

function createRepository(): EditorProjectRepository {
  database = new DatabaseService(":memory:");

  return new EditorProjectRepository(database);
}

describe("SavedEditsService", () => {
  afterEach(() => {
    database?.close();
    database = null;
    DatabaseService.resetForTests();
    SavedEditsService.resetForTests();
    electronMocks.ipcMainHandle.mockReset();
    electronMocks.showItemInFolder.mockReset();
    vi.restoreAllMocks();
  });

  it("creates and reuses the singleton service", () => {
    mockIpcMainHandlers();
    DatabaseService.resetForTests();
    SavedEditsService.resetForTests();

    const first = SavedEditsService.getInstance();
    const second = SavedEditsService.getInstance();

    expect(second).toBe(first);
  });

  it("lists saved edit summaries with paging and sorting", () => {
    const repository = createRepository();
    repository.upsert(
      createEditorProject({
        id: "project-1",
        title: "Zulu edit",
        updatedAt: "2026-06-18T00:01:00.000Z",
      }),
    );
    repository.upsert(
      createEditorProject({
        id: "project-2",
        title: "Alpha edit",
        updatedAt: "2026-06-18T00:02:00.000Z",
      }),
    );
    const service = new SavedEditsService(repository);

    expect(
      service.listLibrary({
        pageIndex: 0,
        pageSize: 1,
        sortBy: "title",
        sortDirection: "asc",
      }),
    ).toMatchObject({
      items: [
        {
          id: "project-2",
          sizeBytes: 1024,
          title: "Alpha edit",
        },
      ],
      pageCount: 2,
      pageIndex: 0,
      pageSize: 1,
      sortBy: "title",
      sortDirection: "asc",
      totalCount: 2,
    });
  });

  it("clamps saved edit library pages after deletions reduce page count", () => {
    const repository = createRepository();
    const sourceAsset = createEditorMediaAsset({
      sourceGame: "poe2",
      sourceLeague: "Runes of Aldur",
    });
    repository.upsert(
      createEditorProject({
        assets: [sourceAsset],
        id: "project-1",
        title: "First edit",
        tracks: [createEditorVideoTrackForAssets([sourceAsset])],
        updatedAt: "2026-06-18T00:01:00.000Z",
      }),
    );
    repository.upsert(
      createEditorProject({
        assets: [sourceAsset],
        id: "project-2",
        title: "Second edit",
        tracks: [createEditorVideoTrackForAssets([sourceAsset])],
        updatedAt: "2026-06-18T00:02:00.000Z",
      }),
    );
    const service = new SavedEditsService(repository);

    expect(
      service.listLibrary({
        pageIndex: 2,
        pageSize: 1,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }),
    ).toMatchObject({
      items: [{ id: "project-1" }],
      pageCount: 2,
      pageIndex: 1,
      totalCount: 2,
    });
    expect(
      service.listLibrary({
        game: "poe2",
        league: "Runes of Aldur",
        pageIndex: 2,
        pageSize: 1,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }),
    ).toMatchObject({
      items: [{ id: "project-1" }],
      pageCount: 2,
      pageIndex: 1,
      totalCount: 2,
    });
  });

  it("deletes saved edits without touching source media", () => {
    const repository = createRepository();
    repository.upsert(createEditorProject({ id: "project-1" }));
    repository.upsert(createEditorProject({ id: "project-2" }));
    const service = new SavedEditsService(repository);

    service.delete("project-1");

    expect(service.listLibrary({ pageSize: 20 }).items).toEqual([
      expect.objectContaining({ id: "project-2" }),
    ]);

    service.deleteAll();

    expect(service.listLibrary({ pageSize: 20 })).toMatchObject({
      items: [],
      totalCount: 0,
    });
  });

  it("filters saved edits by source game and league", () => {
    const repository = createRepository();
    repository.upsert(
      createEditorProject({
        id: "poe2-project",
        assets: [
          {
            ...createEditorProject().assets[0]!,
            sourceGame: "poe2",
            sourceLeague: "Runes of Aldur",
          },
        ],
      }),
    );
    repository.upsert(
      createEditorProject({
        id: "poe1-project",
        assets: [
          {
            ...createEditorProject().assets[0]!,
            sourceGame: "poe1",
            sourceLeague: "Standard",
          },
        ],
      }),
    );
    const service = new SavedEditsService(repository);

    expect(
      service.listLibrary({
        game: "poe2",
        league: "Runes of Aldur",
        pageSize: 20,
      }),
    ).toMatchObject({
      availableLeagues: ["Runes of Aldur"],
      globalTotalCount: 2,
      items: [
        {
          id: "poe2-project",
          sourceGame: "poe2",
          sourceLeague: "Runes of Aldur",
        },
      ],
      totalCount: 1,
    });
  });

  it("includes mixed-league saved edits in each represented league", () => {
    const repository = createRepository();
    const standardAsset = createEditorMediaAsset({
      assetKey: "clip:standard",
      sourceGame: "poe2",
      sourceLeague: "Standard",
    });
    const runesAsset = createEditorMediaAsset({
      assetKey: "clip:runes",
      sourceGame: "poe2",
      sourceLeague: "Runes of Aldur",
    });
    repository.upsert(
      createEditorProject({
        assets: [standardAsset, runesAsset],
        id: "mixed-league-project",
        tracks: [createEditorVideoTrackForAssets([standardAsset, runesAsset])],
      }),
    );
    const service = new SavedEditsService(repository);

    expect(
      service.listLibrary({
        game: "poe2",
        league: "Standard",
        pageSize: 20,
      }),
    ).toMatchObject({
      availableLeagues: ["Runes of Aldur", "Standard"],
      items: [
        {
          id: "mixed-league-project",
          sourceGame: "poe2",
          sourceLeague: null,
        },
      ],
      totalCount: 1,
    });
    expect(
      service.listLibrary({
        game: "poe2",
        league: "Runes of Aldur",
        pageSize: 20,
      }).items,
    ).toEqual([
      expect.objectContaining({
        id: "mixed-league-project",
        sourceGame: "poe2",
        sourceLeague: null,
      }),
    ]);
  });

  it("includes mixed-game saved edits in each represented game", () => {
    const repository = createRepository();
    const poe1Asset = createEditorMediaAsset({
      assetKey: "clip:poe1-standard",
      sourceGame: "poe1",
      sourceLeague: "Standard",
    });
    const poe2Asset = createEditorMediaAsset({
      assetKey: "clip:poe2-standard",
      sourceGame: "poe2",
      sourceLeague: "Standard",
    });
    repository.upsert(
      createEditorProject({
        assets: [poe1Asset, poe2Asset],
        id: "mixed-game-project",
        tracks: [createEditorVideoTrackForAssets([poe1Asset, poe2Asset])],
      }),
    );
    const service = new SavedEditsService(repository);

    expect(
      service.listLibrary({
        game: "poe1",
        league: "Standard",
        pageSize: 20,
      }).items,
    ).toEqual([
      expect.objectContaining({
        id: "mixed-game-project",
        sourceGame: null,
        sourceLeague: "Standard",
      }),
    ]);
    expect(
      service.listLibrary({
        game: "poe2",
        league: "Standard",
        pageSize: 20,
      }).items,
    ).toEqual([
      expect.objectContaining({
        id: "mixed-game-project",
        sourceGame: null,
        sourceLeague: "Standard",
      }),
    ]);
  });

  it("reports saved edit source media size from unique assets", () => {
    const repository = createRepository();
    const firstAsset = createEditorMediaAsset({
      assetKey: "clip:first",
      id: "first",
      sizeBytes: 2048,
    });
    const secondAsset = createEditorMediaAsset({
      assetKey: "clip:second",
      id: "second",
      sizeBytes: 4096,
    });
    repository.upsert(
      createEditorProject({
        assets: [firstAsset, secondAsset, { ...firstAsset }],
        id: "project-1",
        tracks: [createEditorVideoTrackForAssets([firstAsset, secondAsset])],
      }),
    );
    const service = new SavedEditsService(repository);

    expect(service.listLibrary({ pageSize: 20 }).items[0]).toMatchObject({
      id: "project-1",
      sizeBytes: 6144,
    });
  });

  it("reveals saved edit source media for clips and recordings", () => {
    const repository = createRepository();
    const replayReveal = vi.fn(() => ({ ok: true, error: null }));
    const recordingPathLookup = vi.fn(() => "C:\\clips\\recording.mp4");
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      revealClip: replayReveal,
    } as unknown as ReplayClipsService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      getRecordingMediaPath: recordingPathLookup,
    } as unknown as RecordingStorageService);
    const unusedAsset = createEditorMediaAsset({
      assetKey: "clip:unused-source",
      id: "unused-source",
    });
    const timelineAsset = createEditorMediaAsset({
      assetKey: "clip:timeline-source",
      id: "clip-source",
    });
    const timelineTrack = createEditorVideoTrackForAssets([timelineAsset]);
    const timelineClip = timelineTrack.clips[0];
    if (!timelineClip) {
      throw new Error("Expected timeline clip fixture");
    }
    repository.upsert(
      createEditorProject({
        activeClipId: timelineClip.id,
        id: "clip-project",
        assets: [unusedAsset, timelineAsset],
        selectedAssetKey: timelineAsset.assetKey,
        tracks: [timelineTrack],
      }),
    );
    repository.upsert(
      createEditorProject({
        id: "recording-project",
        assets: [
          createEditorMediaAsset({
            id: "recording-source",
            kind: "recording",
            mediaUrl: "hinekora-media://recording/recording-source",
          }),
        ],
      }),
    );
    const service = new SavedEditsService(repository);

    expect(service.revealInExplorer("clip-project")).toEqual({
      status: "success",
      error: null,
    });
    expect(service.revealInExplorer("recording-project")).toEqual({
      status: "success",
      error: null,
    });
    expect(replayReveal).toHaveBeenCalledWith("clip-source");
    expect(recordingPathLookup).toHaveBeenCalledWith("recording-source");
    expect(electronMocks.showItemInFolder).toHaveBeenCalledWith(
      "C:\\clips\\recording.mp4",
    );
  });

  it("returns safe reveal errors for saved edits without usable source media", () => {
    const repository = createRepository();
    const recordingPathLookup = vi.fn(() => null);
    const replayReveal = vi.fn(() => ({ ok: false, error: null }));
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      revealClip: replayReveal,
    } as unknown as ReplayClipsService);
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      getRecordingMediaPath: recordingPathLookup,
    } as unknown as RecordingStorageService);
    repository.upsert(
      createEditorProject({
        activeClipId: null,
        assets: [],
        durationSeconds: 0,
        id: "empty-project",
        selectedAssetKey: null,
        sourceGame: null,
        sourceLeague: null,
        tracks: [
          {
            clips: [],
            id: "video-track",
            kind: "video",
            label: "Video",
          },
        ],
      }),
    );
    repository.upsert(
      createEditorProject({
        id: "recording-project",
        assets: [
          createEditorMediaAsset({
            id: "recording-source",
            kind: "recording",
            mediaUrl: "hinekora-media://recording/recording-source",
          }),
        ],
      }),
    );
    repository.upsert(
      createEditorProject({
        id: "clip-project",
        assets: [createEditorMediaAsset({ id: "clip-source" })],
      }),
    );
    const service = new SavedEditsService(repository);

    expect(service.revealInExplorer("empty-project")).toEqual({
      status: "unavailable",
      error: "Saved edit has no source media",
    });
    expect(service.revealInExplorer("recording-project")).toEqual({
      status: "unavailable",
      error: "Saved edit source media is not available",
    });
    expect(service.revealInExplorer("clip-project")).toEqual({
      status: "unavailable",
      error: "Saved edit source media is not available",
    });
    expect(replayReveal).toHaveBeenCalledWith("clip-source");
  });

  it("returns safe reveal errors when saved edit lookup fails", () => {
    const repository = createRepository();
    vi.spyOn(repository, "get").mockImplementation(() => {
      throw new Error("repository unavailable");
    });
    const service = new SavedEditsService(repository);

    expect(service.revealInExplorer("project-1")).toEqual({
      status: "unavailable",
      error: "repository unavailable",
    });
  });

  it("returns a safe error when revealing a missing saved edit", () => {
    const service = new SavedEditsService(createRepository());

    expect(service.revealInExplorer("missing-project")).toEqual({
      status: "unavailable",
      error: "Saved edit is not available",
    });
  });

  it("registers a guarded list handler with runtime validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    const repository = createRepository();
    repository.upsert(createEditorProject({ id: "project-1" }));
    const replayReveal = vi.fn(() => ({ ok: true, error: null }));
    vi.spyOn(ReplayClipsService, "getInstance").mockReturnValue({
      revealClip: replayReveal,
    } as unknown as ReplayClipsService);
    new SavedEditsService(repository);

    const sender = { id: 1 };
    registerIpcWindowRole(sender, WindowName.Main);
    const event = { sender };

    expect(
      await handlers.get(SavedEditsChannel.ListLibrary)?.(event, {
        pageSize: 1,
      }),
    ).toMatchObject({
      items: [{ id: "project-1" }],
      totalCount: 1,
    });
    expect(
      await handlers.get(SavedEditsChannel.ListLibrary)?.(event, {
        pageSize: 0,
      }),
    ).toEqual({
      ok: false,
      error: "page size is too small",
    });
    expect(
      await handlers.get(SavedEditsChannel.RevealInExplorer)?.(
        event,
        "project-1",
      ),
    ).toEqual({
      status: "success",
      error: null,
    });
    expect(
      await handlers.get(SavedEditsChannel.RevealInExplorer)?.(event, ""),
    ).toEqual({
      ok: false,
      error: "project id is too short",
    });

    await handlers.get(SavedEditsChannel.Delete)?.(event, "project-1");
    expect(repository.get("project-1")).toBeNull();
    expect(await handlers.get(SavedEditsChannel.Delete)?.(event, "")).toEqual({
      ok: false,
      error: "project id is too short",
    });
    await handlers.get(SavedEditsChannel.DeleteAll)?.(event);
    expect(repository.list({ limit: 10 }).projects).toEqual([]);
  });

  it("validates saved edits list queries", () => {
    expect(validateSavedEditsLibraryQuery(undefined)).toEqual({});
    expect(
      validateSavedEditsLibraryQuery({
        game: "poe2",
        league: "Runes of Aldur",
        pageIndex: 2,
        pageSize: 50,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }),
    ).toEqual({
      game: "poe2",
      league: "Runes of Aldur",
      pageIndex: 2,
      pageSize: 50,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    expect(() =>
      validateSavedEditsLibraryQuery({ sortBy: "duration" }),
    ).toThrow("sort field is invalid");
    expect(() => validateSavedEditsLibraryQuery({ game: "poe3" })).toThrow(
      "game is invalid",
    );
    expect(() =>
      validateSavedEditsLibraryQuery({ sortDirection: "sideways" }),
    ).toThrow("sort direction is invalid");
  });
});
