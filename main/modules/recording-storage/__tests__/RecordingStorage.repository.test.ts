import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DatabaseService } from "../../database";
import { RecordingStorageRepository } from "../RecordingStorage.repository";

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
    repository.upsertRunRecording({
      path: "recordings/large.mkv",
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      startedAt: "2026-06-12T11:00:00.000Z",
      stoppedAt: "2026-06-12T11:05:00.000Z",
      mtimeMs: 10,
      sizeBytes: 30,
    });
    repository.upsertRunRecording({
      path: "recordings/other-game.mkv",
      sourceGame: "poe1",
      sourceLeague: "Standard",
      startedAt: "2026-06-12T12:00:00.000Z",
      stoppedAt: "2026-06-12T12:05:00.000Z",
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
    expect(
      repository.selectCleanupCandidates({
        limitBytes: 20,
        protectedPaths: [small.path],
      }),
    ).toMatchObject({
      files: [
        expect.objectContaining({ path: resolve("recordings/large.mkv") }),
        expect.objectContaining({
          path: resolve("recordings/other-game.mkv"),
        }),
      ],
      freedBytes: 80,
      usageBytes: 80,
    });

    repository.updateFileState(small.path, { exists: false, sizeBytes: 0 });
    expect(repository.getItemById(small.id)).toEqual(
      expect.objectContaining({ exists: false, sizeBytes: 0 }),
    );

    database.close();
  });
});
