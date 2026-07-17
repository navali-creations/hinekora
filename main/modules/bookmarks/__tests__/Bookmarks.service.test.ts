import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { mockIpcMainHandlers } from "~/main/test/ipc";

import type { ReplayClip } from "~/types";
import { createDefaultSettings } from "~/types";
import { BookmarksChannel } from "../Bookmarks.channels";
import type { BookmarkManualCreateResult } from "../Bookmarks.dto";
import { BookmarksRepository } from "../Bookmarks.repository";
import { BookmarksService } from "../Bookmarks.service";

function createRecordingItem(input: {
  durationSeconds: number;
  id: string;
  startedAt: string;
  stoppedAt: string;
}) {
  return {
    createdAt: input.startedAt,
    durationSeconds: input.durationSeconds,
    exists: true,
    fileName: `${input.id}.mp4`,
    id: input.id,
    path: `recordings/${input.id}.mp4`,
    sizeBytes: 1024,
    sourceGame: "poe2" as const,
    sourceLeague: "Standard",
    startedAt: input.startedAt,
    stoppedAt: input.stoppedAt,
    updatedAt: input.stoppedAt,
  };
}

function insertRecordingRow(input: ReturnType<typeof createRecordingItem>) {
  const database = DatabaseService.getInstance();

  database.runQuery(
    database.kysely.insertInto("run_recordings").values({
      created_at: input.createdAt,
      duration_seconds: input.durationSeconds,
      exists_on_disk: input.exists ? 1 : 0,
      file_name: input.fileName,
      id: input.id,
      mtime_ms: 0,
      path: input.path,
      size_bytes: input.sizeBytes,
      source_game: input.sourceGame,
      source_league: input.sourceLeague,
      started_at: input.startedAt,
      stopped_at: input.stoppedAt,
      updated_at: input.updatedAt,
    }),
  );
}

function createReplayClip(input: {
  id: string;
  kind: ReplayClip["kind"];
  timestamp: string;
  triggerLineHash: string;
}): ReplayClip {
  return {
    createdAt: input.timestamp,
    deathTimestamp: input.timestamp,
    error: null,
    id: input.id,
    kind: input.kind,
    originalObsPath: null,
    processedClipPath: null,
    durationSeconds: null,
    sizeBytes: 2048,
    sourceGame: "poe2",
    sourceLeague: "Standard",
    status: "ready",
    targetDurationSeconds: 10,
    triggerLineHash: input.triggerLineHash,
    updatedAt: input.timestamp,
  };
}

beforeEach(() => {
  DatabaseService.resetForTests();
  mockIpcMainHandlers();
  vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
    get: () => ({
      ...createDefaultSettings(),
      activeLeague: "Standard",
      recordingTrackBookmarksInRewind: true,
    }),
  } as unknown as SettingsStoreService);
});

afterEach(() => {
  vi.restoreAllMocks();
  DatabaseService.resetForTests();
});

describe("BookmarksService", () => {
  it("supports singleton reset and injected repositories", () => {
    BookmarksService.resetForTests();
    const singleton = BookmarksService.getInstance();
    expect(BookmarksService.getInstance()).toBe(singleton);

    const injectedRepository = {
      listLibraryPage: vi.fn(() => ({
        availableCategories: [],
        availableLeagues: [],
        items: [],
        pageCount: 1,
        pageIndex: 0,
        pageSize: 20,
        sortBy: "occurredAt",
        sortDirection: "desc",
        totalCount: 0,
      })),
    } as unknown as BookmarksRepository;
    const injectedService = new BookmarksService(injectedRepository);

    expect(injectedService.listLibrary()).toEqual(
      expect.objectContaining({ totalCount: 0 }),
    );
    expect(injectedRepository.listLibraryPage).toHaveBeenCalledTimes(1);
  });

  it("pairs location bookmarks with the first real scene after a generated area", () => {
    const service = new BookmarksService();

    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T09:34:20.000Z",
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "P2_Town",
        kind: "generated-area",
        line: 'Generating level 64 area "P2_Town" with seed 1',
        occurredAt: "2026-07-03T09:34:23.000Z",
        sequenceId: "397021937",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [The Khari Bazaar]",
        occurredAt: "2026-07-03T09:34:23.000Z",
        sceneName: "The Khari Bazaar",
        sequenceId: "397022484",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [The Khari Bazaar]",
        occurredAt: "2026-07-03T09:34:48.000Z",
        sceneName: "The Khari Bazaar",
        sequenceId: "397047421",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [The Khari Bazaar]",
        occurredAt: "2026-07-03T09:34:50.000Z",
        sceneName: "The Khari Bazaar",
        sequenceId: "397049859",
      },
      {
        areaId: "P3_Town",
        kind: "generated-area",
        line: 'Generating level 64 area "P3_Town" with seed 1',
        occurredAt: "2026-07-03T09:34:54.000Z",
        sequenceId: "397053703",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [The Glade]",
        occurredAt: "2026-07-03T09:34:55.000Z",
        sceneName: "The Glade",
        sequenceId: "397053937",
      },
    ]);

    expect(service.listLibrary({ game: "poe2", pageSize: 10 }).items).toEqual([
      expect.objectContaining({
        category: "town",
        label: "The Glade",
      }),
      expect.objectContaining({
        category: "town",
        label: "The Khari Bazaar",
      }),
    ]);
  });

  it("classifies hub generated areas as towns", () => {
    const service = new BookmarksService();

    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-04T00:00:00.000Z",
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "Abyss_Hub",
        kind: "generated-area",
        line: 'Generating level 22 area "Abyss_Hub" with seed 1616319435',
        occurredAt: "2026-07-04T00:00:31.000Z",
        sequenceId: "441791171",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [The Well of Souls]",
        occurredAt: "2026-07-04T00:00:31.000Z",
        sceneName: "The Well of Souls",
        sequenceId: "441791250",
      },
    ]);

    expect(service.listLibrary({ game: "poe2", pageSize: 10 }).items).toEqual([
      expect.objectContaining({
        category: "town",
        label: "The Well of Souls",
      }),
    ]);
  });

  it("keeps rewind sessions lightweight when background tracking is disabled", () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeLeague: "Standard",
        recordingTrackBookmarksInRewind: false,
      }),
    } as unknown as SettingsStoreService);
    const service = new BookmarksService();

    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T12:00:00.000Z",
    });
    service.endRewindSession();

    expect(service.listActivitySessions({ game: "poe2" }).totalCount).toBe(0);
  });

  it("includes active recording duration on bookmark library items", () => {
    const service = new BookmarksService();

    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T10:00:00.000Z",
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "MapSevenWaters",
        kind: "generated-area",
        line: 'Generating level 71 area "MapSevenWaters"',
        occurredAt: "2026-07-03T10:00:09.000Z",
        sequenceId: "area-1",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Confluence]",
        occurredAt: "2026-07-03T10:00:10.000Z",
        sceneName: "Confluence",
        sequenceId: "scene-1",
      },
    ]);
    const database = DatabaseService.getInstance();
    database.runQuery(
      database.kysely.insertInto("run_recordings").values({
        created_at: "2026-07-03T10:00:00.000Z",
        duration_seconds: 120,
        exists_on_disk: 1,
        file_name: "run.mp4",
        id: "recording-one",
        mtime_ms: 0,
        path: "recordings/run.mp4",
        size_bytes: 1024,
        source_game: "poe2",
        source_league: "Standard",
        started_at: "2026-07-03T10:00:00.000Z",
        stopped_at: "2026-07-03T10:02:00.000Z",
        updated_at: "2026-07-03T10:02:00.000Z",
      }),
    );
    service.finalizeRecordingSession({
      createdAt: "2026-07-03T10:00:00.000Z",
      durationSeconds: 120,
      exists: true,
      fileName: "run.mp4",
      id: "recording-one",
      path: "recordings/run.mp4",
      sizeBytes: 1024,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-07-03T10:00:00.000Z",
      stoppedAt: "2026-07-03T10:02:00.000Z",
      updatedAt: "2026-07-03T10:02:00.000Z",
    });

    const queryOneSpy = vi.spyOn(database, "queryOne");
    const listPage = service.listLibrary({ game: "poe2", pageSize: 10 });

    expect(queryOneSpy).toHaveBeenCalledTimes(1);
    expect(listPage.items[0]).toEqual(
      expect.objectContaining({
        activeRecordingBookmarkDurationSeconds: 110,
        activeRecordingDurationSeconds: 120,
        activeRecordingId: "recording-one",
        activeRecordingOffsetSeconds: 10,
        label: "Confluence",
      }),
    );
  });

  it("pages recording bookmarks by category without refetching timeline markers", () => {
    const service = new BookmarksService();
    const recording = createRecordingItem({
      durationSeconds: 120,
      id: "recording-filtered",
      startedAt: "2026-07-03T10:00:00.000Z",
      stoppedAt: "2026-07-03T10:02:00.000Z",
    });

    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: recording.startedAt,
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "MapSevenWaters",
        kind: "generated-area",
        line: 'Generating level 71 area "MapSevenWaters"',
        occurredAt: "2026-07-03T10:00:09.000Z",
        sequenceId: "recording-filtered-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Confluence]",
        occurredAt: "2026-07-03T10:00:10.000Z",
        sceneName: "Confluence",
        sequenceId: "recording-filtered-scene",
      },
    ]);
    service.handleClientLogDeath({
      detectedAt: "2026-07-03T10:00:20.000Z",
      game: "poe2",
      line: ": ailubleed has been slain.",
      lineHash: "recording-filtered-death",
    });
    service.finalizeRecordingSession(recording);

    const page = service.listRecording(recording.id, {
      category: "death",
      includeTimeline: false,
      pageSize: 5,
    });

    expect(page.availableCategories).toEqual(["death", "map"]);
    expect(page.items).toEqual([
      expect.objectContaining({
        category: "death",
        label: "Death",
        offsetSeconds: 20,
      }),
    ]);
    expect(page.timelineItems).toEqual([]);
    expect(page.timelineItemsTruncated).toBe(false);
    expect(page.totalCount).toBe(1);
  });

  it("archives recording links with enough context for bookmark statistics", () => {
    const service = new BookmarksService();
    const recording = createRecordingItem({
      durationSeconds: 120,
      id: "recording-archive",
      startedAt: "2026-07-03T10:00:00.000Z",
      stoppedAt: "2026-07-03T10:02:00.000Z",
    });

    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: recording.startedAt,
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "MapSevenWaters",
        kind: "generated-area",
        line: 'Generating level 71 area "MapSevenWaters"',
        occurredAt: "2026-07-03T10:00:09.000Z",
        sequenceId: "archive-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Confluence]",
        occurredAt: "2026-07-03T10:00:10.000Z",
        sceneName: "Confluence",
        sequenceId: "archive-scene",
      },
    ]);
    insertRecordingRow(recording);
    service.finalizeRecordingSession(recording);

    service.archiveRecordingLinks(recording);

    expect(
      service.listLibrary({ game: "poe2", pageSize: 10 }).items[0],
    ).toEqual(
      expect.objectContaining({
        activeRecordingBookmarkDurationSeconds: null,
        activeRecordingDurationSeconds: null,
        activeRecordingId: null,
        archivedRecordingBookmarkDurationSeconds: 110,
        archivedRecordingDurationSeconds: 120,
        archivedRecordingId: "recording-archive",
        archivedRecordingTitle: "recording-archive.mp4",
      }),
    );
  });

  it("deletes bookmarks when a recording is explicitly deleted", () => {
    const service = new BookmarksService();
    const recording = createRecordingItem({
      durationSeconds: 60,
      id: "recording-delete",
      startedAt: "2026-07-03T11:00:00.000Z",
      stoppedAt: "2026-07-03T11:01:00.000Z",
    });

    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: recording.startedAt,
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "P2_Town",
        kind: "generated-area",
        line: 'Generating level 64 area "P2_Town"',
        occurredAt: "2026-07-03T11:00:04.000Z",
        sequenceId: "delete-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [The Khari Bazaar]",
        occurredAt: "2026-07-03T11:00:05.000Z",
        sceneName: "The Khari Bazaar",
        sequenceId: "delete-scene",
      },
    ]);
    insertRecordingRow(recording);
    service.finalizeRecordingSession(recording);

    expect(service.listLibrary({ game: "poe2" }).totalCount).toBe(1);

    service.deleteBookmarksForRecording(recording.id);

    expect(service.listLibrary({ game: "poe2" }).totalCount).toBe(0);
  });

  it("tracks rewind activity bookmarks and linked replay clips", () => {
    const service = new BookmarksService();

    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T12:00:00.000Z",
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "P2_Town",
        kind: "generated-area",
        line: 'Generating level 64 area "P2_Town"',
        occurredAt: "2026-07-03T12:00:04.000Z",
        sequenceId: "rewind-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [The Khari Bazaar]",
        occurredAt: "2026-07-03T12:00:05.000Z",
        sceneName: "The Khari Bazaar",
        sequenceId: "rewind-scene",
      },
    ]);
    service.rememberReplayClipSession({
      game: "poe2",
      triggerLineHash: "manual-replay-hash",
    });
    service.linkReplayClip(
      createReplayClip({
        id: "manual-replay-1",
        kind: "manual",
        timestamp: "2026-07-03T12:00:20.000Z",
        triggerLineHash: "manual-replay-hash",
      }),
    );
    service.endRewindSession();

    const sessions = service.listActivitySessions({
      game: "poe2",
      pageSize: 5,
    });
    const session = sessions.items[0];
    if (!session) {
      throw new Error("Expected rewind activity session");
    }
    expect(session).toEqual(
      expect.objectContaining({
        bookmarkCount: 2,
        clipCount: 1,
        sourceLeague: "Standard",
      }),
    );

    const timeline = service.listActivitySessionTimeline(session.id);
    expect(timeline).toMatchObject({
      bookmarkTimelineItemsTruncated: false,
      clipTimelineItemsTruncated: false,
      clips: [
        expect.objectContaining({
          offsetSeconds: 20,
          targetId: "manual-replay-1",
          targetKind: "replay-clip",
        }),
      ],
      session: expect.objectContaining({ id: session.id }),
    });
    expect(timeline?.bookmarks.map((bookmark) => bookmark.category)).toEqual([
      "town",
      "rewind-manual-replay",
    ]);

    expect(service.listLibrary({ game: "poe2", pageSize: 10 }).items).toEqual([
      expect.objectContaining({
        activeActivitySessionBookmarkDurationSeconds: null,
        activeActivitySessionId: session.id,
        activeActivitySessionDurationSeconds: expect.any(Number),
        activeActivitySessionOffsetSeconds: 20,
        category: "rewind-manual-replay",
      }),
      expect.objectContaining({
        activeActivitySessionBookmarkDurationSeconds: expect.any(Number),
        activeActivitySessionId: session.id,
        activeActivitySessionDurationSeconds: expect.any(Number),
        activeActivitySessionOffsetSeconds: 5,
        category: "town",
      }),
    ]);
    expect(
      service.listLibrary({ game: "poe2", pageSize: 10 }).items[0]
        ?.activeActivitySessionDurationSeconds,
    ).toBeGreaterThanOrEqual(20);
  });

  it("persists closed rewind activity location durations for library rows", () => {
    const service = new BookmarksService();

    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T12:00:00.000Z",
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "HideoutFelled",
        kind: "generated-area",
        line: 'Generating level 65 area "HideoutFelled"',
        occurredAt: "2026-07-03T12:00:00.000Z",
        sequenceId: "hideout-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Felled Hideout]",
        occurredAt: "2026-07-03T12:00:00.000Z",
        sceneName: "Felled Hideout",
        sequenceId: "hideout-scene",
      },
      {
        areaId: "MapWorldsPromenade",
        kind: "generated-area",
        line: 'Generating level 83 area "MapWorldsPromenade"',
        occurredAt: "2026-07-03T12:00:30.000Z",
        sequenceId: "map-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Promenade]",
        occurredAt: "2026-07-03T12:00:30.000Z",
        sceneName: "Promenade",
        sequenceId: "map-scene",
      },
    ]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T12:01:30.000Z"));
    service.endRewindSession();
    vi.useRealTimers();

    expect(
      service
        .listLibrary({ game: "poe2", pageSize: 10 })
        .items.map((bookmark) => ({
          category: bookmark.category,
          duration: bookmark.activeActivitySessionBookmarkDurationSeconds,
        })),
    ).toEqual([
      { category: "map", duration: 60 },
      { category: "hideout", duration: 30 },
    ]);
  });

  it("uses the latest activity session link when a bookmark belongs to multiple sessions", () => {
    const service = new BookmarksService();
    const repository = new BookmarksRepository(DatabaseService.getInstance());

    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T12:00:00.000Z",
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "MapSevenWaters",
        kind: "generated-area",
        line: 'Generating level 71 area "MapSevenWaters"',
        occurredAt: "2026-07-03T12:00:10.000Z",
        sequenceId: "duplicate-link-map-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Confluence]",
        occurredAt: "2026-07-03T12:00:10.000Z",
        sceneName: "Confluence",
        sequenceId: "duplicate-link-map-scene",
      },
    ]);
    service.endRewindSession();

    const bookmark = service.listLibrary({ game: "poe2", pageSize: 10 })
      .items[0];
    if (!bookmark) {
      throw new Error("Expected bookmark to link to a rewind session");
    }

    const latestSession = repository.openActivitySession({
      mode: "rewind",
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-07-03T12:30:00.000Z",
    });
    repository.linkActivitySessionBookmark({
      activitySessionId: latestSession.id,
      bookmarkId: bookmark.id,
      offsetSeconds: 5,
    });
    DatabaseService.getInstance().runQuery(
      DatabaseService.getInstance()
        .kysely.updateTable("bookmark_links")
        .set({ updated_at: "2027-01-01T00:00:00.000Z" })
        .where("bookmark_id", "=", bookmark.id)
        .where("target_id", "=", latestSession.id),
    );

    expect(
      service.listLibrary({ game: "poe2", pageSize: 10 }).items[0],
    ).toEqual(
      expect.objectContaining({
        activeActivitySessionId: latestSession.id,
        activeActivitySessionOffsetSeconds: 5,
      }),
    );
  });

  it("removes rewind activity clip links when replay clips are deleted", () => {
    const service = new BookmarksService();

    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T12:00:00.000Z",
    });
    service.handleClientLogDeath({
      detectedAt: "2026-07-03T12:00:10.000Z",
      game: "poe2",
      line: ": ailubleed has been slain.",
      lineHash: "death-hash",
    });
    service.rememberReplayClipSession({
      game: "poe2",
      triggerLineHash: "death-hash",
    });
    service.linkReplayClip(
      createReplayClip({
        id: "death-clip",
        kind: "death",
        timestamp: "2026-07-03T12:00:10.000Z",
        triggerLineHash: "death-hash",
      }),
    );
    service.rememberReplayClipSession({
      game: "poe2",
      triggerLineHash: "manual-hash",
    });
    service.linkReplayClip(
      createReplayClip({
        id: "manual-clip",
        kind: "manual",
        timestamp: "2026-07-03T12:00:20.000Z",
        triggerLineHash: "manual-hash",
      }),
    );

    const session = service.listActivitySessions({
      game: "poe2",
      pageSize: 5,
    }).items[0];
    if (!session) {
      throw new Error("Expected rewind activity session");
    }

    expect(
      service
        .listActivitySessionTimeline(session.id)
        ?.clips.map((clip) => clip.targetId),
    ).toEqual(["death-clip", "manual-clip"]);

    service.deleteReplayClipLinks("manual-clip");

    expect(
      service
        .listActivitySessionTimeline(session.id)
        ?.clips.map((clip) => clip.targetId),
    ).toEqual(["death-clip"]);
    expect(
      service
        .listActivitySessionTimeline(session.id)
        ?.bookmarks.map((bookmark) => bookmark.category),
    ).toEqual(["death"]);
    expect(service.listActivitySessions({ game: "poe2" }).items[0]).toEqual(
      expect.objectContaining({ bookmarkCount: 1, clipCount: 1 }),
    );

    service.deleteReplayClipLinksMany(["death-clip", "missing-clip"]);

    expect(service.listActivitySessionTimeline(session.id)?.clips).toEqual([]);
    expect(
      service
        .listActivitySessionTimeline(session.id)
        ?.bookmarks.map((bookmark) => bookmark.category),
    ).toEqual(["death"]);
    expect(service.listActivitySessions({ game: "poe2" }).items[0]).toEqual(
      expect.objectContaining({ bookmarkCount: 1, clipCount: 0 }),
    );
  });

  it("returns a clear manual bookmark error without an active recording", () => {
    const service = new BookmarksService();

    expect(service.createManualBookmark()).toEqual({
      bookmark: null,
      error: "Manual bookmarks can only be saved while recording is active.",
      ok: false,
    });
  });

  it("skips tracked bookmarks when no session is active", () => {
    const service = new BookmarksService();

    service.handleClientLogDeath({
      detectedAt: "2026-07-03T13:00:00.000Z",
      game: "poe2",
      line: ": ailubleed has been slain.",
      lineHash: "death-without-session",
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "MapSevenWaters",
        kind: "generated-area",
        line: 'Generating level 71 area "MapSevenWaters"',
        occurredAt: "2026-07-03T13:00:01.000Z",
        sequenceId: "activity-without-session-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Confluence]",
        occurredAt: "2026-07-03T13:00:02.000Z",
        sceneName: "Confluence",
        sequenceId: "activity-without-session-scene",
      },
    ]);

    expect(service.listLibrary({ game: "poe2" }).totalCount).toBe(0);
  });

  it("creates, updates, and deletes manual bookmarks during a recording session", () => {
    const service = new BookmarksService();

    service.seedClientLogActivityState("poe2", [
      {
        areaId: "HideoutFelled",
        kind: "generated-area",
        line: 'Generating level 65 area "HideoutFelled"',
        occurredAt: "2026-07-03T13:59:58.000Z",
        sequenceId: "manual-seed-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Felled Hideout]",
        occurredAt: "2026-07-03T13:59:59.000Z",
        sceneName: "Felled Hideout",
        sequenceId: "manual-seed-scene",
      },
    ]);
    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T14:00:00.000Z",
    });

    const result = service.createManualBookmark();
    expect(result).toEqual({
      bookmark: expect.objectContaining({
        category: "manual",
        label: "Manual bookmark",
        sceneName: "Felled Hideout",
      }),
      error: null,
      ok: true,
    });
    const bookmarkId = result.bookmark?.id;
    if (!bookmarkId) {
      throw new Error("Expected manual bookmark id");
    }

    service.updateManual({
      id: bookmarkId,
      label: "Map device moment",
      note: "Remember the atlas setup",
    });
    service.updateManual({ id: bookmarkId, label: "Renamed moment" });

    expect(service.listLibrary({ category: "manual" }).items).toEqual([
      expect.objectContaining({
        label: "Renamed moment",
        note: "Remember the atlas setup",
      }),
    ]);

    service.deleteManual(bookmarkId);

    expect(service.listLibrary({ category: "manual" }).totalCount).toBe(0);
  });

  it("ignores finalize requests when no recording bookmark session is active", () => {
    const service = new BookmarksService();

    expect(() =>
      service.finalizeRecordingSession(
        createRecordingItem({
          durationSeconds: 30,
          id: "recording-without-session",
          startedAt: "2026-07-03T14:00:00.000Z",
          stoppedAt: "2026-07-03T14:00:30.000Z",
        }),
      ),
    ).not.toThrow();
    expect(service.listLibrary({ game: "poe2" }).totalCount).toBe(0);
  });

  it("ignores finalize requests when a recording session has no bookmarks", () => {
    const service = new BookmarksService();
    const recording = createRecordingItem({
      durationSeconds: 30,
      id: "recording-without-bookmarks",
      startedAt: "2026-07-03T14:00:00.000Z",
      stoppedAt: "2026-07-03T14:00:30.000Z",
    });

    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: recording.startedAt,
    });
    service.finalizeRecordingSession(recording);

    expect(service.listRecording(recording.id).totalCount).toBe(0);
  });

  it("ignores stale or invalid generated area and scene pairs", () => {
    const service = new BookmarksService();

    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T14:30:00.000Z",
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "MapSevenWaters",
        kind: "generated-area",
        line: 'Generating level 71 area "MapSevenWaters"',
        occurredAt: "2026-07-03T14:30:00.000Z",
        sequenceId: "stale-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Confluence]",
        occurredAt: "2026-07-03T14:30:31.000Z",
        sceneName: "Confluence",
        sequenceId: "stale-scene",
      },
      {
        areaId: "MapSevenWaters",
        kind: "generated-area",
        line: 'Generating level 71 area "MapSevenWaters"',
        occurredAt: "not-a-date",
        sequenceId: "invalid-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Confluence]",
        occurredAt: "also-not-a-date",
        sceneName: "Confluence",
        sequenceId: "invalid-scene",
      },
    ]);

    expect(service.listLibrary({ game: "poe2" }).items).toEqual([
      expect.objectContaining({ label: "Confluence" }),
    ]);
  });

  it("calculates recording bookmark durations between adjacent locations", () => {
    const service = new BookmarksService();
    const recording = createRecordingItem({
      durationSeconds: 90,
      id: "recording-location-durations",
      startedAt: "2026-07-03T14:40:00.000Z",
      stoppedAt: "2026-07-03T14:41:30.000Z",
    });

    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: recording.startedAt,
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "MapSevenWaters",
        kind: "generated-area",
        line: 'Generating level 71 area "MapSevenWaters"',
        occurredAt: "2026-07-03T14:40:10.000Z",
        sequenceId: "duration-map-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Confluence]",
        occurredAt: "2026-07-03T14:40:10.000Z",
        sceneName: "Confluence",
        sequenceId: "duration-map-scene",
      },
      {
        areaId: "HideoutFelled",
        kind: "generated-area",
        line: 'Generating level 65 area "HideoutFelled"',
        occurredAt: "2026-07-03T14:40:45.000Z",
        sequenceId: "duration-hideout-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [Felled Hideout]",
        occurredAt: "2026-07-03T14:40:45.000Z",
        sceneName: "Felled Hideout",
        sequenceId: "duration-hideout-scene",
      },
    ]);
    service.finalizeRecordingSession(recording);

    expect(
      service
        .listRecording(recording.id, { pageSize: 10 })
        .items.map((bookmark) => ({
          duration: bookmark.durationSeconds,
          label: bookmark.label,
          offset: bookmark.offsetSeconds,
        })),
    ).toEqual([
      { duration: 45, label: "Felled Hideout", offset: 45 },
      { duration: 35, label: "Confluence", offset: 10 },
    ]);
  });

  it("sorts bookmark and rewind library pages by every supported column", () => {
    const service = new BookmarksService();

    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T15:00:00.000Z",
    });
    service.handleClientLogActivityEvents("poe2", [
      {
        areaId: "P2_Town",
        kind: "generated-area",
        line: 'Generating level 64 area "P2_Town"',
        occurredAt: "2026-07-03T15:00:00.000Z",
        sequenceId: "sort-town-area",
      },
      {
        kind: "scene-source",
        line: "[SCENE] Set Source [The Khari Bazaar]",
        occurredAt: "2026-07-03T15:00:00.000Z",
        sceneName: "The Khari Bazaar",
        sequenceId: "sort-town-scene",
      },
    ]);
    service.rememberReplayClipSession({
      game: "poe2",
      triggerLineHash: "sort-manual",
    });
    service.linkReplayClip(
      createReplayClip({
        id: "sort-manual-clip",
        kind: "manual",
        timestamp: "2026-07-03T15:00:10.000Z",
        triggerLineHash: "sort-manual",
      }),
    );
    service.endRewindSession();

    expect(
      service.listLibrary({ sortBy: "category", sortDirection: "asc" }).sortBy,
    ).toBe("category");
    expect(
      service.listLibrary({ sortBy: "label", sortDirection: "asc" }).sortBy,
    ).toBe("label");
    expect(
      service.listLibrary({ sortBy: "sourceLeague", sortDirection: "asc" })
        .sortBy,
    ).toBe("sourceLeague");

    for (const sortBy of [
      "bookmarkCount",
      "clipCount",
      "durationSeconds",
      "sourceLeague",
      "startedAt",
    ] as const) {
      expect(
        service.listActivitySessions({
          game: "poe2",
          league: "Standard",
          pageIndex: 0,
          pageSize: 5,
          sortBy,
          sortDirection: "asc",
        }),
      ).toEqual(expect.objectContaining({ sortBy, sortDirection: "asc" }));
    }
  });

  it("keeps invalid rewind session timestamps from producing durations", () => {
    const service = new BookmarksService();

    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "not-a-date",
    });
    service.handleClientLogDeath({
      detectedAt: "also-not-a-date",
      game: "poe2",
      line: ": ailubleed has been slain.",
      lineHash: "invalid-rewind-death",
    });
    service.endRewindSession();

    expect(service.listActivitySessions({ game: "poe2" }).items[0]).toEqual(
      expect.objectContaining({ durationSeconds: null }),
    );
    expect(service.listLibrary({ game: "poe2" }).items[0]).toEqual(
      expect.objectContaining({
        activeActivitySessionOffsetSeconds: null,
        category: "death",
      }),
    );
  });

  it("ignores pending rewind clip sessions from another game", () => {
    const service = new BookmarksService();

    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T15:30:00.000Z",
    });
    service.rememberReplayClipSession({
      game: "poe2",
      triggerLineHash: "poe2-manual",
    });
    service.endRewindSession();
    service.linkReplayClip({
      ...createReplayClip({
        id: "poe1-manual-clip",
        kind: "manual",
        timestamp: "2026-07-03T15:30:10.000Z",
        triggerLineHash: "poe2-manual",
      }),
      sourceGame: "poe1",
    });

    expect(service.listLibrary({ game: "poe2" }).items).toEqual([]);
  });

  it("links death clips to rewind sessions even when the death bookmark is missing", () => {
    const service = new BookmarksService();

    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T15:30:00.000Z",
    });
    service.rememberReplayClipSession({
      game: "poe2",
      triggerLineHash: "missing-death-bookmark",
    });
    service.endRewindSession();
    service.linkReplayClip(
      createReplayClip({
        id: "death-without-bookmark",
        kind: "death",
        timestamp: "2026-07-03T15:30:10.000Z",
        triggerLineHash: "missing-death-bookmark",
      }),
    );

    const session = service.listActivitySessions({
      game: "poe2",
      pageSize: 5,
    }).items[0];
    if (!session) {
      throw new Error("Expected rewind activity session");
    }

    expect(service.listActivitySessionTimeline(session.id)?.clips).toEqual([
      expect.objectContaining({
        bookmarkId: null,
        offsetSeconds: 10,
        targetId: "death-without-bookmark",
      }),
    ]);
  });

  it("resolves active session preferences and trims pending replay clip sessions", () => {
    const service = new BookmarksService();
    const internals = service as unknown as {
      isSameScene: (
        current: {
          category: "map";
          sceneName: string;
          subcategory: null;
        } | null,
        next: {
          category: "map";
          sceneName: string;
          subcategory: null;
        },
      ) => boolean;
      pendingReplayClipSessions: Map<string, unknown>;
      resolveActiveSession: (
        preferredMode?: "recording" | "rewind",
      ) => { game: "poe1" | "poe2" } | null;
    };

    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T17:00:00.000Z",
    });
    service.beginRewindSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T17:00:00.000Z",
    });
    for (let index = 0; index < 65; index += 1) {
      service.rememberReplayClipSession({
        game: "poe2",
        triggerLineHash: `pending-${index}`,
      });
    }

    expect(internals.resolveActiveSession("rewind")).toEqual(
      expect.objectContaining({ game: "poe2" }),
    );
    expect(internals.resolveActiveSession()).toEqual(
      expect.objectContaining({ game: "poe2" }),
    );
    service.discardRecordingSession();
    expect(internals.resolveActiveSession()).toEqual(
      expect.objectContaining({ game: "poe2" }),
    );
    expect(
      internals.isSameScene(null, {
        category: "map",
        sceneName: "Promenade",
        subcategory: null,
      }),
    ).toBe(false);
    expect(
      internals.isSameScene(
        { category: "map", sceneName: "Promenade", subcategory: null },
        { category: "map", sceneName: "Promenade", subcategory: null },
      ),
    ).toBe(true);
    expect(
      internals.isSameScene(
        { category: "map", sceneName: "Promenade", subcategory: null },
        { category: "map", sceneName: "Carcass", subcategory: null },
      ),
    ).toBe(false);
    expect(internals.pendingReplayClipSessions.size).toBe(64);
    expect(internals.pendingReplayClipSessions.has("pending-0")).toBe(false);
  });

  it("keeps repository defensive duration helpers stable", () => {
    const repository = new BookmarksRepository(DatabaseService.getInstance());
    const internals = repository as unknown as {
      calculateActivitySessionBookmarkDurationSeconds: (input: {
        bookmarkId: string;
        category: "map" | "manual";
        locationOffsets: Array<{ bookmarkId: string; offsetSeconds: number }>;
        offsetSeconds: number | null;
        targetDurationSeconds: number | null;
      }) => number | null;
      calculateLocationDurationSeconds: (input: {
        durationSeconds: number | null;
        offsetSeconds: number | null;
        sortedBookmarks: [];
        startedAtMs: number;
        startIndex: number;
      }) => number | null;
      get: (id: string) => unknown;
      getByDedupeKey: (dedupeKey: string) => unknown;
      listActivitySessionIdsForBookmarks: (bookmarkIds: string[]) => string[];
      updateActivitySessionLocationDurations: (session: {
        id: string;
        mode: "rewind";
        sourceGame: "poe2";
        sourceLeague: string;
        startedAt: string;
        stoppedAt: string | null;
        createdAt: string;
        updatedAt: string;
      }) => void;
    };

    expect(repository.get("missing-bookmark")).toBeNull();
    expect(repository.getByDedupeKey("missing-dedupe-key")).toBeNull();
    expect(internals.listActivitySessionIdsForBookmarks([])).toEqual([]);
    expect(
      internals.calculateLocationDurationSeconds({
        durationSeconds: 30,
        offsetSeconds: null,
        sortedBookmarks: [],
        startedAtMs: Date.now(),
        startIndex: 0,
      }),
    ).toBeNull();
    expect(
      internals.calculateLocationDurationSeconds({
        durationSeconds: null,
        offsetSeconds: 5,
        sortedBookmarks: [],
        startedAtMs: Date.now(),
        startIndex: 0,
      }),
    ).toBeNull();
    expect(
      internals.calculateActivitySessionBookmarkDurationSeconds({
        bookmarkId: "current-location",
        category: "map",
        locationOffsets: [
          { bookmarkId: "current-location", offsetSeconds: 5 },
          { bookmarkId: "next-location", offsetSeconds: 20 },
        ],
        offsetSeconds: 5,
        targetDurationSeconds: 30,
      }),
    ).toBe(15);
    expect(
      internals.calculateActivitySessionBookmarkDurationSeconds({
        bookmarkId: "manual-bookmark",
        category: "manual",
        locationOffsets: [],
        offsetSeconds: 5,
        targetDurationSeconds: 30,
      }),
    ).toBeNull();
    expect(() =>
      internals.updateActivitySessionLocationDurations({
        createdAt: "2026-07-03T17:00:00.000Z",
        id: "session-without-stop",
        mode: "rewind",
        sourceGame: "poe2",
        sourceLeague: "Standard",
        startedAt: "2026-07-03T17:00:00.000Z",
        stoppedAt: null,
        updatedAt: "2026-07-03T17:00:00.000Z",
      }),
    ).not.toThrow();
  });

  it("refreshes activity counters when linked manual and recording bookmarks are deleted", () => {
    const repository = new BookmarksRepository(DatabaseService.getInstance());
    const manualBookmark = repository.upsertBookmark({
      category: "manual",
      dedupeKey: null,
      label: "Manual bookmark",
      note: null,
      occurredAt: "2026-07-03T17:00:05.000Z",
      sceneName: "Confluence",
      source: "manual",
      sourceGame: "poe2",
      sourceLeague: "Standard",
      subcategory: null,
    });
    const recordingBookmark = repository.upsertBookmark({
      category: "map",
      dedupeKey: "recording-delete-link",
      label: "Confluence",
      note: null,
      occurredAt: "2026-07-03T17:00:10.000Z",
      sceneName: "Confluence",
      source: "client-log",
      sourceGame: "poe2",
      sourceLeague: "Standard",
      subcategory: null,
    });
    const manualSession = repository.openActivitySession({
      mode: "rewind",
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-07-03T17:00:00.000Z",
    });
    const recordingSession = repository.openActivitySession({
      mode: "rewind",
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-07-03T17:30:00.000Z",
    });

    repository.linkActivitySessionBookmark({
      activitySessionId: manualSession.id,
      bookmarkId: manualBookmark.id,
      offsetSeconds: 5,
    });
    repository.linkActivitySessionBookmark({
      activitySessionId: recordingSession.id,
      bookmarkId: recordingBookmark.id,
      offsetSeconds: 10,
    });
    repository.linkRecordingBookmarks({
      durationSeconds: 60,
      recordingId: "recording-with-activity-link",
      recordingTitle: "recording.mp4",
      sourceGame: "poe2",
      startedAt: "2026-07-03T17:00:00.000Z",
      stoppedAt: "2026-07-03T17:01:00.000Z",
    });

    repository.deleteManual(manualBookmark.id);
    repository.deleteBookmarksForRecording("recording-with-activity-link");

    const sessions = new BookmarksService(repository).listActivitySessions({
      game: "poe2",
      pageSize: 10,
    }).items;
    expect(sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: manualSession.id, bookmarkCount: 0 }),
        expect.objectContaining({ id: recordingSession.id, bookmarkCount: 0 }),
      ]),
    );
  });

  it("returns null for missing rewind activity timelines", () => {
    const service = new BookmarksService();

    expect(service.listActivitySessionTimeline("missing-session")).toBeNull();
  });

  it("rejects invalid library query enum values over IPC", async () => {
    const { handlers } = mockIpcMainHandlers();
    new BookmarksService();

    expect(
      await handlers.get(BookmarksChannel.ListLibrary)?.({}, { game: "poe3" }),
    ).toEqual({
      ok: false,
      error: "game must be poe1 or poe2",
    });
    expect(
      await handlers.get(BookmarksChannel.ListLibrary)?.(
        {},
        { category: "everything" },
      ),
    ).toEqual({
      ok: false,
      error: "bookmark category is invalid",
    });
    expect(
      await handlers.get(BookmarksChannel.ListActivitySessions)?.(
        {},
        { sortBy: "label" },
      ),
    ).toEqual({
      ok: false,
      error: "rewind sort field is invalid",
    });
    expect(
      await handlers.get(BookmarksChannel.ListLibrary)?.(
        {},
        { sortDirection: "sideways" },
      ),
    ).toEqual({
      ok: false,
      error: "sort direction must be asc or desc",
    });
    expect(
      await handlers.get(BookmarksChannel.ListLibrary)?.(
        {},
        { sortBy: "durationSeconds" },
      ),
    ).toEqual({
      ok: false,
      error: "bookmark sort field is invalid",
    });
    expect(
      await handlers.get(BookmarksChannel.GetActivitySessionTimeline)?.({}, ""),
    ).toEqual({
      ok: false,
      error: "activity session id is too short",
    });
    expect(await handlers.get(BookmarksChannel.DeleteManual)?.({}, "")).toEqual(
      {
        ok: false,
        error: "bookmark id is too short",
      },
    );
    expect(
      await handlers.get(BookmarksChannel.UpdateManual)?.(
        {},
        { id: "bookmark-1", label: "Valid", note: 42 },
      ),
    ).toEqual({
      ok: false,
      error: "bookmark note must be a string",
    });
    expect(
      await handlers.get(BookmarksChannel.ListRecording)?.({}, "recording-1", {
        category: "everything",
      }),
    ).toEqual({
      ok: false,
      error: "bookmark category is invalid",
    });
    expect(
      await handlers.get(BookmarksChannel.ListRecording)?.({}, "recording-1", {
        includeTimeline: "nope",
      }),
    ).toEqual({
      ok: false,
      error: "include timeline must be a boolean",
    });
  });

  it("accepts full bookmark IPC query payloads and manual mutations", async () => {
    const { handlers } = mockIpcMainHandlers();
    const service = new BookmarksService();
    service.beginRecordingSession({
      game: "poe2",
      league: "Standard",
      startedAt: "2026-07-03T16:00:00.000Z",
    });
    const manualResult = service.createManualBookmark();
    const manualBookmarkId = manualResult.bookmark?.id;
    if (!manualBookmarkId) {
      throw new Error("Expected manual bookmark id");
    }

    await handlers.get(BookmarksChannel.UpdateManual)?.(
      {},
      {
        id: manualBookmarkId,
        label: "Updated through IPC",
        note: "Visible note",
      },
    );
    await handlers.get(BookmarksChannel.UpdateManual)?.(
      {},
      {
        id: manualBookmarkId,
        label: "Null note through IPC",
        note: null,
      },
    );
    await handlers.get(BookmarksChannel.UpdateManual)?.(
      {},
      {
        id: manualBookmarkId,
        label: "Preserved null note through IPC",
      },
    );
    const createdManualResult = (await handlers.get(
      BookmarksChannel.CreateManual,
    )?.({})) as BookmarkManualCreateResult | undefined;
    expect(createdManualResult).toEqual(
      expect.objectContaining({
        bookmark: expect.objectContaining({ category: "manual" }),
        ok: true,
      }),
    );

    expect(
      await handlers.get(BookmarksChannel.ListLibrary)?.(
        {},
        {
          category: "manual",
          game: "poe2",
          league: "Standard",
          pageIndex: 0,
          pageSize: 10,
          sortBy: "label",
          sortDirection: "asc",
        },
      ),
    ).toEqual(
      expect.objectContaining({
        pageIndex: 0,
        pageSize: 10,
        sortBy: "label",
        sortDirection: "asc",
      }),
    );
    expect(
      await handlers.get(BookmarksChannel.ListLibrary)?.({}, undefined),
    ).toEqual(expect.objectContaining({ pageIndex: 0, sortBy: "occurredAt" }));
    expect(
      await handlers.get(BookmarksChannel.ListLibrary)?.({}, { game: "poe2" }),
    ).toEqual(expect.objectContaining({ sortDirection: "desc" }));
    expect(
      await handlers.get(BookmarksChannel.ListActivitySessions)?.(
        {},
        {
          game: "poe2",
          league: "Standard",
          pageIndex: 1,
          pageSize: 10,
          sortBy: "clipCount",
          sortDirection: "asc",
        },
      ),
    ).toEqual(
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 10,
        sortBy: "clipCount",
        sortDirection: "asc",
      }),
    );
    expect(
      await handlers.get(BookmarksChannel.ListActivitySessions)?.(
        {},
        undefined,
      ),
    ).toEqual(expect.objectContaining({ pageIndex: 0, sortBy: "startedAt" }));
    expect(
      await handlers.get(BookmarksChannel.ListActivitySessions)?.(
        {},
        { game: "poe2" },
      ),
    ).toEqual(expect.objectContaining({ sortDirection: "desc" }));
    expect(
      await handlers.get(BookmarksChannel.ListRecording)?.({}, "recording-1", {
        category: "manual",
        includeTimeline: true,
        pageIndex: 0,
        pageSize: 5,
      }),
    ).toEqual(expect.objectContaining({ pageIndex: 0, pageSize: 5 }));
    expect(
      await handlers.get(BookmarksChannel.ListRecording)?.(
        {},
        "recording-1",
        undefined,
      ),
    ).toEqual(expect.objectContaining({ pageIndex: 0, pageSize: 20 }));
    expect(
      await handlers.get(BookmarksChannel.ListRecording)?.(
        {},
        "recording-1",
        {},
      ),
    ).toEqual(expect.objectContaining({ totalCount: 0 }));
    expect(
      await handlers.get(BookmarksChannel.GetActivitySessionTimeline)?.(
        {},
        "missing-session",
      ),
    ).toBeNull();

    await handlers.get(BookmarksChannel.DeleteManual)?.({}, manualBookmarkId);
    await handlers.get(BookmarksChannel.DeleteManual)?.(
      {},
      createdManualResult?.bookmark?.id,
    );

    expect(service.listLibrary({ category: "manual" }).totalCount).toBe(0);
  });
});
