import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { mockIpcMainHandlers } from "~/main/test/ipc";

import { createDefaultSettings } from "~/types";
import { BookmarksService } from "../Bookmarks.service";

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

    expect(
      service.listLibrary({ game: "poe2", pageSize: 10 }).items[0],
    ).toEqual(
      expect.objectContaining({
        activeRecordingDurationSeconds: 120,
        activeRecordingId: "recording-one",
        activeRecordingOffsetSeconds: 10,
        label: "Confluence",
      }),
    );
  });
});
