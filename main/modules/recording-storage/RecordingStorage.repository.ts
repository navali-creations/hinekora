import { randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";

import type { SelectQueryBuilder } from "kysely";

import type { DatabaseService } from "~/main/modules/database";
import type { DatabaseSchema } from "~/main/modules/database/Database.types";

import type { GameId } from "~/types";
import type {
  RunRecordingCreateInput,
  RunRecordingItem,
  RunRecordingLibrarySortDirection,
  RunRecordingLibrarySortKey,
  RunRecordingMetadata,
} from "./RecordingStorage.dto";
import type { RecordingStoragePathMigration } from "./RecordingStorage.utils";

interface RunRecordingRow {
  id: string;
  path: string;
  source_game: "poe1" | "poe2";
  source_league: string;
  file_name: string;
  duration_seconds: number | null;
  size_bytes: number;
  exists_on_disk: number;
  mtime_ms: number;
  started_at: string;
  stopped_at: string;
  created_at: string;
  updated_at: string;
}

interface RunRecordingLibraryFilter {
  createdAfter?: string;
  excludeIds?: string[];
  game?: "poe1" | "poe2";
  includeIds?: string[];
  league?: string;
}

interface RunRecordingLibraryPageInput {
  filter?: RunRecordingLibraryFilter;
  pageIndex: number;
  pageSize: number;
  sortBy: RunRecordingLibrarySortKey;
  sortDirection: RunRecordingLibrarySortDirection;
}

interface RunRecordingLibraryPageResult {
  items: RunRecordingItem[];
  totalCount: number;
}

interface RunRecordingStorageEntry {
  mtimeMs: number;
  path: string;
  size: number;
}

interface RunRecordingUsageSummary {
  game: GameId;
  leagueName: string;
  recordingCount: number;
  sizeBytes: number;
}

interface RunRecordingSyncItem {
  durationSeconds: number | null;
  exists: boolean;
  mtimeMs: number;
  path: string;
  sizeBytes: number;
}

interface RecordingStoragePathMigrationRow {
  from_path: string;
  to_path: string;
}

type RunRecordingFilterQuery = SelectQueryBuilder<
  DatabaseSchema,
  "run_recordings",
  Record<keyof any, never>
>;

function mapRunRecordingRow(row: RunRecordingRow): RunRecordingMetadata {
  return {
    id: row.id,
    path: row.path,
    sourceGame: row.source_game,
    sourceLeague: row.source_league,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRunRecordingItemRow(row: RunRecordingRow): RunRecordingItem {
  const metadata = mapRunRecordingRow(row);

  return {
    ...metadata,
    fileName: row.file_name.length > 0 ? row.file_name : basename(row.path),
    durationSeconds: row.duration_seconds,
    exists: row.exists_on_disk === 1,
    sizeBytes: row.exists_on_disk === 1 ? row.size_bytes : 0,
  };
}

function calculateDurationSeconds(
  input: RunRecordingCreateInput,
): number | null {
  const explicitDurationSeconds = normalizeDurationSeconds(
    input.durationSeconds,
  );
  if (explicitDurationSeconds !== null) {
    return explicitDurationSeconds;
  }

  const startedAt = Date.parse(input.startedAt);
  const stoppedAt = Date.parse(input.stoppedAt);
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(stoppedAt) ||
    stoppedAt <= startedAt
  ) {
    return null;
  }

  return Math.round((stoppedAt - startedAt) / 1000);
}

function normalizeDurationSeconds(durationSeconds: number | null | undefined) {
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }

  return Math.round(durationSeconds * 1_000) / 1_000;
}

class RecordingStorageRepository {
  constructor(private readonly database: DatabaseService) {}

  listRunRecordings(): RunRecordingMetadata[] {
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("run_recordings")
        .selectAll()
        .orderBy("created_at", "desc"),
    );

    return rows.map(mapRunRecordingRow);
  }

  listRunRecordingSyncItems(): RunRecordingSyncItem[] {
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("run_recordings")
        .select([
          "path",
          "duration_seconds",
          "exists_on_disk",
          "size_bytes",
          "mtime_ms",
        ]),
    );

    return rows.map((row) => ({
      durationSeconds: row.duration_seconds,
      exists: row.exists_on_disk === 1,
      mtimeMs: row.mtime_ms,
      path: row.path,
      sizeBytes: row.exists_on_disk === 1 ? row.size_bytes : 0,
    }));
  }

  listPendingStoragePathMigrations(): RecordingStoragePathMigration[] {
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("recording_storage_path_migrations")
        .select(["from_path", "to_path"])
        .where("status", "=", "pending")
        .orderBy("created_at", "asc"),
    ) as RecordingStoragePathMigrationRow[];

    return rows.map((row) => ({
      from: row.from_path,
      to: row.to_path,
    }));
  }

  savePendingStoragePathMigrations(
    migrations: RecordingStoragePathMigration[],
  ): void {
    if (migrations.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    this.database.runQuery(
      this.database.kysely
        .insertInto("recording_storage_path_migrations")
        .values(
          migrations.map((migration) => ({
            from_path: resolve(migration.from),
            to_path: resolve(migration.to),
            status: "pending",
            created_at: now,
            updated_at: now,
          })),
        )
        .onConflict((conflict) =>
          conflict.column("from_path").doUpdateSet({
            to_path: (eb) => eb.ref("excluded.to_path"),
            status: "pending",
            updated_at: now,
          }),
        ),
    );
  }

  markStoragePathMigrationsCompleted(
    migrations: RecordingStoragePathMigration[],
  ): void {
    if (migrations.length === 0) {
      return;
    }

    this.database.runQuery(
      this.database.kysely
        .updateTable("recording_storage_path_migrations")
        .set({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .where(
          "from_path",
          "in",
          migrations.map((migration) => resolve(migration.from)),
        ),
    );
  }

  listLibraryPage(
    input: RunRecordingLibraryPageInput,
  ): RunRecordingLibraryPageResult {
    const filter = input.filter ?? {};
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .selectAll()
        .orderBy(this.getLibrarySortColumn(input.sortBy), input.sortDirection)
        .orderBy("created_at", "desc")
        .limit(input.pageSize)
        .offset(input.pageIndex * input.pageSize),
    );

    return {
      items: rows.map(mapRunRecordingItemRow),
      totalCount: this.count(filter),
    };
  }

  listDeleteTargets(filter: RunRecordingLibraryFilter): RunRecordingItem[] {
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .selectAll()
        .orderBy("created_at", "desc"),
    );

    return rows.map(mapRunRecordingItemRow);
  }

  listStorageUsage(): RunRecordingUsageSummary[] {
    const rows = this.database.db
      .prepare(
        `
        SELECT
          run_recordings.source_game,
          run_recordings.source_league,
          COUNT(*) AS recording_count,
          COALESCE(
            SUM(
              CASE
                WHEN run_recordings.exists_on_disk = 1
                  THEN run_recordings.size_bytes
                ELSE 0
              END
            ),
            0
          ) AS size_bytes
        FROM run_recordings
        WHERE NOT EXISTS (
          SELECT 1
          FROM replay_clips
          WHERE replay_clips.processed_clip_path = run_recordings.path
             OR replay_clips.original_obs_path = run_recordings.path
        )
        GROUP BY run_recordings.source_game, run_recordings.source_league
      `,
      )
      .all() as Array<{
      recording_count: number;
      size_bytes: number | null;
      source_game: GameId;
      source_league: string;
    }>;

    return rows.map((row) => ({
      game: row.source_game,
      leagueName: row.source_league,
      recordingCount: Number(row.recording_count),
      sizeBytes: Number(row.size_bytes),
    }));
  }

  listStorageEntriesPage(
    after: { mtimeMs: number; path: string } | null,
    limit: number,
  ): RunRecordingStorageEntry[] {
    const rows = this.database.db
      .prepare(
        `
        SELECT path, size_bytes, mtime_ms
        FROM run_recordings
        WHERE exists_on_disk = 1
          AND size_bytes > 0
          ${after ? "AND (mtime_ms > ? OR (mtime_ms = ? AND path > ?))" : ""}
        ORDER BY mtime_ms ASC, path ASC
        LIMIT ?
      `,
      )
      .all(
        ...(after
          ? [after.mtimeMs, after.mtimeMs, after.path, limit]
          : [limit]),
      ) as Array<{ mtime_ms: number; path: string; size_bytes: number }>;

    return rows.map((row) => ({
      mtimeMs: row.mtime_ms,
      path: row.path,
      size: row.size_bytes,
    }));
  }

  count(filter: RunRecordingLibraryFilter = {}): number {
    const row = this.database.queryOne(
      this.createFilteredQuery(filter).select((eb) =>
        eb.fn.countAll<number>().as("count"),
      ),
    );

    return Number((row as { count: number }).count);
  }

  listLeagues(filter: RunRecordingLibraryFilter = {}): string[] {
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .select("source_league")
        .distinct()
        .where("source_league", "!=", "")
        .orderBy("source_league", "asc"),
    );

    return rows.map((row) => row.source_league);
  }

  upsertRunRecording(input: RunRecordingCreateInput): RunRecordingMetadata {
    const now = new Date().toISOString();
    const createdAt = input.createdAt ?? now;
    const normalizedPath = resolve(input.path);
    const durationSeconds = calculateDurationSeconds(input);

    this.database.runQuery(
      this.database.kysely
        .insertInto("run_recordings")
        .values({
          id: input.id ?? randomUUID(),
          path: normalizedPath,
          source_game: input.sourceGame,
          source_league: input.sourceLeague,
          file_name: basename(normalizedPath),
          duration_seconds: durationSeconds,
          size_bytes: input.sizeBytes ?? 0,
          exists_on_disk: input.exists === false ? 0 : 1,
          mtime_ms: input.mtimeMs ?? 0,
          started_at: input.startedAt,
          stopped_at: input.stoppedAt,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .onConflict((conflict) =>
          conflict.column("path").doUpdateSet({
            source_game: input.sourceGame,
            source_league: input.sourceLeague,
            file_name: basename(normalizedPath),
            duration_seconds: durationSeconds,
            size_bytes: input.sizeBytes ?? 0,
            exists_on_disk: input.exists === false ? 0 : 1,
            mtime_ms: input.mtimeMs ?? 0,
            started_at: input.startedAt,
            stopped_at: input.stoppedAt,
            updated_at: now,
          }),
        ),
    );

    return this.getByPath(normalizedPath) as RunRecordingMetadata;
  }

  updateFileState(
    path: string,
    input: {
      durationSeconds?: number | null;
      exists: boolean;
      mtimeMs?: number;
      sizeBytes: number;
    },
  ): void {
    const normalizedPath = resolve(path);
    const durationSeconds = normalizeDurationSeconds(input.durationSeconds);

    this.database.runQuery(
      this.database.kysely
        .updateTable("run_recordings")
        .set({
          ...(input.durationSeconds !== undefined
            ? { duration_seconds: input.exists ? durationSeconds : null }
            : {}),
          exists_on_disk: input.exists ? 1 : 0,
          file_name: basename(normalizedPath),
          mtime_ms: input.exists ? (input.mtimeMs ?? 0) : 0,
          size_bytes: input.exists ? input.sizeBytes : 0,
          updated_at: new Date().toISOString(),
        })
        .where("path", "=", normalizedPath),
    );
  }

  getItemById(id: string): RunRecordingItem | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("run_recordings")
        .selectAll()
        .where("id", "=", id),
    );

    return row ? mapRunRecordingItemRow(row) : null;
  }

  getItemByPath(path: string): RunRecordingItem | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("run_recordings")
        .selectAll()
        .where("path", "=", resolve(path)),
    );

    return row ? mapRunRecordingItemRow(row) : null;
  }

  getByPath(path: string): RunRecordingMetadata | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("run_recordings")
        .selectAll()
        .where("path", "=", resolve(path)),
    );

    return row ? mapRunRecordingRow(row) : null;
  }

  deleteRunRecordingByPath(path: string): boolean {
    const normalizedPath = resolve(path);
    const existing = this.getByPath(normalizedPath);
    if (!existing) {
      return false;
    }

    this.database.runQuery(
      this.database.kysely
        .deleteFrom("run_recordings")
        .where("path", "=", normalizedPath),
    );

    return true;
  }

  private createFilteredQuery(
    filter: RunRecordingLibraryFilter = {},
  ): RunRecordingFilterQuery {
    let query = this.database.kysely.selectFrom("run_recordings");

    if (filter.game) {
      query = query.where("source_game", "=", filter.game);
    }
    if (filter.createdAfter) {
      query = query.where("created_at", ">=", filter.createdAfter);
    }
    if (filter.includeIds && filter.includeIds.length > 0) {
      query = query.where("id", "in", filter.includeIds);
    }
    const excludeIds = filter.excludeIds;
    if (excludeIds && excludeIds.length > 0) {
      query = query.where((eb) => eb.not(eb("id", "in", excludeIds)));
    }
    if (filter.league) {
      query = query.where("source_league", "=", filter.league);
    }

    return query;
  }

  private getLibrarySortColumn(sortBy: RunRecordingLibrarySortKey) {
    switch (sortBy) {
      case "durationSeconds":
        return "duration_seconds";
      case "fileName":
        return "file_name";
      case "sizeBytes":
        return "size_bytes";
      case "sourceLeague":
        return "source_league";
      case "createdAt":
        return "created_at";
    }
  }
}

export type { RunRecordingStorageEntry };
export { RecordingStorageRepository };
