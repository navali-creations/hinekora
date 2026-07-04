import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { mockIpcMainHandlers } from "~/main/test/ipc";

import type { ReplayClip } from "~/types";
import { createDefaultSettings } from "~/types";
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
        activeRecordingDurationSeconds: 120,
        activeRecordingId: "recording-one",
        activeRecordingOffsetSeconds: 10,
        label: "Confluence",
      }),
    );
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
        activeRecordingDurationSeconds: null,
        activeRecordingId: null,
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
        activeActivitySessionId: session.id,
        activeActivitySessionOffsetSeconds: 20,
        category: "rewind-manual-replay",
      }),
      expect.objectContaining({
        activeActivitySessionId: session.id,
        activeActivitySessionOffsetSeconds: 5,
        category: "town",
      }),
    ]);
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

    service.deleteReplayClipLinks("death-clip");

    expect(service.listActivitySessionTimeline(session.id)?.clips).toEqual([]);
    expect(
      service
        .listActivitySessionTimeline(session.id)
        ?.bookmarks.map((bookmark) => bookmark.category),
    ).toEqual(["death"]);
  });
});
