import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DatabaseService } from "../../database";
import { RecordingStorageRepository } from "../RecordingStorage.repository";

function listRecordingItems(repository: RecordingStorageRepository) {
  return repository.listLibraryPage({
    pageIndex: 0,
    pageSize: 100,
    sortBy: "createdAt",
    sortDirection: "desc",
  }).items;
}

describe("RecordingStorageRepository", () => {
  it("upserts run recording metadata by normalized path", () => {
    const database = new DatabaseService(":memory:");
    const repository = new RecordingStorageRepository(database);
    const path = "recordings/run-one.mkv";

    const created = repository.upsertRunRecording({
      path,
      sourceGame: "poe1",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:00:00.000Z",
      stoppedAt: "2026-06-12T10:10:00.000Z",
    });

    expect(created).toMatchObject({
      path: resolve(path),
      sourceGame: "poe1",
      sourceLeague: "Standard",
    });

    const updated = repository.upsertRunRecording({
      path,
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T11:20:00.000Z",
    });

    expect(updated).toMatchObject({
      id: created.id,
      path: resolve(path),
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T11:20:00.000Z",
    });
    expect(repository.listRunRecordings()).toEqual([updated]);
    expect(repository.getByPath(path)).toEqual(updated);
    expect(repository.getByPath("recordings/missing.mkv")).toBeNull();
    expect(repository.deleteRunRecordingByPath(path)).toBe(true);
    expect(repository.listRunRecordings()).toEqual([]);
    expect(repository.deleteRunRecordingByPath(path)).toBe(false);

    database.close();
  });

  it("returns paged library rows and updates file state", () => {
    const database = new DatabaseService(":memory:");
    const repository = new RecordingStorageRepository(database);

    const small = repository.upsertRunRecording({
      path: "recordings/small.mkv",
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:00:00.000Z",
      stoppedAt: "2026-06-12T10:01:00.000Z",
      mtimeMs: 20,
      sizeBytes: 10,
    });
    const large = repository.upsertRunRecording({
      path: "recordings/large.mkv",
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T11:05:00.000Z",
      createdAt: "2026-06-12T11:00:00.000Z",
      mtimeMs: 10,
      sizeBytes: 30,
    });
    const otherGame = repository.upsertRunRecording({
      path: "recordings/other-game.mkv",
      sourceGame: "poe1",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T12:00:00.000Z",
      stoppedAt: "2026-06-12T12:05:00.000Z",
      createdAt: "2026-06-12T12:00:00.000Z",
      mtimeMs: 30,
      sizeBytes: 50,
    });

    expect(
      repository.listLibraryPage({
        filter: { game: "poe2" },
        pageIndex: 0,
        pageSize: 1,
        sortBy: "sizeBytes",
        sortDirection: "desc",
      }),
    ).toEqual({
      totalCount: 2,
      items: [
        expect.objectContaining({
          fileName: "large.mkv",
          sizeBytes: 30,
        }),
      ],
    });
    expect(repository.listLeagues({ game: "poe2" })).toEqual([
      "Hardcore",
      "Standard",
    ]);
    expect(
      repository
        .listLibraryPage({
          filter: {
            createdAfter: "2026-06-12T11:30:00.000Z",
            excludeIds: [large.id],
            includeIds: [large.id, otherGame.id],
          },
          pageIndex: 0,
          pageSize: 10,
          sortBy: "createdAt",
          sortDirection: "desc",
        })
        .items.map((recording) => recording.id),
    ).toEqual([otherGame.id]);
    expect(repository.listStorageUsage()).toEqual(
      expect.arrayContaining([
        {
          game: "poe2",
          leagueName: "Hardcore",
          recordingCount: 1,
          sizeBytes: 30,
        },
        {
          game: "poe2",
          leagueName: "Standard",
          recordingCount: 1,
          sizeBytes: 10,
        },
      ]),
    );
    expect(repository.listStorageEntriesPage(null, 100)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: resolve("recordings/large.mkv") }),
        expect.objectContaining({ path: resolve("recordings/other-game.mkv") }),
        expect.objectContaining({ path: small.path }),
      ]),
    );

    repository.updateFileState(small.path, { exists: false, sizeBytes: 0 });
    expect(repository.getItemById(small.id)).toEqual(
      expect.objectContaining({ exists: false, sizeBytes: 0 }),
    );
    expect(
      repository
        .listRunRecordingSyncItems()
        .find((item) => item.path === small.path),
    ).toEqual(expect.objectContaining({ exists: false, sizeBytes: 0 }));
    repository.updateFileState(small.path, { exists: true, sizeBytes: 12 });
    expect(repository.getItemById(small.id)).toEqual(
      expect.objectContaining({ exists: true, sizeBytes: 12 }),
    );
    expect(
      repository
        .listRunRecordingSyncItems()
        .find((item) => item.path === small.path),
    ).toEqual(
      expect.objectContaining({ exists: true, mtimeMs: 0, sizeBytes: 12 }),
    );
    database.db
      .prepare("UPDATE run_recordings SET file_name = '' WHERE id = ?")
      .run(small.id);
    expect(repository.getItemById(small.id)).toEqual(
      expect.objectContaining({ fileName: "small.mkv" }),
    );
    expect(
      repository.listLibraryPage({
        pageIndex: 0,
        pageSize: 10,
        sortBy: "createdAt",
        sortDirection: "desc",
      }).totalCount,
    ).toBe(3);

    database.close();
  });

  it("handles invalid durations and cleanup target boundaries", () => {
    const database = new DatabaseService(":memory:");
    const repository = new RecordingStorageRepository(database);

    repository.upsertRunRecording({
      path: "recordings/invalid-duration.mkv",
      sourceGame: "poe1",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T10:00:00.000Z",
      stoppedAt: "2026-06-12T09:59:00.000Z",
      durationSeconds: 12.3456,
      mtimeMs: 10,
      sizeBytes: 50,
    });
    repository.upsertRunRecording({
      path: "recordings/small-extra.mkv",
      sourceGame: "poe1",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T11:01:00.000Z",
      mtimeMs: 20,
      sizeBytes: 10,
    });

    expect(
      listRecordingItems(repository).find((item) =>
        item.path.endsWith("invalid-duration.mkv"),
      ),
    ).toEqual(expect.objectContaining({ durationSeconds: 12.346 }));
    repository.updateFileState("recordings/invalid-duration.mkv", {
      durationSeconds: null,
      exists: true,
      sizeBytes: 50,
    });
    expect(
      listRecordingItems(repository).find((item) =>
        item.path.endsWith("invalid-duration.mkv"),
      ),
    ).toEqual(expect.objectContaining({ durationSeconds: null }));
    expect(repository.listStorageEntriesPage(null, 100)).toEqual([
      expect.objectContaining({
        path: resolve("recordings/invalid-duration.mkv"),
        size: 50,
      }),
      expect.objectContaining({
        path: resolve("recordings/small-extra.mkv"),
        size: 10,
      }),
    ]);
    const firstStoragePage = repository.listStorageEntriesPage(null, 1);
    expect(
      repository.listStorageEntriesPage(
        {
          mtimeMs: firstStoragePage[0]!.mtimeMs,
          path: firstStoragePage[0]!.path,
        },
        1,
      ),
    ).toEqual([
      expect.objectContaining({ path: resolve("recordings/small-extra.mkv") }),
    ]);
    repository.updateFileState("recordings/invalid-duration.mkv", {
      durationSeconds: 60,
      exists: false,
      sizeBytes: 0,
    });
    expect(
      listRecordingItems(repository).find((item) =>
        item.path.endsWith("invalid-duration.mkv"),
      ),
    ).toEqual(expect.objectContaining({ durationSeconds: null }));

    database.close();
  });

  it("tracks pending and completed storage path migrations", () => {
    const database = new DatabaseService(":memory:");
    const repository = new RecordingStorageRepository(database);
    const legacyPath = "recordings/Manual Clips/manual.mp4";
    const canonicalPath = "recordings/Manual Replays/manual.mp4";
    const renamedPath = "recordings/Manual Replays/manual (2).mp4";

    repository.savePendingStoragePathMigrations([
      {
        from: legacyPath,
        to: canonicalPath,
      },
    ]);
    repository.savePendingStoragePathMigrations([
      {
        from: legacyPath,
        to: renamedPath,
      },
    ]);

    expect(repository.listPendingStoragePathMigrations()).toEqual([
      {
        from: resolve(legacyPath),
        to: resolve(renamedPath),
      },
    ]);

    repository.markStoragePathMigrationsCompleted([]);
    expect(repository.listPendingStoragePathMigrations()).toHaveLength(1);

    repository.markStoragePathMigrationsCompleted([
      {
        from: legacyPath,
        to: renamedPath,
      },
    ]);
    expect(repository.listPendingStoragePathMigrations()).toEqual([]);

    database.close();
  });
});
