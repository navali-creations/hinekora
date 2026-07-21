import type { SQLInputValue } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { DatabaseService } from "~/main/modules/database";

import {
  createEditorProjectSummary,
  mapEditorProjectRow,
} from "../EditorProject.mapper";
import { EditorProjectRepository } from "../EditorProject.repository";
import {
  createEditorMediaAsset,
  createEditorProject,
  createEditorVideoTrackForAssets,
} from "./Editor.test-factories";

let database: DatabaseService | null = null;

function explainQueryPlan(sql: string, ...params: SQLInputValue[]): string[] {
  if (!database) {
    throw new Error("Expected test database to be initialized");
  }

  const rows = database.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);

  return rows.map((row) => String((row as { detail: unknown }).detail));
}

function expectQueryPlanToUseIndex(details: string[], indexName: string): void {
  expect(details.some((detail) => detail.includes(indexName))).toBe(true);
}

function createRepository(): EditorProjectRepository {
  database = new DatabaseService(":memory:");

  return new EditorProjectRepository(database);
}

function insertStoredProjectJson(
  id: string,
  projectJson: string,
  metadata: {
    historyEditCount?: number;
    sourceGame?: string | null;
    sourceLeague?: string | null;
    sourceSizeBytes?: number;
  } = {},
): void {
  database?.db
    .prepare(
      `
      INSERT INTO editor_projects (
        id,
        title,
        duration_seconds,
        clip_count,
        history_edit_count,
        project_json,
        source_game,
        source_league,
        source_size_bytes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      id,
      0,
      0,
      metadata.historyEditCount ?? 0,
      projectJson,
      metadata.sourceGame ?? null,
      metadata.sourceLeague ?? null,
      metadata.sourceSizeBytes ?? 0,
      "2026-06-18T00:00:00.000Z",
      "2026-06-18T00:00:00.000Z",
    );
}

function seedLargeSavedEditLibrary(projectCount: number): {
  poe2RunesCount: number;
  poe2StandardCount: number;
  seedMs: number;
} {
  if (!database) {
    throw new Error("Expected test database to be initialized");
  }

  const insertProject = database.db.prepare(`
    INSERT INTO editor_projects (
      id,
      title,
      duration_seconds,
      clip_count,
      history_edit_count,
      project_json,
      source_game,
      source_league,
      source_size_bytes,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMembership = database.db.prepare(`
    INSERT INTO editor_project_source_leagues (
      project_id,
      source_game,
      source_league
    )
    VALUES (?, ?, ?)
  `);
  const projectJson = JSON.stringify(
    createEditorProject({ id: "seed-project" }),
  );
  let poe2RunesCount = 0;
  let poe2StandardCount = 0;
  const seedStartedAt = performance.now();

  database.transaction(() => {
    for (let index = 0; index < projectCount; index += 1) {
      const id = `large-project-${index.toString().padStart(5, "0")}`;
      const timestamp = new Date(
        Date.UTC(2026, 5, 18, 0, 0, index),
      ).toISOString();
      const isPoe1 = index % 7 === 0;
      const isMixedPoe2 = !isPoe1 && index % 10 === 0;
      const sourceGame = isPoe1 ? "poe1" : "poe2";
      const sourceLeague =
        isMixedPoe2 || index % 4 === 0 ? "Runes of Aldur" : "Standard";
      const summaryLeague = isMixedPoe2 ? null : sourceLeague;

      insertProject.run(
        id,
        `Large saved edit ${index.toString().padStart(5, "0")}`,
        5 + (index % 180),
        1 + (index % 6),
        index % 50,
        projectJson,
        sourceGame,
        summaryLeague,
        1024 * (1 + (index % 1000)),
        timestamp,
        timestamp,
      );

      if (isMixedPoe2) {
        insertMembership.run(id, "poe2", "Runes of Aldur");
        insertMembership.run(id, "poe2", "Standard");
        poe2RunesCount += 1;
        poe2StandardCount += 1;
      } else {
        insertMembership.run(id, sourceGame, sourceLeague);
        if (sourceGame === "poe2" && sourceLeague === "Runes of Aldur") {
          poe2RunesCount += 1;
        }
        if (sourceGame === "poe2" && sourceLeague === "Standard") {
          poe2StandardCount += 1;
        }
      }
    }
  });

  return {
    poe2RunesCount,
    poe2StandardCount,
    seedMs: performance.now() - seedStartedAt,
  };
}

function timeSavedEditPageQuery<T>(
  label: string,
  query: () => T,
): {
  label: string;
  ms: number;
  result: T;
} {
  const startedAt = performance.now();
  const result = query();

  return {
    label,
    ms: performance.now() - startedAt,
    result,
  };
}

describe("EditorProjectRepository", () => {
  afterEach(() => {
    database?.close();
    database = null;
  });

  it("upserts, lists, loads, and deletes editor projects", () => {
    const repository = createRepository();
    const project = createEditorProject();
    const baseClip = project.tracks[0]?.clips[0];
    if (!baseClip) {
      throw new Error("Expected test project to include a clip");
    }
    const updatedProject = createEditorProject({
      durationSeconds: 4,
      id: project.id,
      title: "Trimmed edit",
      tracks: [
        {
          clips: [
            {
              ...baseClip,
              durationSeconds: 4,
              outSeconds: 4,
            },
          ],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
      updatedAt: "2026-06-18T01:00:00.000Z",
    });
    const secondProject = createEditorProject({
      id: "project-2",
      title: "Older edit",
      updatedAt: "2026-06-18T00:30:00.000Z",
    });

    repository.upsert(project);
    repository.upsert(secondProject);
    repository.upsert(updatedProject);

    expect(repository.get(project.id)).toMatchObject({
      durationSeconds: 4,
      id: project.id,
      title: "Trimmed edit",
      tracks: [{ clips: [{ durationSeconds: 4, outSeconds: 4 }] }],
      updatedAt: "2026-06-18T01:00:00.000Z",
    });
    expect(createEditorProjectSummary(updatedProject)).toEqual({
      clipCount: 1,
      createdAt: "2026-06-18T00:00:00.000Z",
      durationSeconds: 4,
      id: project.id,
      title: "Trimmed edit",
      updatedAt: "2026-06-18T01:00:00.000Z",
    });
    expect(repository.list({ limit: 10 })).toEqual({
      hasMore: false,
      projects: [
        {
          clipCount: 1,
          createdAt: "2026-06-18T00:00:00.000Z",
          durationSeconds: 4,
          id: project.id,
          title: "Trimmed edit",
          updatedAt: "2026-06-18T01:00:00.000Z",
        },
        {
          clipCount: 1,
          createdAt: "2026-06-18T00:00:00.000Z",
          durationSeconds: 10,
          id: "project-2",
          title: "Older edit",
          updatedAt: "2026-06-18T00:30:00.000Z",
        },
      ],
    });
    expect(repository.list({ limit: 1 })).toEqual({
      hasMore: true,
      projects: [
        {
          clipCount: 1,
          createdAt: "2026-06-18T00:00:00.000Z",
          durationSeconds: 4,
          id: project.id,
          title: "Trimmed edit",
          updatedAt: "2026-06-18T01:00:00.000Z",
        },
      ],
    });
    expect(
      repository.listPage({
        pageIndex: 0,
        pageSize: 1,
        sortBy: "title",
        sortDirection: "asc",
      }),
    ).toEqual({
      projects: [
        {
          clipCount: 1,
          createdAt: "2026-06-18T00:00:00.000Z",
          durationSeconds: 10,
          id: "project-2",
          title: "Older edit",
          updatedAt: "2026-06-18T00:30:00.000Z",
        },
      ],
      totalCount: 2,
    });
    expect(
      repository.listPage({
        pageIndex: 0,
        pageSize: 10,
        sortBy: "clipCount",
        sortDirection: "desc",
      }).totalCount,
    ).toBe(2);
    expect(
      repository.listPage({
        pageIndex: 0,
        pageSize: 10,
        sortBy: "createdAt",
        sortDirection: "asc",
      }).totalCount,
    ).toBe(2);
    expect(
      repository.listPage({
        pageIndex: 0,
        pageSize: 10,
        sortBy: "durationSeconds",
        sortDirection: "desc",
      }).totalCount,
    ).toBe(2);
    expect(
      repository.listPage({
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }).totalCount,
    ).toBe(2);
    expect(repository.listAll().map((savedProject) => savedProject.id)).toEqual(
      [project.id, "project-2"],
    );

    repository.delete(project.id);

    expect(repository.get(project.id)).toBeNull();
    expect(repository.list({ limit: 10 }).projects).toHaveLength(1);

    repository.deleteAll();

    expect(repository.list({ limit: 10 }).projects).toEqual([]);
  });

  it("deletes saved projects past the newest limit while preserving a protected project", () => {
    const repository = createRepository();

    for (let index = 0; index < 7; index += 1) {
      const asset = createEditorMediaAsset({
        assetKey: `clip:project-${index}`,
        id: `clip-project-${index}`,
        sourceLeague: index === 1 ? "Pruned League" : "Standard",
      });
      const track = createEditorVideoTrackForAssets([asset]);
      repository.upsert(
        createEditorProject({
          activeClipId: track.clips[0]?.id ?? null,
          assets: [asset],
          id: `project-${index}`,
          selectedAssetKey: asset.assetKey,
          title: `Saved edit ${index}`,
          tracks: [track],
          updatedAt: `2026-06-18T00:0${index}:00.000Z`,
        }),
      );
    }

    expect(
      repository.deleteOlderThanLimit({
        limit: 5,
        protectedProjectId: "project-0",
      }),
    ).toBe(2);

    expect(
      repository.list({ limit: 10 }).projects.map((project) => project.id),
    ).toEqual([
      "project-6",
      "project-5",
      "project-4",
      "project-3",
      "project-0",
    ]);
    expect(repository.get("project-2")).toBeNull();
    expect(repository.get("project-1")).toBeNull();
    expect(repository.get("project-0")).not.toBeNull();
    expect(
      repository.listSavedEditPage({
        game: "poe2",
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }).availableLeagues,
    ).toEqual(["Standard"]);
  });

  it("lists saved edit pages with filters and source media size summaries", () => {
    const repository = createRepository();
    const firstRunesAsset = createEditorMediaAsset({
      assetKey: "clip:runes-first",
      id: "runes-first",
      sizeBytes: 2048,
      sourceGame: "poe2",
      sourceLeague: "Runes of Aldur",
    });
    const secondRunesAsset = createEditorMediaAsset({
      assetKey: "clip:runes-second",
      id: "runes-second",
      sizeBytes: 4096,
      sourceGame: "poe2",
      sourceLeague: "Runes of Aldur",
    });
    const poe2StandardAsset = createEditorMediaAsset({
      assetKey: "clip:poe2-standard",
      sourceGame: "poe2",
      sourceLeague: "Standard",
    });
    const poe1StandardAsset = createEditorMediaAsset({
      assetKey: "clip:poe1-standard",
      sourceGame: "poe1",
      sourceLeague: "Standard",
    });
    repository.upsert(
      createEditorProject({
        assets: [firstRunesAsset, secondRunesAsset, { ...firstRunesAsset }],
        history: { editCount: 2, labels: ["Split", "Clear gaps"] },
        id: "runes-project",
        title: "Runes edit",
        tracks: [
          createEditorVideoTrackForAssets([firstRunesAsset, secondRunesAsset]),
        ],
        updatedAt: "2026-06-18T00:03:00.000Z",
      }),
    );
    repository.upsert(
      createEditorProject({
        assets: [poe2StandardAsset],
        id: "poe2-standard-project",
        title: "Standard edit",
        tracks: [createEditorVideoTrackForAssets([poe2StandardAsset])],
        updatedAt: "2026-06-18T00:02:00.000Z",
      }),
    );
    repository.upsert(
      createEditorProject({
        assets: [poe1StandardAsset],
        id: "poe1-standard-project",
        title: "PoE 1 edit",
        tracks: [createEditorVideoTrackForAssets([poe1StandardAsset])],
        updatedAt: "2026-06-18T00:01:00.000Z",
      }),
    );

    expect(
      repository.listSavedEditPage({
        game: "poe2",
        league: "Runes of Aldur",
        pageIndex: 0,
        pageSize: 10,
        sortBy: "sizeBytes",
        sortDirection: "desc",
      }),
    ).toEqual({
      availableLeagues: ["Runes of Aldur", "Standard"],
      globalTotalCount: 3,
      projects: [
        {
          clipCount: 2,
          createdAt: "2026-06-18T00:00:00.000Z",
          durationSeconds: 10,
          historyEditCount: 2,
          id: "runes-project",
          sizeBytes: 6144,
          sourceGame: "poe2",
          sourceLeague: "Runes of Aldur",
          title: "Runes edit",
          updatedAt: "2026-06-18T00:03:00.000Z",
        },
      ],
      totalCount: 1,
    });
    expect(
      repository
        .listSavedEditPage({
          league: "Standard",
          pageIndex: 0,
          pageSize: 10,
          sortBy: "updatedAt",
          sortDirection: "asc",
        })
        .projects.map((project) => project.id),
    ).toEqual(["poe1-standard-project", "poe2-standard-project"]);
    expect(
      repository
        .listSavedEditPage({
          pageIndex: 1,
          pageSize: 1,
          sortBy: "updatedAt",
          sortDirection: "desc",
        })
        .projects.map((project) => project.id),
    ).toEqual(["poe2-standard-project"]);
    expect(
      repository.listSavedEditPage({
        pageIndex: 0,
        pageSize: 1,
        sortBy: "historyEditCount",
        sortDirection: "desc",
      }).projects[0],
    ).toMatchObject({
      historyEditCount: 2,
      id: "runes-project",
    });
    expect(
      repository.listSavedEditPage({
        pageIndex: 0,
        pageSize: 1,
        sortBy: "createdAt",
        sortDirection: "asc",
      }).projects[0],
    ).toMatchObject({ createdAt: "2026-06-18T00:00:00.000Z" });
    expect(
      repository.listSavedEditPage({
        pageIndex: 0,
        pageSize: 1,
        sortBy: "durationSeconds",
        sortDirection: "desc",
      }).projects[0],
    ).toMatchObject({ durationSeconds: 10 });
  });

  it("keeps seeded large-library saved edit page queries bounded", () => {
    const repository = createRepository();
    const projectCount = 5_000;
    const seed = seedLargeSavedEditLibrary(projectCount);

    const timings = [
      timeSavedEditPageQuery("all-updated", () =>
        repository.listSavedEditPage({
          pageIndex: 0,
          pageSize: 25,
          sortBy: "updatedAt",
          sortDirection: "desc",
        }),
      ),
      timeSavedEditPageQuery("poe2-standard-updated", () =>
        repository.listSavedEditPage({
          game: "poe2",
          league: "Standard",
          pageIndex: 0,
          pageSize: 25,
          sortBy: "updatedAt",
          sortDirection: "desc",
        }),
      ),
      timeSavedEditPageQuery("poe2-runes-size", () =>
        repository.listSavedEditPage({
          game: "poe2",
          league: "Runes of Aldur",
          pageIndex: 0,
          pageSize: 25,
          sortBy: "sizeBytes",
          sortDirection: "desc",
        }),
      ),
      timeSavedEditPageQuery("league-title", () =>
        repository.listSavedEditPage({
          league: "Standard",
          pageIndex: 0,
          pageSize: 25,
          sortBy: "title",
          sortDirection: "asc",
        }),
      ),
    ];

    expect(timings[0]?.result).toMatchObject({
      globalTotalCount: projectCount,
      projects: expect.arrayContaining([
        expect.objectContaining({ id: "large-project-04999" }),
      ]),
      totalCount: projectCount,
    });
    expect(timings[1]?.result).toMatchObject({
      availableLeagues: ["Runes of Aldur", "Standard"],
      totalCount: seed.poe2StandardCount,
    });
    expect(timings[2]?.result).toMatchObject({
      availableLeagues: ["Runes of Aldur", "Standard"],
      totalCount: seed.poe2RunesCount,
    });
    expect(timings[3]?.result.projects).toHaveLength(25);

    expect(Math.max(...timings.map(({ ms }) => ms))).toBeLessThan(250);
    expectQueryPlanToUseIndex(
      explainQueryPlan(
        `
        SELECT id
        FROM editor_projects
        ORDER BY updated_at DESC, id ASC
        LIMIT ? OFFSET ?
      `,
        25,
        0,
      ),
      "idx_editor_projects_saved_edits_all_updated",
    );
    expectQueryPlanToUseIndex(
      explainQueryPlan(
        `
        SELECT id
        FROM editor_projects
        WHERE EXISTS (
          SELECT 1
          FROM editor_project_source_leagues AS source_scope
          WHERE source_scope.project_id = editor_projects.id
            AND source_scope.source_game = ?
            AND source_scope.source_league = ?
        )
        ORDER BY updated_at DESC, id ASC
        LIMIT ? OFFSET ?
      `,
        "poe2",
        "Standard",
        25,
        0,
      ),
      "idx_editor_projects_saved_edits_all_updated",
    );
    expectQueryPlanToUseIndex(
      explainQueryPlan(
        `
        SELECT DISTINCT source_league
        FROM editor_project_source_leagues
        WHERE source_game = ?
        ORDER BY source_league ASC
      `,
        "poe2",
      ),
      "idx_editor_project_source_leagues_scope",
    );
  });

  it("maps saved edit summaries with unknown source games as unscoped", () => {
    const repository = createRepository();
    insertStoredProjectJson(
      "unknown-game-project",
      JSON.stringify({
        ...createEditorProject({ id: "unknown-game-project" }),
        assets: [
          createEditorMediaAsset({
            sourceGame: "poe3" as never,
            sourceLeague: "Mystery",
          }),
        ],
      }),
      { sourceGame: "poe3", sourceLeague: "Mystery" },
    );

    expect(
      repository.listSavedEditPage({
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }).projects[0],
    ).toMatchObject({
      id: "unknown-game-project",
      sourceGame: null,
      sourceLeague: "Mystery",
    });
  });

  it("derives saved edit source scope from timeline assets", () => {
    const repository = createRepository();
    const timelineAsset = createEditorMediaAsset({
      assetKey: "clip:timeline-poe1",
      sourceGame: "poe1",
      sourceLeague: "Standard",
    });
    repository.upsert(
      createEditorProject({
        assets: [timelineAsset],
        id: "explicit-scope-project",
        sourceGame: "poe2",
        sourceLeague: "Runes of Aldur",
        tracks: [createEditorVideoTrackForAssets([timelineAsset])],
      }),
    );

    expect(
      repository.listSavedEditPage({
        game: "poe1",
        league: "Standard",
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }).projects,
    ).toEqual([
      expect.objectContaining({
        id: "explicit-scope-project",
        sourceGame: "poe1",
        sourceLeague: "Standard",
      }),
    ]);
  });

  it("shows same-game mixed-league saved edits in every source league filter", () => {
    const repository = createRepository();
    const standardAsset = createEditorMediaAsset({
      assetKey: "clip:poe2-standard",
      sourceGame: "poe2",
      sourceLeague: "Standard",
    });
    const runesAsset = createEditorMediaAsset({
      assetKey: "clip:poe2-runes",
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

    expect(
      repository.listSavedEditPage({
        game: "poe2",
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }),
    ).toMatchObject({
      availableLeagues: ["Runes of Aldur", "Standard"],
      projects: [
        expect.objectContaining({
          id: "mixed-league-project",
          sourceGame: "poe2",
          sourceLeague: null,
        }),
      ],
      totalCount: 1,
    });
    expect(
      repository.listSavedEditPage({
        game: "poe2",
        league: "Standard",
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }).projects,
    ).toEqual([
      expect.objectContaining({
        id: "mixed-league-project",
        sourceGame: "poe2",
        sourceLeague: null,
      }),
    ]);
    expect(
      repository.listSavedEditPage({
        game: "poe2",
        league: "Runes of Aldur",
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }).projects,
    ).toEqual([
      expect.objectContaining({
        id: "mixed-league-project",
        sourceGame: "poe2",
        sourceLeague: null,
      }),
    ]);
  });

  it("replaces saved edit source league memberships on project update", () => {
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
        assets: [standardAsset],
        id: "mutable-source-project",
        tracks: [createEditorVideoTrackForAssets([standardAsset])],
      }),
    );
    repository.upsert(
      createEditorProject({
        assets: [runesAsset],
        id: "mutable-source-project",
        tracks: [createEditorVideoTrackForAssets([runesAsset])],
      }),
    );

    expect(
      repository.listSavedEditPage({
        game: "poe2",
        league: "Standard",
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }).projects,
    ).toEqual([]);
    expect(
      repository.listSavedEditPage({
        game: "poe2",
        league: "Runes of Aldur",
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }).projects,
    ).toEqual([
      expect.objectContaining({
        id: "mutable-source-project",
        sourceLeague: "Runes of Aldur",
      }),
    ]);
  });

  it("counts saved edit size from timeline assets only", () => {
    const repository = createRepository();
    const activeAsset = createEditorMediaAsset({
      assetKey: "clip:active",
      id: "active",
      sizeBytes: 10 * 1024 * 1024,
      sourceGame: "poe2",
      sourceLeague: "Standard",
    });
    const unusedAsset = createEditorMediaAsset({
      assetKey: "clip:unused",
      id: "unused",
      sizeBytes: 95 * 1024 * 1024,
      sourceGame: "poe2",
      sourceLeague: "Standard",
    });
    repository.upsert(
      createEditorProject({
        assets: [activeAsset, unusedAsset],
        id: "timeline-sized-project",
        tracks: [createEditorVideoTrackForAssets([activeAsset])],
      }),
    );

    expect(
      repository.listSavedEditPage({
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }).projects[0],
    ).toMatchObject({
      id: "timeline-sized-project",
      sizeBytes: activeAsset.sizeBytes,
    });
  });

  it("derives saved edit source fields independently from timeline assets", () => {
    const repository = createRepository();
    const poe1Asset = createEditorMediaAsset({
      assetKey: "clip:poe1-first",
      sourceGame: "poe1",
      sourceLeague: "Standard",
    });
    repository.upsert(
      createEditorProject({
        assets: [poe1Asset],
        id: "asset-scoped-project",
        sourceGame: null,
        sourceLeague: null,
        tracks: [createEditorVideoTrackForAssets([poe1Asset])],
      }),
    );
    const poe2Asset = createEditorMediaAsset({
      assetKey: "clip:poe2-first",
      sourceGame: "poe2",
      sourceLeague: "Standard",
    });
    const secondPoe1Asset = createEditorMediaAsset({
      assetKey: "clip:poe1-second",
      sourceGame: "poe1",
      sourceLeague: "Standard",
    });
    repository.upsert(
      createEditorProject({
        assets: [poe2Asset, secondPoe1Asset],
        id: "mixed-scope-project",
        sourceGame: null,
        sourceLeague: null,
        tracks: [createEditorVideoTrackForAssets([poe2Asset, secondPoe1Asset])],
      }),
    );
    repository.upsert(
      createEditorProject({
        assets: [],
        id: "unscoped-empty-project",
        sourceGame: null,
        sourceLeague: null,
      }),
    );

    expect(
      repository.listSavedEditPage({
        game: "poe1",
        league: "Standard",
        pageIndex: 0,
        pageSize: 10,
        sortBy: "updatedAt",
        sortDirection: "desc",
      }).projects,
    ).toEqual([
      expect.objectContaining({
        id: "asset-scoped-project",
        sourceGame: "poe1",
      }),
      expect.objectContaining({
        id: "mixed-scope-project",
        sourceGame: null,
        sourceLeague: "Standard",
      }),
    ]);
    expect(
      repository
        .listSavedEditPage({
          pageIndex: 0,
          pageSize: 10,
          sortBy: "updatedAt",
          sortDirection: "desc",
        })
        .projects.filter((project) =>
          ["mixed-scope-project", "unscoped-empty-project"].includes(
            project.id,
          ),
        ),
    ).toEqual([
      expect.objectContaining({
        id: "mixed-scope-project",
        sourceGame: null,
        sourceLeague: "Standard",
      }),
      expect.objectContaining({
        id: "unscoped-empty-project",
        sourceGame: null,
        sourceLeague: null,
      }),
    ]);
  });

  it("rejects invalid stored editor project JSON", () => {
    const project = createEditorProject();
    const asset = project.assets[0];
    const track = project.tracks[0];
    const clip = track?.clips[0];
    if (!asset || !track || !clip) {
      throw new Error("Expected test project to include one asset and clip");
    }
    const row = {
      clip_count: 1,
      created_at: project.createdAt,
      duration_seconds: project.durationSeconds,
      id: project.id,
      project_json: JSON.stringify({ ...project, history: null }),
      title: project.title,
      updated_at: project.updatedAt,
    };

    expect(() => mapEditorProjectRow(row)).toThrow(
      "Editor project data is invalid",
    );
    expect(() =>
      mapEditorProjectRow({
        ...row,
        project_json: JSON.stringify({ ...project, sourceGame: "poe3" }),
      }),
    ).toThrow("Editor project data is invalid");
    expect(() =>
      mapEditorProjectRow({
        ...row,
        project_json: JSON.stringify({ ...project, sourceLeague: 12 }),
      }),
    ).toThrow("Editor project data is invalid");
    expect(() =>
      mapEditorProjectRow({
        ...row,
        project_json: JSON.stringify({
          ...project,
          history: { editCount: "two", labels: [] },
        }),
      }),
    ).toThrow("Editor project data is invalid");
    expect(() =>
      mapEditorProjectRow({
        ...row,
        project_json: JSON.stringify({
          ...project,
          history: { editCount: 1, labels: [1] },
        }),
      }),
    ).toThrow("Editor project data is invalid");
    expect(() =>
      mapEditorProjectRow({
        ...row,
        project_json: JSON.stringify({
          ...project,
          assets: [{ ...asset, exists: "yes" }],
        }),
      }),
    ).toThrow("Editor project data is invalid");
    expect(() =>
      mapEditorProjectRow({
        ...row,
        project_json: JSON.stringify({
          ...project,
          tracks: [{ ...track, kind: "audio" }],
        }),
      }),
    ).toThrow("Editor project data is invalid");
    expect(() =>
      mapEditorProjectRow({
        ...row,
        project_json: JSON.stringify({
          ...project,
          tracks: [
            {
              ...track,
              clips: [
                {
                  ...clip,
                  assetKey: "clip:missing",
                },
              ],
            },
          ],
        }),
      }),
    ).toThrow("Editor project data is invalid");
    expect(
      mapEditorProjectRow({
        ...row,
        project_json: JSON.stringify({
          ...project,
          sourceGame: null,
          sourceLeague: null,
        }),
      }),
    ).toMatchObject({
      sourceGame: null,
      sourceLeague: null,
    });
  });

  it("prunes saved projects to the newest limit without a protected project", () => {
    const repository = createRepository();

    for (let index = 0; index < 30; index += 1) {
      repository.upsert(
        createEditorProject({
          id: `project-${index}`,
          title: `Saved edit ${index}`,
          updatedAt: `2026-06-18T00:${index.toString().padStart(2, "0")}:00.000Z`,
        }),
      );
    }

    expect(repository.deleteOlderThanLimit({ limit: 5 })).toBe(25);
    expect(
      repository.list({ limit: 10 }).projects.map((project) => project.id),
    ).toEqual([
      "project-29",
      "project-28",
      "project-27",
      "project-26",
      "project-25",
    ]);
    expect(repository.get("project-24")).toBeNull();
  });

  it("deletes every saved project when pruning to an empty retained set", () => {
    const repository = createRepository();

    repository.upsert(createEditorProject({ id: "project-1" }));
    repository.upsert(createEditorProject({ id: "project-2" }));

    expect(repository.deleteOlderThanLimit({ limit: 0 })).toBe(2);
    expect(repository.list({ limit: 10 })).toEqual({
      hasMore: false,
      projects: [],
    });
  });

  it("keeps an existing protected project when the retained limit is empty", () => {
    const repository = createRepository();

    repository.upsert(createEditorProject({ id: "project-1" }));
    repository.upsert(createEditorProject({ id: "project-2" }));

    expect(
      repository.deleteOlderThanLimit({
        limit: 0,
        protectedProjectId: "project-1",
      }),
    ).toBe(1);
    expect(
      repository.list({ limit: 10 }).projects.map((project) => project.id),
    ).toEqual(["project-1"]);
  });

  it("preserves every active project while pruning to the configured limit", () => {
    const repository = createRepository();

    for (let index = 0; index < 8; index += 1) {
      repository.upsert(
        createEditorProject({
          id: `project-${index}`,
          updatedAt: `2026-06-18T00:0${index}:00.000Z`,
        }),
      );
    }

    expect(
      repository.deleteOlderThanLimit({
        limit: 5,
        protectedProjectIds: ["project-0", "project-3", "missing"],
      }),
    ).toBe(3);
    expect(
      repository.list({ limit: 10 }).projects.map((project) => project.id),
    ).toEqual([
      "project-7",
      "project-6",
      "project-5",
      "project-3",
      "project-0",
    ]);
  });

  it("rejects corrupted stored project JSON", () => {
    const repository = createRepository();
    database?.db
      .prepare(
        `
        INSERT INTO editor_projects (
          id,
          title,
          duration_seconds,
          clip_count,
          project_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        "corrupt-project",
        "Corrupt",
        0,
        0,
        '{"id":"corrupt-project"}',
        "2026-06-18T00:00:00.000Z",
        "2026-06-18T00:00:00.000Z",
      );

    expect(() => repository.get("corrupt-project")).toThrow(
      "Editor project data is invalid",
    );
  });

  it("rejects non-object stored project JSON", () => {
    const repository = createRepository();
    database?.db
      .prepare(
        `
        INSERT INTO editor_projects (
          id,
          title,
          duration_seconds,
          clip_count,
          project_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        "null-project",
        "Null",
        0,
        0,
        "null",
        "2026-06-18T00:00:00.000Z",
        "2026-06-18T00:00:00.000Z",
      );

    expect(() => repository.get("null-project")).toThrow(
      "Editor project data is invalid",
    );
  });

  it("rejects stored project JSON with an invalid id", () => {
    const repository = createRepository();
    database?.db
      .prepare(
        `
        INSERT INTO editor_projects (
          id,
          title,
          duration_seconds,
          clip_count,
          project_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        "invalid-id-project",
        "Invalid id",
        0,
        0,
        '{"id":1}',
        "2026-06-18T00:00:00.000Z",
        "2026-06-18T00:00:00.000Z",
      );

    expect(() => repository.get("invalid-id-project")).toThrow(
      "Editor project data is invalid",
    );
  });

  it.each([
    ["invalid-title-project", { id: "project-1", title: 1 }],
    [
      "invalid-created-project",
      { createdAt: 1, id: "project-1", title: "Project" },
    ],
    [
      "invalid-updated-project",
      {
        createdAt: "2026-06-18T00:00:00.000Z",
        id: "project-1",
        title: "Project",
        updatedAt: 1,
      },
    ],
    [
      "invalid-duration-project",
      {
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: "0",
        id: "project-1",
        title: "Project",
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-assets-project",
      {
        assets: {},
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        title: "Project",
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-audio-muted-project",
      {
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        isAudioMuted: "yes",
        title: "Project",
        tracks: [],
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-tracks-project",
      {
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        title: "Project",
        tracks: {},
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-active-project",
      {
        activeClipId: 1,
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        title: "Project",
        tracks: [],
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-selected-project",
      {
        activeClipId: null,
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        selectedAssetKey: 1,
        title: "Project",
        tracks: [],
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-track-clips-project",
      {
        activeClipId: null,
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        selectedAssetKey: null,
        title: "Project",
        tracks: [{ clips: {} }],
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-clip-id-project",
      {
        activeClipId: null,
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        selectedAssetKey: null,
        title: "Project",
        tracks: [{ clips: [{ id: 1 }] }],
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
  ])("rejects stored project JSON shape %s", (id, projectJson) => {
    const repository = createRepository();
    insertStoredProjectJson(id, JSON.stringify(projectJson));

    expect(() => repository.get(id)).toThrow("Editor project data is invalid");
  });
});
