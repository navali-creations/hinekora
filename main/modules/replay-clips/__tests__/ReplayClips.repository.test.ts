import { join, resolve } from "node:path";

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
    const manualReplay = createReplayClip({
      id: "manual-clip",
      kind: "manual",
      sourceGame: "poe2",
      sourceLeague: "Standard",
    });
    repository.upsert(deathClip);
    repository.upsert(manualReplay);
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
    ).toEqual([expect.objectContaining({ id: manualReplay.id })]);
    expect(repository.listAll({ league: "Standard" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: deathClip.id }),
        expect.objectContaining({ id: manualReplay.id }),
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

  it("rebases persisted storage paths after media directory migration", () => {
    const database = new DatabaseService(":memory:");
    const repository = new ReplayClipsRepository(database);
    const legacyDirectory = join("C:", "Recordings", "Manual Clips");
    const canonicalDirectory = join("C:", "Recordings", "Manual Replays");
    const legacyPath = join(legacyDirectory, "manual.mp4");
    const movedPath = join(canonicalDirectory, "manual.mp4");
    const unrelatedPath = join("C:", "Recordings", "Death Clips", "death.mp4");
    repository.upsert(
      createReplayClip({
        id: "manual",
        originalObsPath: legacyPath,
        processedClipPath: legacyPath,
      }),
    );
    repository.upsert(
      createReplayClip({
        id: "death",
        originalObsPath: unrelatedPath,
        processedClipPath: unrelatedPath,
      }),
    );

    expect(
      repository.rebaseStoragePaths([
        {
          from: legacyDirectory,
          to: canonicalDirectory,
        },
      ]),
    ).toBe(1);

    expect(repository.get("manual")).toEqual(
      expect.objectContaining({
        originalObsPath: resolve(movedPath),
        processedClipPath: resolve(movedPath),
      }),
    );
    expect(repository.get("death")).toEqual(
      expect.objectContaining({
        originalObsPath: unrelatedPath,
        processedClipPath: unrelatedPath,
      }),
    );

    database.close();
  });

  it("rebases exact storage roots and preserves null storage paths", () => {
    const database = new DatabaseService(":memory:");
    const repository = new ReplayClipsRepository(database);
    const legacyDirectory = join("C:", "Recordings", "Manual Clips");
    const canonicalDirectory = join("C:", "Recordings", "Manual Replays");
    repository.upsert(
      createReplayClip({
        id: "manual-root",
        originalObsPath: legacyDirectory,
        processedClipPath: null,
      }),
    );

    expect(repository.rebaseStoragePaths([])).toBe(0);
    expect(
      repository.rebaseStoragePaths([
        {
          from: legacyDirectory,
          to: canonicalDirectory,
        },
      ]),
    ).toBe(1);

    expect(repository.get("manual-root")).toEqual(
      expect.objectContaining({
        originalObsPath: resolve(canonicalDirectory),
        processedClipPath: null,
      }),
    );

    database.close();
  });

  it("uses the nearest storage path migration when migrations overlap", () => {
    const database = new DatabaseService(":memory:");
    const repository = new ReplayClipsRepository(database);
    const legacyDirectory = join("C:", "Recordings", "Manual Clips");
    const legacyNestedDirectory = join(legacyDirectory, "nested");
    const canonicalDirectory = join("C:", "Recordings", "Manual Replays");
    const canonicalNestedDirectory = join(canonicalDirectory, "nested (2)");
    const legacyPath = join(legacyNestedDirectory, "manual.mp4");
    repository.upsert(
      createReplayClip({
        id: "manual-nested",
        originalObsPath: legacyPath,
        processedClipPath: null,
      }),
    );

    expect(
      repository.rebaseStoragePaths([
        {
          from: legacyDirectory,
          to: canonicalDirectory,
        },
        {
          from: legacyNestedDirectory,
          to: canonicalNestedDirectory,
        },
      ]),
    ).toBe(1);

    expect(repository.get("manual-nested")).toEqual(
      expect.objectContaining({
        originalObsPath: resolve(join(canonicalNestedDirectory, "manual.mp4")),
      }),
    );

    database.close();
  });

  it("uses the first storage path migration when duplicate sources are provided", () => {
    const database = new DatabaseService(":memory:");
    const repository = new ReplayClipsRepository(database);
    const legacyDirectory = join("C:", "Recordings", "Manual Clips");
    const canonicalDirectory = join("C:", "Recordings", "Manual Replays");
    const duplicateCanonicalDirectory = join(
      "C:",
      "Recordings",
      "Manual Replays Duplicate",
    );
    const legacyPath = join(legacyDirectory, "manual.mp4");
    repository.upsert(
      createReplayClip({
        id: "manual-duplicate-source",
        originalObsPath: legacyPath,
        processedClipPath: null,
      }),
    );

    expect(
      repository.rebaseStoragePaths([
        {
          from: legacyDirectory,
          to: canonicalDirectory,
        },
        {
          from: legacyDirectory,
          to: duplicateCanonicalDirectory,
        },
      ]),
    ).toBe(1);

    expect(repository.get("manual-duplicate-source")).toEqual(
      expect.objectContaining({
        originalObsPath: resolve(join(canonicalDirectory, "manual.mp4")),
      }),
    );

    database.close();
  });
});
