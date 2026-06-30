import { describe, expect, it } from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";

import { DatabaseService } from "../../database";
import { ReplayClipsRepository } from "../ReplayClips.repository";

describe("ReplayClipsRepository", () => {
  it("filters persisted clips by game, league, and kind", () => {
    const database = new DatabaseService(":memory:");
    const repository = new ReplayClipsRepository(database);
    const deathClip = createReplayClip({
      id: "death-clip",
      kind: "death",
      sourceGame: "poe2",
      sourceLeague: "Standard",
    });
    const manualClip = createReplayClip({
      id: "manual-clip",
      kind: "manual",
      sourceGame: "poe2",
      sourceLeague: "Standard",
    });
    repository.upsert(deathClip);
    repository.upsert(manualClip);
    repository.upsert(
      createReplayClip({
        id: "other-game",
        kind: "manual",
        sourceGame: "poe1",
        sourceLeague: "Standard",
      }),
    );

    expect(
      repository.list({
        game: "poe2",
        kind: "manual",
        league: "Standard",
      }),
    ).toEqual([expect.objectContaining({ id: manualClip.id })]);
    expect(repository.listAll({ league: "Standard" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: deathClip.id }),
        expect.objectContaining({ id: manualClip.id }),
        expect.objectContaining({ id: "other-game" }),
      ]),
    );

    database.close();
  });

  it("returns paged library rows with counts, league options, and persisted sizes", () => {
    const database = new DatabaseService(":memory:");
    const repository = new ReplayClipsRepository(database);
    repository.upsert(
      createReplayClip({
        id: "small",
        kind: "death",
        processedClipPath: "C:/clips/small.mp4",
        sourceGame: "poe2",
        sourceLeague: "Standard",
        sizeBytes: 10,
        createdAt: "2026-06-12T10:00:00.000Z",
      }),
    );
    const large = createReplayClip({
      id: "large",
      kind: "death",
      processedClipPath: "C:/clips/large.mp4",
      sourceGame: "poe2",
      sourceLeague: "Hardcore",
      sizeBytes: 30,
      createdAt: "2026-06-12T11:00:00.000Z",
    });
    repository.upsert(large);
    const manual = createReplayClip({
      id: "manual",
      kind: "manual",
      processedClipPath: "C:/clips/manual.mp4",
      sourceGame: "poe2",
      sourceLeague: "Standard",
      sizeBytes: 50,
      triggerLineHash: "manual-hash",
      createdAt: "2026-06-12T12:00:00.000Z",
    });
    repository.upsert(manual);

    expect(
      repository.listLibraryPage({
        filter: { game: "poe2", kind: "death" },
        pageIndex: 0,
        pageSize: 1,
        sortBy: "sizeBytes",
        sortDirection: "desc",
      }),
    ).toEqual({
      totalCount: 2,
      items: [expect.objectContaining({ id: "large", sizeBytes: 30 })],
    });
    expect(repository.listLeagues({ game: "poe2", kind: "death" })).toEqual([
      "Hardcore",
      "Standard",
    ]);
    expect(
      repository
        .listLibraryPage({
          filter: {
            createdAfter: "2026-06-12T11:30:00.000Z",
            excludeIds: [large.id],
            includeIds: [large.id, manual.id],
          },
          pageIndex: 0,
          pageSize: 10,
          sortBy: "createdAt",
          sortDirection: "desc",
        })
        .items.map((clip) => clip.id),
    ).toEqual([manual.id]);
    expect(
      repository.listLibraryPage({
        pageIndex: 0,
        pageSize: 10,
        sortBy: "createdAt",
        sortDirection: "desc",
      }).totalCount,
    ).toBe(3);
    expect(repository.count()).toBe(3);

    repository.updateSize("small", 40);
    expect(repository.get("small")).toEqual(
      expect.objectContaining({ sizeBytes: 40 }),
    );
    expect(repository.listMissingSizeClips({ game: "poe2" })).toEqual([]);
    expect(repository.listStoragePaths()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "small" }),
        expect.objectContaining({ id: "large" }),
      ]),
    );
    expect(repository.listStorageUsage()).toEqual(
      expect.arrayContaining([
        {
          clipCount: 1,
          game: "poe2",
          leagueName: "Hardcore",
          sizeBytes: 30,
        },
        {
          clipCount: 2,
          game: "poe2",
          leagueName: "Standard",
          sizeBytes: 90,
        },
      ]),
    );
    expect(repository.getByTriggerLineHash("manual-hash")).toEqual(
      expect.objectContaining({ id: "manual" }),
    );

    database.close();
  });

  it("deletes persisted clips by id", () => {
    const database = new DatabaseService(":memory:");
    const repository = new ReplayClipsRepository(database);
    const clip = createReplayClip({
      originalObsPath: "C:/clips/source.mp4",
      processedClipPath: "C:/clips/source-death-10s.mp4",
    });

    repository.upsert(clip);
    expect(repository.get(clip.id)?.id).toBe(clip.id);

    repository.delete(clip.id);
    expect(repository.get(clip.id)).toBeNull();

    database.close();
  });
});
