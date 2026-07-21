import type { DatabaseService } from "~/main/modules/database";

import type { GameId } from "~/types";
import type { EditorProject, EditorProjectSummary } from "./Editor.dto";
import {
  countEditorProjectClips,
  mapEditorProjectRow,
  mapEditorProjectSummaryRow,
} from "./EditorProject.mapper";
import {
  createEditorProjectPersistedMetadata,
  type EditorProjectPersistedMetadata,
} from "./EditorProject.metadata";

interface EditorProjectListResult {
  hasMore: boolean;
  projects: EditorProjectSummary[];
}

type EditorProjectSummarySortDirection = "asc" | "desc";
type EditorProjectSummarySortKey =
  | "clipCount"
  | "createdAt"
  | "durationSeconds"
  | "title"
  | "updatedAt";

interface EditorProjectPageInput {
  pageIndex: number;
  pageSize: number;
  sortBy: EditorProjectSummarySortKey;
  sortDirection: EditorProjectSummarySortDirection;
}

interface EditorProjectPageResult {
  projects: EditorProjectSummary[];
  totalCount: number;
}

interface EditorProjectSavedEditSummary extends EditorProjectSummary {
  historyEditCount: number;
  sizeBytes: number;
  sourceGame: GameId | null;
  sourceLeague: string | null;
}

type EditorProjectSavedEditSortKey =
  | Exclude<EditorProjectSummarySortKey, "clipCount">
  | "historyEditCount"
  | "sizeBytes";

const editorProjectSavedEditSortColumns = {
  createdAt: "created_at",
  durationSeconds: "duration_seconds",
  historyEditCount: "history_edit_count",
  sizeBytes: "source_size_bytes",
  title: "title",
  updatedAt: "updated_at",
} as const satisfies Record<EditorProjectSavedEditSortKey, string>;

const editorProjectSavedEditSortKeys = Object.keys(
  editorProjectSavedEditSortColumns,
) as EditorProjectSavedEditSortKey[];

interface EditorProjectSavedEditPageInput {
  game?: GameId;
  league?: string;
  pageIndex: number;
  pageSize: number;
  sortBy: EditorProjectSavedEditSortKey;
  sortDirection: EditorProjectSummarySortDirection;
}

interface EditorProjectSavedEditPageResult {
  availableLeagues: string[];
  globalTotalCount: number;
  projects: EditorProjectSavedEditSummary[];
  totalCount: number;
}

interface EditorProjectSavedEditRow {
  clip_count: number;
  created_at: string;
  duration_seconds: number;
  history_edit_count: number;
  id: string;
  source_size_bytes: number;
  source_game: string | null;
  source_league: string | null;
  title: string;
  updated_at: string;
}

class EditorProjectRepository {
  constructor(private readonly database: DatabaseService) {}

  list(input: { limit: number }): EditorProjectListResult {
    const queryLimit = input.limit + 1;
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("editor_projects")
        .select([
          "id",
          "title",
          "duration_seconds",
          "clip_count",
          "created_at",
          "updated_at",
        ])
        .orderBy("updated_at", "desc")
        .limit(queryLimit),
    );
    const projects = rows.slice(0, input.limit).map(mapEditorProjectSummaryRow);

    return {
      hasMore: rows.length > input.limit,
      projects,
    };
  }

  listPage(input: EditorProjectPageInput): EditorProjectPageResult {
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("editor_projects")
        .select([
          "id",
          "title",
          "duration_seconds",
          "clip_count",
          "created_at",
          "updated_at",
        ])
        .orderBy(
          resolveEditorProjectSummarySortColumn(input.sortBy),
          input.sortDirection,
        )
        .orderBy("id", "asc")
        .offset(input.pageIndex * input.pageSize)
        .limit(input.pageSize),
    );

    return {
      projects: rows.map(mapEditorProjectSummaryRow),
      totalCount: this.countProjects(),
    };
  }

  listSavedEditPage(
    input: EditorProjectSavedEditPageInput,
  ): EditorProjectSavedEditPageResult {
    const filter = createSavedEditFilter(input);
    const availableLeaguesFilter = createSavedEditAvailableLeaguesFilter(
      input.game ? { game: input.game } : {},
    );
    const sortColumn = resolveEditorProjectSavedEditSortColumn(input.sortBy);
    const sortDirection = input.sortDirection.toUpperCase();
    const pageRows = this.database.db
      .prepare(
        `
        SELECT
          id,
          title,
          duration_seconds,
          clip_count,
          history_edit_count,
          created_at,
          updated_at,
          source_game,
          source_league,
          source_size_bytes
        FROM editor_projects
        ${filter.sql}
        ORDER BY ${sortColumn} ${sortDirection}, id ASC
        LIMIT ? OFFSET ?
      `,
      )
      .all(
        ...filter.params,
        input.pageSize,
        input.pageIndex * input.pageSize,
      ) as unknown as EditorProjectSavedEditRow[];
    const totalCountRow = this.database.db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM editor_projects
        ${filter.sql}
      `,
      )
      .get(...filter.params) as { count: number };
    const availableLeagueRows = this.database.db
      .prepare(
        `
        SELECT DISTINCT source_league
        FROM editor_project_source_leagues
        ${availableLeaguesFilter.sql}
        ORDER BY source_league ASC
      `,
      )
      .all(...availableLeaguesFilter.params) as unknown as Array<{
      source_league: string | null;
    }>;

    return {
      availableLeagues: availableLeagueRows
        .map((row) => row.source_league)
        .filter((league): league is string => Boolean(league)),
      globalTotalCount: this.countProjects(),
      projects: pageRows.map(mapEditorProjectSavedEditRow),
      totalCount: Number(totalCountRow.count),
    };
  }

  listAll(): EditorProject[] {
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("editor_projects")
        .selectAll()
        .orderBy("updated_at", "desc")
        .orderBy("id", "asc"),
    );

    return rows.map(mapEditorProjectRow);
  }

  get(id: string): EditorProject | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("editor_projects")
        .selectAll()
        .where("id", "=", id),
    );

    return row ? mapEditorProjectRow(row) : null;
  }

  upsert(project: EditorProject): void {
    const projectJson = JSON.stringify(project);
    const clipCount = countEditorProjectClips(project);
    const metadata = createEditorProjectPersistedMetadata(project);

    this.database.transaction(() => {
      this.database.runQuery(
        this.database.kysely
          .insertInto("editor_projects")
          .values({
            clip_count: clipCount,
            created_at: project.createdAt,
            duration_seconds: project.durationSeconds,
            history_edit_count: metadata.historyEditCount,
            id: project.id,
            project_json: projectJson,
            source_game: metadata.sourceGame,
            source_league: metadata.sourceLeague,
            source_size_bytes: metadata.sourceSizeBytes,
            title: project.title,
            updated_at: project.updatedAt,
          })
          .onConflict((conflict) =>
            conflict.column("id").doUpdateSet({
              clip_count: clipCount,
              duration_seconds: project.durationSeconds,
              history_edit_count: metadata.historyEditCount,
              project_json: projectJson,
              source_game: metadata.sourceGame,
              source_league: metadata.sourceLeague,
              source_size_bytes: metadata.sourceSizeBytes,
              title: project.title,
              updated_at: project.updatedAt,
            }),
          ),
      );
      this.replaceSourceLeagueMemberships(
        project.id,
        metadata.sourceLeagueMemberships,
      );
    });
  }

  delete(id: string): void {
    this.database.transaction(() => {
      this.database.runQuery(
        this.database.kysely
          .deleteFrom("editor_project_source_leagues")
          .where("project_id", "=", id),
      );
      this.database.runQuery(
        this.database.kysely.deleteFrom("editor_projects").where("id", "=", id),
      );
    });
  }

  deleteAll(): void {
    this.database.transaction(() => {
      this.database.runQuery(
        this.database.kysely.deleteFrom("editor_project_source_leagues"),
      );
      this.database.runQuery(
        this.database.kysely.deleteFrom("editor_projects"),
      );
    });
  }

  deleteOlderThanLimit(input: {
    limit: number;
    protectedProjectId?: string | null;
    protectedProjectIds?: readonly string[];
  }): number {
    const retainedRows = this.database.queryAll(
      this.database.kysely
        .selectFrom("editor_projects")
        .select(["id"])
        .orderBy("updated_at", "desc")
        .orderBy("id", "asc")
        .limit(input.limit),
    );
    const retainedProjectIds = new Set(retainedRows.map((row) => row.id));
    const protectedProjectIds = new Set(
      [input.protectedProjectId, ...(input.protectedProjectIds ?? [])].filter(
        (projectId): projectId is string =>
          typeof projectId === "string" && this.projectExists(projectId),
      ),
    );
    for (const projectId of protectedProjectIds) {
      retainedProjectIds.add(projectId);
    }

    const retainedLimit = Math.max(input.limit, protectedProjectIds.size);
    for (const row of [...retainedRows].reverse()) {
      if (retainedProjectIds.size <= retainedLimit) {
        break;
      }
      if (!protectedProjectIds.has(row.id)) {
        retainedProjectIds.delete(row.id);
      }
    }

    const retainedIds = Array.from(retainedProjectIds);
    if (retainedIds.length === 0) {
      const deletedProjectCount = this.countProjects();
      this.deleteAll();
      return deletedProjectCount;
    }

    const deletedProjectCount = this.countProjectsExcept(retainedIds);
    if (deletedProjectCount === 0) {
      return 0;
    }

    this.database.transaction(() => {
      this.database.runQuery(
        this.database.kysely
          .deleteFrom("editor_project_source_leagues")
          .where("project_id", "not in", retainedIds),
      );
      this.database.runQuery(
        this.database.kysely
          .deleteFrom("editor_projects")
          .where("id", "not in", retainedIds),
      );
    });

    return deletedProjectCount;
  }

  private countProjects(): number {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("editor_projects")
        .select((eb) => eb.fn.countAll<number>().as("count")),
    );

    return Number((row as { count: number }).count);
  }

  private projectExists(projectId: string): boolean {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("editor_projects")
        .select(["id"])
        .where("id", "=", projectId),
    );

    return row !== undefined;
  }

  private countProjectsExcept(projectIds: string[]): number {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("editor_projects")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("id", "not in", projectIds),
    );

    return Number((row as { count: number }).count);
  }

  private replaceSourceLeagueMemberships(
    projectId: string,
    memberships: EditorProjectPersistedMetadata["sourceLeagueMemberships"],
  ): void {
    this.database.runQuery(
      this.database.kysely
        .deleteFrom("editor_project_source_leagues")
        .where("project_id", "=", projectId),
    );

    for (const membership of memberships) {
      this.database.runQuery(
        this.database.kysely
          .insertInto("editor_project_source_leagues")
          .values({
            project_id: projectId,
            source_game: membership.sourceGame,
            source_league: membership.sourceLeague,
          })
          .onConflict((conflict) => conflict.doNothing()),
      );
    }
  }
}

function createSavedEditFilter(input: { game?: GameId; league?: string }): {
  params: string[];
  sql: string;
} {
  const clauses: string[] = [];
  const params: string[] = [];

  if (input.game || input.league) {
    const membershipClauses = ["source_scope.project_id = editor_projects.id"];
    if (input.game) {
      membershipClauses.push("source_scope.source_game = ?");
      params.push(input.game);
    }
    if (input.league) {
      membershipClauses.push("source_scope.source_league = ?");
      params.push(input.league);
    }
    clauses.push(`
      EXISTS (
        SELECT 1
        FROM editor_project_source_leagues AS source_scope
        WHERE ${membershipClauses.join(" AND ")}
      )
    `);
  }

  return {
    params,
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
  };
}

function createSavedEditAvailableLeaguesFilter(input: { game?: GameId }): {
  params: string[];
  sql: string;
} {
  if (!input.game) {
    return { params: [], sql: "" };
  }

  return {
    params: [input.game],
    sql: "WHERE source_game = ?",
  };
}

function mapEditorProjectSavedEditRow(
  row: EditorProjectSavedEditRow,
): EditorProjectSavedEditSummary {
  return {
    clipCount: row.clip_count,
    createdAt: row.created_at,
    durationSeconds: row.duration_seconds,
    historyEditCount: row.history_edit_count,
    id: row.id,
    sizeBytes: row.source_size_bytes,
    sourceGame:
      row.source_game === "poe1" || row.source_game === "poe2"
        ? row.source_game
        : null,
    sourceLeague: row.source_league,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function resolveEditorProjectSummarySortColumn(
  sortBy: EditorProjectSummarySortKey,
): "clip_count" | "created_at" | "duration_seconds" | "title" | "updated_at" {
  switch (sortBy) {
    case "clipCount":
      return "clip_count";
    case "createdAt":
      return "created_at";
    case "durationSeconds":
      return "duration_seconds";
    case "title":
      return "title";
    case "updatedAt":
      return "updated_at";
  }
}

function resolveEditorProjectSavedEditSortColumn(
  sortBy: EditorProjectSavedEditSortKey,
):
  | "created_at"
  | "duration_seconds"
  | "history_edit_count"
  | "source_size_bytes"
  | "title"
  | "updated_at" {
  return editorProjectSavedEditSortColumns[sortBy];
}

export type {
  EditorProjectListResult,
  EditorProjectPageInput,
  EditorProjectPageResult,
  EditorProjectSavedEditPageInput,
  EditorProjectSavedEditPageResult,
  EditorProjectSavedEditSortKey,
  EditorProjectSavedEditSummary,
  EditorProjectSummarySortDirection,
  EditorProjectSummarySortKey,
};
export { EditorProjectRepository, editorProjectSavedEditSortKeys };
