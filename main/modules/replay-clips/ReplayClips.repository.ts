import { type SelectQueryBuilder, sql } from "kysely";

import type { DatabaseService } from "~/main/modules/database";
import type { DatabaseSchema } from "~/main/modules/database/Database.types";

import { type GameId, type ReplayClip, ReplayClipSchema } from "~/types";
import type {
  ReplayClipLibrarySortDirection,
  ReplayClipLibrarySortKey,
  ReplayClipListFilter,
} from "./ReplayClips.dto";

interface ReplayClipRow {
  id: string;
  kind: string;
  status: string;
  source_game: string;
  source_league: string;
  death_timestamp: string;
  trigger_line_hash: string;
  original_obs_path: string | null;
  processed_clip_path: string | null;
  target_duration_seconds: number;
  size_bytes: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface ReplayClipLibraryPageInput {
  filter?: ReplayClipListFilter;
  pageIndex: number;
  pageSize: number;
  sortBy: ReplayClipLibrarySortKey;
  sortDirection: ReplayClipLibrarySortDirection;
}

interface ReplayClipLibraryPageResult {
  items: ReplayClip[];
  totalCount: number;
}

interface ReplayClipStoragePathRow {
  id: string;
  originalObsPath: string | null;
  processedClipPath: string | null;
}

interface ReplayClipUsageSummary {
  clipCount: number;
  game: GameId;
  leagueName: string;
  sizeBytes: number;
}

type ReplayClipFilterQuery = SelectQueryBuilder<
  DatabaseSchema,
  "replay_clips",
  Record<keyof any, never>
>;

function mapReplayClipRow(row: ReplayClipRow): ReplayClip {
  return ReplayClipSchema.parse({
    id: row.id,
    kind: row.kind,
    status: row.status,
    sourceGame: row.source_game,
    sourceLeague: row.source_league,
    deathTimestamp: row.death_timestamp,
    triggerLineHash: row.trigger_line_hash,
    originalObsPath: row.original_obs_path,
    processedClipPath: row.processed_clip_path,
    targetDurationSeconds: row.target_duration_seconds,
    sizeBytes: row.size_bytes,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

class ReplayClipsRepository {
  constructor(private readonly database: DatabaseService) {}

  list(filter: ReplayClipListFilter = {}): ReplayClip[] {
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .selectAll()
        .orderBy("created_at", "desc")
        .limit(200),
    );

    return rows.map(mapReplayClipRow);
  }

  listAll(filter: ReplayClipListFilter = {}): ReplayClip[] {
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .selectAll()
        .orderBy("created_at", "desc"),
    );

    return rows.map(mapReplayClipRow);
  }

  listMissingSizeClips(filter: ReplayClipListFilter = {}): ReplayClip[] {
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .selectAll()
        .where("size_bytes", "<=", 0)
        .orderBy("created_at", "desc"),
    );

    return rows.map(mapReplayClipRow);
  }

  listStoragePaths(): ReplayClipStoragePathRow[] {
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("replay_clips")
        .select(["id", "original_obs_path", "processed_clip_path"]),
    );

    return rows.map((row) => ({
      id: row.id,
      originalObsPath: row.original_obs_path,
      processedClipPath: row.processed_clip_path,
    }));
  }

  listStorageUsage(): ReplayClipUsageSummary[] {
    const rows = this.database.db
      .prepare(
        `
        WITH clip_counts AS (
          SELECT
            source_game,
            source_league,
            COUNT(*) AS clip_count
          FROM replay_clips
          GROUP BY source_game, source_league
        ),
        clip_sizes AS (
          SELECT
            source_game,
            source_league,
            SUM(size_bytes) AS size_bytes
          FROM (
            SELECT
              source_game,
              source_league,
              clip_path,
              MAX(size_bytes) AS size_bytes
            FROM (
              SELECT
                source_game,
                source_league,
                COALESCE(processed_clip_path, original_obs_path) AS clip_path,
                size_bytes
              FROM replay_clips
              WHERE COALESCE(processed_clip_path, original_obs_path) IS NOT NULL
            )
            WHERE clip_path != ''
            GROUP BY source_game, source_league, clip_path
          )
          GROUP BY source_game, source_league
        )
        SELECT
          clip_counts.source_game,
          clip_counts.source_league,
          clip_counts.clip_count,
          COALESCE(clip_sizes.size_bytes, 0) AS size_bytes
        FROM clip_counts
        LEFT JOIN clip_sizes
          ON clip_sizes.source_game = clip_counts.source_game
         AND clip_sizes.source_league = clip_counts.source_league
      `,
      )
      .all() as Array<{
      clip_count: number;
      size_bytes: number | null;
      source_game: GameId;
      source_league: string;
    }>;

    return rows.map((row) => ({
      clipCount: Number(row.clip_count),
      game: row.source_game,
      leagueName: row.source_league,
      sizeBytes: Number(row.size_bytes ?? 0),
    }));
  }

  listLibraryPage(
    input: ReplayClipLibraryPageInput,
  ): ReplayClipLibraryPageResult {
    const filter = input.filter ?? {};
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .selectAll()
        .orderBy(
          this.getLibrarySortExpression(input.sortBy),
          input.sortDirection,
        )
        .orderBy("created_at", "desc")
        .limit(input.pageSize)
        .offset(input.pageIndex * input.pageSize),
    );

    return {
      items: rows.map(mapReplayClipRow),
      totalCount: this.count(filter),
    };
  }

  count(filter: ReplayClipListFilter = {}): number {
    const row = this.database.queryOne(
      this.createFilteredQuery(filter).select((eb) =>
        eb.fn.countAll<number>().as("count"),
      ),
    );

    return Number(row?.count ?? 0);
  }

  listLeagues(filter: ReplayClipListFilter = {}): string[] {
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .select("source_league")
        .distinct()
        .where("source_league", "!=", "")
        .orderBy("source_league", "asc"),
    );

    return rows.map((row) => row.source_league);
  }

  get(id: string): ReplayClip | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("replay_clips")
        .selectAll()
        .where("id", "=", id),
    );

    return row ? mapReplayClipRow(row) : null;
  }

  getByTriggerLineHash(triggerLineHash: string): ReplayClip | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("replay_clips")
        .selectAll()
        .where("trigger_line_hash", "=", triggerLineHash)
        .orderBy("created_at", "desc")
        .limit(1),
    );

    return row ? mapReplayClipRow(row) : null;
  }

  upsert(clip: ReplayClip): void {
    this.database.runQuery(
      this.database.kysely
        .insertInto("replay_clips")
        .values({
          id: clip.id,
          kind: clip.kind,
          status: clip.status,
          source_game: clip.sourceGame,
          source_league: clip.sourceLeague,
          death_timestamp: clip.deathTimestamp,
          trigger_line_hash: clip.triggerLineHash,
          original_obs_path: clip.originalObsPath,
          processed_clip_path: clip.processedClipPath,
          target_duration_seconds: clip.targetDurationSeconds,
          size_bytes: clip.sizeBytes,
          error: clip.error,
          created_at: clip.createdAt,
          updated_at: clip.updatedAt,
        })
        .onConflict((conflict) =>
          conflict.column("id").doUpdateSet({
            kind: clip.kind,
            status: clip.status,
            source_league: clip.sourceLeague,
            original_obs_path: clip.originalObsPath,
            processed_clip_path: clip.processedClipPath,
            size_bytes: clip.sizeBytes,
            error: clip.error,
            updated_at: clip.updatedAt,
          }),
        ),
    );
  }

  updateSize(id: string, sizeBytes: number): void {
    this.database.runQuery(
      this.database.kysely
        .updateTable("replay_clips")
        .set({
          size_bytes: sizeBytes,
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", id),
    );
  }

  delete(id: string): void {
    this.database.runQuery(
      this.database.kysely.deleteFrom("replay_clips").where("id", "=", id),
    );
  }

  replaceAll(clips: ReplayClip[]): void {
    this.database.transaction(() => {
      this.database.runQuery(this.database.kysely.deleteFrom("replay_clips"));
      for (const clip of clips) {
        this.upsert(clip);
      }
    });
  }

  upsertMany(clips: ReplayClip[]): void {
    this.database.transaction(() => {
      for (const clip of clips) {
        this.upsert(clip);
      }
    });
  }

  private createFilteredQuery(
    filter: ReplayClipListFilter = {},
  ): ReplayClipFilterQuery {
    let query = this.database.kysely.selectFrom("replay_clips");

    if (filter.game) {
      query = query.where("source_game", "=", filter.game);
    }
    if (filter.league) {
      query = query.where("source_league", "=", filter.league);
    }
    if (filter.kind) {
      query = query.where("kind", "=", filter.kind);
    }

    return query;
  }

  private getLibrarySortExpression(sortBy: ReplayClipLibrarySortKey) {
    switch (sortBy) {
      case "name":
        return sql<string>`coalesce(processed_clip_path, original_obs_path, '')`;
      case "sourceLeague":
        return "source_league";
      case "targetDurationSeconds":
        return "target_duration_seconds";
      case "sizeBytes":
        return "size_bytes";
      case "createdAt":
        return "created_at";
    }
  }
}

export { ReplayClipsRepository };
