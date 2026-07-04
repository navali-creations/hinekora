import { randomUUID } from "node:crypto";

import { type SelectQueryBuilder, sql } from "kysely";

import type { DatabaseService } from "~/main/modules/database";
import type { DatabaseSchema } from "~/main/modules/database/Database.types";

import type { GameId } from "~/types";
import type {
  ActivitySession,
  ActivitySessionBookmark,
  ActivitySessionClip,
  ActivitySessionClipTargetKind,
  ActivitySessionLibraryItem,
  ActivitySessionLibraryPage,
  ActivitySessionLibraryQuery,
  ActivitySessionLibrarySortDirection,
  ActivitySessionLibrarySortKey,
  ActivitySessionMode,
  ActivitySessionTimeline,
  Bookmark,
  BookmarkCategory,
  BookmarkLibraryItem,
  BookmarkLibraryQuery,
  BookmarkLibrarySortDirection,
  BookmarkLibrarySortKey,
  BookmarkLinkTargetKind,
  BookmarkRecordingLink,
  BookmarkSource,
  BookmarkSubcategory,
  RecordingBookmark,
  RecordingBookmarksPage,
  RecordingBookmarksQuery,
} from "./Bookmarks.dto";
import { locationBookmarkCategories } from "./Bookmarks.dto";

interface BookmarkRow {
  id: string;
  source_game: GameId;
  source_league: string;
  source: BookmarkSource;
  category: BookmarkCategory;
  subcategory: BookmarkSubcategory;
  label: string;
  scene_name: string | null;
  note: string | null;
  occurred_at: string;
  dedupe_key: string | null;
  created_at: string;
  updated_at: string;
}

interface BookmarkLinkRow {
  id: string;
  bookmark_id: string;
  target_kind: BookmarkLinkTargetKind;
  target_id: string;
  offset_seconds: number | null;
  duration_seconds: number | null;
  archived: number;
  archived_target_title: string | null;
  archived_target_duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

interface BookmarkLibraryRecordingLink extends BookmarkRecordingLink {
  targetDurationSeconds: number | null;
}

interface BookmarkLibraryRecordingLinks {
  activeLink: BookmarkLibraryRecordingLink | null;
  archivedLink: BookmarkLibraryRecordingLink | null;
}

interface BookmarkLibraryActivitySessionLink {
  bookmarkId: string;
  durationSeconds: number | null;
  offsetSeconds: number | null;
  targetId: string;
  targetDurationSeconds: number | null;
}

interface ActivitySessionLocationOffset {
  bookmarkId: string;
  offsetSeconds: number;
  targetId: string;
}

interface ActivitySessionRow {
  id: string;
  mode: ActivitySessionMode;
  source_game: GameId;
  source_league: string;
  started_at: string;
  stopped_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivitySessionClipRow {
  id: string;
  activity_session_id: string;
  target_kind: ActivitySessionClipTargetKind;
  target_id: string;
  bookmark_id: string | null;
  offset_seconds: number | null;
  duration_seconds: number | null;
  target_duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

interface ActivitySessionLibraryRow extends ActivitySessionRow {
  bookmark_count: number;
  clip_count: number;
}

interface BookmarkCreateInput {
  category: BookmarkCategory;
  dedupeKey?: string | null;
  id?: string;
  label: string;
  note?: string | null;
  occurredAt: string;
  sceneName?: string | null;
  source: BookmarkSource;
  sourceGame: GameId;
  sourceLeague: string;
  subcategory?: BookmarkSubcategory;
}

interface BookmarkFilter {
  category?: BookmarkCategory;
  game?: GameId;
  league?: string;
}

interface ActivitySessionFilter {
  game?: GameId;
  league?: string;
}

interface RecordingWindowInput {
  durationSeconds: number | null;
  recordingId: string;
  recordingTitle: string;
  sourceGame: GameId;
  startedAt: string;
  stoppedAt: string;
}

interface ActivitySessionCreateInput {
  id?: string;
  mode: ActivitySessionMode;
  sourceGame: GameId;
  sourceLeague: string;
  startedAt: string;
}

type BookmarkFilterQuery = SelectQueryBuilder<
  DatabaseSchema,
  "bookmarks",
  Record<keyof any, never>
>;
type ActivitySessionFilterQuery = SelectQueryBuilder<
  DatabaseSchema,
  "activity_sessions",
  Record<keyof any, never>
>;

const defaultBookmarkSortBy: BookmarkLibrarySortKey = "occurredAt";
const defaultBookmarkSortDirection: BookmarkLibrarySortDirection = "desc";
const defaultActivitySessionSortBy: ActivitySessionLibrarySortKey = "startedAt";
const defaultActivitySessionSortDirection: ActivitySessionLibrarySortDirection =
  "desc";
const maxTimelineItems = 2_000;
const locationBookmarkCategorySet = new Set<BookmarkCategory>(
  locationBookmarkCategories,
);

function mapBookmarkRow(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    sourceGame: row.source_game,
    sourceLeague: row.source_league,
    source: row.source,
    category: row.category,
    subcategory: row.subcategory,
    label: row.label,
    sceneName: row.scene_name,
    note: row.note,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBookmarkLinkRow(row: BookmarkLinkRow): BookmarkRecordingLink {
  return {
    id: row.id,
    bookmarkId: row.bookmark_id,
    targetKind: row.target_kind,
    targetId: row.target_id,
    offsetSeconds: row.offset_seconds,
    durationSeconds: row.duration_seconds,
    archived: row.archived === 1,
    archivedTargetTitle: row.archived_target_title,
    archivedTargetDurationSeconds: row.archived_target_duration_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBookmarkLibraryRecordingLinkRow(
  row: BookmarkLinkRow & { target_duration_seconds: number | null },
): BookmarkLibraryRecordingLink {
  return {
    ...mapBookmarkLinkRow(row),
    targetDurationSeconds: row.target_duration_seconds,
  };
}

function mapActivitySessionRow(row: ActivitySessionRow): ActivitySession {
  return {
    id: row.id,
    mode: row.mode,
    sourceGame: row.source_game,
    sourceLeague: row.source_league,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivitySessionClipRow(
  row: ActivitySessionClipRow,
): ActivitySessionClip {
  return {
    id: row.id,
    activitySessionId: row.activity_session_id,
    targetKind: row.target_kind,
    targetId: row.target_id,
    bookmarkId: row.bookmark_id,
    offsetSeconds: row.offset_seconds,
    durationSeconds: row.duration_seconds,
    targetDurationSeconds: row.target_duration_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivitySessionLibraryRow(
  row: ActivitySessionLibraryRow,
): ActivitySessionLibraryItem {
  const session = mapActivitySessionRow(row);

  return {
    ...session,
    bookmarkCount: Number(row.bookmark_count ?? 0),
    clipCount: Number(row.clip_count ?? 0),
    durationSeconds: calculateActivitySessionDurationSeconds(session),
  };
}

function mapRecordingBookmarkRow(
  row: BookmarkRow & {
    duration_seconds: number | null;
    offset_seconds: number | null;
  },
): RecordingBookmark {
  return {
    ...mapBookmarkRow(row),
    offsetSeconds: row.offset_seconds,
    durationSeconds: row.duration_seconds,
  };
}

function mapActivitySessionBookmarkRow(
  row: BookmarkRow & {
    offset_seconds: number | null;
  },
): ActivitySessionBookmark {
  return {
    ...mapBookmarkRow(row),
    offsetSeconds: row.offset_seconds,
  };
}

function calculateActivitySessionDurationSeconds(
  session: Pick<ActivitySession, "startedAt" | "stoppedAt">,
): number | null {
  const startedAtMs = Date.parse(session.startedAt);
  const stoppedAtMs = session.stoppedAt ? Date.parse(session.stoppedAt) : null;
  if (!Number.isFinite(startedAtMs)) {
    return null;
  }

  const endMs =
    stoppedAtMs !== null && Number.isFinite(stoppedAtMs)
      ? stoppedAtMs
      : Date.now();

  return Math.max(0, (endMs - startedAtMs) / 1_000);
}

function normalizePageSize(pageSize: number | undefined): number {
  if (
    typeof pageSize !== "number" ||
    !Number.isInteger(pageSize) ||
    pageSize < 1
  ) {
    return 20;
  }

  return Math.min(pageSize, 100);
}

function normalizePageIndex(pageIndex: number | undefined): number {
  return typeof pageIndex === "number" &&
    Number.isInteger(pageIndex) &&
    pageIndex > 0
    ? pageIndex
    : 0;
}

function normalizeSortBy(
  sortBy: BookmarkLibrarySortKey | undefined,
): BookmarkLibrarySortKey {
  return sortBy ?? defaultBookmarkSortBy;
}

function normalizeSortDirection(
  sortDirection: BookmarkLibrarySortDirection | undefined,
): BookmarkLibrarySortDirection {
  return sortDirection === "asc" ? "asc" : defaultBookmarkSortDirection;
}

function normalizeActivitySessionSortBy(
  sortBy: ActivitySessionLibrarySortKey | undefined,
): ActivitySessionLibrarySortKey {
  return sortBy ?? defaultActivitySessionSortBy;
}

function normalizeActivitySessionSortDirection(
  sortDirection: ActivitySessionLibrarySortDirection | undefined,
): ActivitySessionLibrarySortDirection {
  return sortDirection === "asc" ? "asc" : defaultActivitySessionSortDirection;
}

function isLocationBookmark(bookmark: Bookmark): boolean {
  return locationBookmarkCategorySet.has(bookmark.category);
}

class BookmarksRepository {
  constructor(private readonly database: DatabaseService) {}

  upsertBookmark(input: BookmarkCreateInput): Bookmark {
    const now = new Date().toISOString();
    const id = input.id ?? randomUUID();
    const dedupeKey = input.dedupeKey ?? null;

    this.database.runQuery(
      this.database.kysely
        .insertInto("bookmarks")
        .values({
          id,
          source_game: input.sourceGame,
          source_league: input.sourceLeague,
          source: input.source,
          category: input.category,
          subcategory: input.subcategory ?? null,
          label: input.label,
          scene_name: input.sceneName ?? null,
          note: input.note ?? null,
          occurred_at: input.occurredAt,
          dedupe_key: dedupeKey,
          created_at: now,
          updated_at: now,
        })
        .onConflict((conflict) => conflict.column("dedupe_key").doNothing()),
    );

    return dedupeKey
      ? (this.getByDedupeKey(dedupeKey) as Bookmark)
      : (this.get(id) as Bookmark);
  }

  get(id: string): Bookmark | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("bookmarks")
        .selectAll()
        .where("id", "=", id),
    ) as BookmarkRow | null;

    return row ? mapBookmarkRow(row) : null;
  }

  getByDedupeKey(dedupeKey: string): Bookmark | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("bookmarks")
        .selectAll()
        .where("dedupe_key", "=", dedupeKey),
    ) as BookmarkRow | null;

    return row ? mapBookmarkRow(row) : null;
  }

  listLibraryPage(query: BookmarkLibraryQuery = {}) {
    const filter: BookmarkFilter = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.game ? { game: query.game } : {}),
      ...(query.league ? { league: query.league } : {}),
    };
    const pageIndex = normalizePageIndex(query.pageIndex);
    const pageSize = normalizePageSize(query.pageSize);
    const sortBy = normalizeSortBy(query.sortBy);
    const sortDirection = normalizeSortDirection(query.sortDirection);
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .selectAll()
        .orderBy(this.getSortColumn(sortBy), sortDirection)
        .orderBy("occurred_at", "desc")
        .limit(pageSize)
        .offset(pageIndex * pageSize),
    ) as BookmarkRow[];
    const bookmarks = rows.map(mapBookmarkRow);
    const recordingLinksByBookmarkId =
      this.listPrimaryRecordingLinksByBookmarkIds(
        bookmarks.map((bookmark) => bookmark.id),
      );
    const activitySessionLinksByBookmarkId =
      this.listPrimaryActivitySessionLinksByBookmarkIds(
        bookmarks.map((bookmark) => bookmark.id),
      );
    const items = bookmarks.map((bookmark) =>
      this.mapBookmarkLibraryItem(
        bookmark,
        recordingLinksByBookmarkId.get(bookmark.id) ?? null,
        activitySessionLinksByBookmarkId.get(bookmark.id) ?? null,
      ),
    );
    const totalCount = this.count(filter);

    return {
      items,
      availableCategories: this.listCategories({
        ...(query.game ? { game: query.game } : {}),
        ...(query.league ? { league: query.league } : {}),
      }),
      availableLeagues: this.listLeagues({
        ...(query.game ? { game: query.game } : {}),
      }),
      pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
      pageIndex,
      pageSize,
      sortBy,
      sortDirection,
      totalCount,
    };
  }

  listRecordingBookmarks(
    recordingId: string,
    query: RecordingBookmarksQuery = {},
  ): RecordingBookmarksPage {
    const pageIndex = normalizePageIndex(query.pageIndex);
    const pageSize = normalizePageSize(query.pageSize);
    const category = query.category;
    const rows = this.database.queryAll(
      this.createRecordingBookmarksQuery(recordingId, category)
        .orderBy("bookmarks.occurred_at", "desc")
        .limit(pageSize)
        .offset(pageIndex * pageSize),
    ) as Array<
      BookmarkRow & {
        duration_seconds: number | null;
        offset_seconds: number | null;
      }
    >;
    const timelineRows =
      query.includeTimeline === false
        ? []
        : (this.database.queryAll(
            this.createRecordingBookmarksQuery(recordingId)
              .orderBy("bookmark_links.offset_seconds", "asc")
              .limit(maxTimelineItems + 1),
          ) as Array<
            BookmarkRow & {
              duration_seconds: number | null;
              offset_seconds: number | null;
            }
          >);
    const totalCount = this.countRecordingBookmarks(recordingId, category);

    return {
      availableCategories: this.listRecordingBookmarkCategories(recordingId),
      items: rows.map(mapRecordingBookmarkRow),
      pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
      pageIndex,
      pageSize,
      timelineItems: timelineRows
        .slice(0, maxTimelineItems)
        .map(mapRecordingBookmarkRow),
      timelineItemsTruncated: timelineRows.length > maxTimelineItems,
      totalCount,
    };
  }

  listActivitySessionsPage(
    query: ActivitySessionLibraryQuery = {},
  ): ActivitySessionLibraryPage {
    const filter: ActivitySessionFilter = {
      ...(query.game ? { game: query.game } : {}),
      ...(query.league ? { league: query.league } : {}),
    };
    const pageIndex = normalizePageIndex(query.pageIndex);
    const pageSize = normalizePageSize(query.pageSize);
    const sortBy = normalizeActivitySessionSortBy(query.sortBy);
    const sortDirection = normalizeActivitySessionSortDirection(
      query.sortDirection,
    );
    const bookmarkCountsQuery = this.database.kysely
      .selectFrom("bookmark_links")
      .select([
        "target_id as activity_session_id",
        sql<number>`COUNT(*)`.as("bookmark_count"),
      ])
      .where("target_kind", "=", "activity-session")
      .where("archived", "=", 0)
      .groupBy("target_id")
      .as("bookmark_counts");
    const clipCountsQuery = this.database.kysely
      .selectFrom("activity_session_clips")
      .select(["activity_session_id", sql<number>`COUNT(*)`.as("clip_count")])
      .groupBy("activity_session_id")
      .as("clip_counts");
    const rows = this.database.queryAll(
      this.createActivitySessionFilterQuery(filter)
        .leftJoin(
          bookmarkCountsQuery,
          "bookmark_counts.activity_session_id",
          "activity_sessions.id",
        )
        .leftJoin(
          clipCountsQuery,
          "clip_counts.activity_session_id",
          "activity_sessions.id",
        )
        .select([
          "activity_sessions.id as id",
          "activity_sessions.mode as mode",
          "activity_sessions.source_game as source_game",
          "activity_sessions.source_league as source_league",
          "activity_sessions.started_at as started_at",
          "activity_sessions.stopped_at as stopped_at",
          "activity_sessions.created_at as created_at",
          "activity_sessions.updated_at as updated_at",
          sql<number>`COALESCE(bookmark_counts.bookmark_count, 0)`.as(
            "bookmark_count",
          ),
          sql<number>`COALESCE(clip_counts.clip_count, 0)`.as("clip_count"),
        ])
        .orderBy(this.getActivitySessionSortExpression(sortBy), sortDirection)
        .orderBy("activity_sessions.started_at", "desc")
        .limit(pageSize)
        .offset(pageIndex * pageSize),
    ) as ActivitySessionLibraryRow[];
    const totalCount = this.countActivitySessions(filter);

    return {
      items: rows.map(mapActivitySessionLibraryRow),
      availableLeagues: this.listActivitySessionLeagues({
        ...(query.game ? { game: query.game } : {}),
      }),
      pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
      pageIndex,
      pageSize,
      sortBy,
      sortDirection,
      totalCount,
    };
  }

  openActivitySession(input: ActivitySessionCreateInput): ActivitySession {
    const now = new Date().toISOString();
    const id = input.id ?? randomUUID();

    this.database.runQuery(
      this.database.kysely.insertInto("activity_sessions").values({
        id,
        mode: input.mode,
        source_game: input.sourceGame,
        source_league: input.sourceLeague,
        started_at: input.startedAt,
        stopped_at: null,
        created_at: now,
        updated_at: now,
      }),
    );

    return this.getActivitySession(id) as ActivitySession;
  }

  closeActivitySession(input: {
    id: string;
    stoppedAt: string;
  }): ActivitySession | null {
    this.database.runQuery(
      this.database.kysely
        .updateTable("activity_sessions")
        .set({
          stopped_at: input.stoppedAt,
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", input.id),
    );

    return this.getActivitySession(input.id);
  }

  getActivitySession(id: string): ActivitySession | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("activity_sessions")
        .selectAll()
        .where("id", "=", id),
    ) as ActivitySessionRow | null;

    return row ? mapActivitySessionRow(row) : null;
  }

  listActivitySessionTimeline(
    activitySessionId: string,
  ): ActivitySessionTimeline | null {
    const session = this.getActivitySession(activitySessionId);
    if (!session) {
      return null;
    }

    const bookmarkRows = this.database.queryAll(
      this.createActivitySessionBookmarksQuery(activitySessionId)
        .orderBy("bookmark_links.offset_seconds", "asc")
        .limit(maxTimelineItems + 1),
    ) as Array<
      BookmarkRow & {
        offset_seconds: number | null;
      }
    >;
    const clipRows = this.database.queryAll(
      this.database.kysely
        .selectFrom("activity_session_clips")
        .leftJoin(
          "replay_clips",
          "replay_clips.id",
          "activity_session_clips.target_id",
        )
        .select([
          "activity_session_clips.id as id",
          "activity_session_clips.activity_session_id as activity_session_id",
          "activity_session_clips.target_kind as target_kind",
          "activity_session_clips.target_id as target_id",
          "activity_session_clips.bookmark_id as bookmark_id",
          "activity_session_clips.offset_seconds as offset_seconds",
          "activity_session_clips.created_at as created_at",
          "activity_session_clips.updated_at as updated_at",
          "replay_clips.duration_seconds as duration_seconds",
          "replay_clips.target_duration_seconds as target_duration_seconds",
        ])
        .where("activity_session_id", "=", activitySessionId)
        .orderBy("offset_seconds", "asc")
        .limit(maxTimelineItems + 1),
    ) as ActivitySessionClipRow[];

    return {
      bookmarks: bookmarkRows
        .slice(0, maxTimelineItems)
        .map(mapActivitySessionBookmarkRow),
      bookmarkTimelineItemsTruncated: bookmarkRows.length > maxTimelineItems,
      clips: clipRows.slice(0, maxTimelineItems).map(mapActivitySessionClipRow),
      clipTimelineItemsTruncated: clipRows.length > maxTimelineItems,
      session,
    };
  }

  linkActivitySessionBookmark(input: {
    activitySessionId: string;
    bookmarkId: string;
    offsetSeconds: number | null;
  }): void {
    const now = new Date().toISOString();

    this.database.runQuery(
      this.database.kysely
        .insertInto("bookmark_links")
        .values({
          id: randomUUID(),
          bookmark_id: input.bookmarkId,
          target_kind: "activity-session",
          target_id: input.activitySessionId,
          offset_seconds: input.offsetSeconds,
          duration_seconds: null,
          archived: 0,
          archived_target_title: null,
          archived_target_duration_seconds: null,
          created_at: now,
          updated_at: now,
        })
        .onConflict((conflict) =>
          conflict
            .columns(["bookmark_id", "target_kind", "target_id"])
            .doUpdateSet({
              offset_seconds: input.offsetSeconds,
              duration_seconds: null,
              archived: 0,
              archived_target_title: null,
              archived_target_duration_seconds: null,
              updated_at: now,
            }),
        ),
    );
  }

  linkActivitySessionClip(input: {
    activitySessionId: string;
    bookmarkId: string | null;
    offsetSeconds: number | null;
    targetId: string;
    targetKind: ActivitySessionClipTargetKind;
  }): void {
    const now = new Date().toISOString();

    this.database.runQuery(
      this.database.kysely
        .insertInto("activity_session_clips")
        .values({
          id: randomUUID(),
          activity_session_id: input.activitySessionId,
          target_kind: input.targetKind,
          target_id: input.targetId,
          bookmark_id: input.bookmarkId,
          offset_seconds: input.offsetSeconds,
          created_at: now,
          updated_at: now,
        })
        .onConflict((conflict) =>
          conflict
            .columns(["activity_session_id", "target_kind", "target_id"])
            .doUpdateSet({
              bookmark_id: input.bookmarkId,
              offset_seconds: input.offsetSeconds,
              updated_at: now,
            }),
        ),
    );
  }

  linkRecordingBookmarks(input: RecordingWindowInput): void {
    const bookmarks = this.listBookmarksInRecordingWindow(input);
    if (bookmarks.length === 0) {
      return;
    }

    const startedAtMs = Date.parse(input.startedAt);
    const durationSeconds = input.durationSeconds;
    const sortedBookmarks = bookmarks.sort(
      (left, right) =>
        Date.parse(left.occurredAt) - Date.parse(right.occurredAt),
    );

    this.database.transaction(() => {
      for (const [index, bookmark] of sortedBookmarks.entries()) {
        const occurredAtMs = Date.parse(bookmark.occurredAt);
        const offsetSeconds =
          Number.isFinite(startedAtMs) && Number.isFinite(occurredAtMs)
            ? Math.max(0, (occurredAtMs - startedAtMs) / 1_000)
            : null;
        const segmentDurationSeconds = isLocationBookmark(bookmark)
          ? this.calculateLocationDurationSeconds({
              durationSeconds,
              offsetSeconds,
              sortedBookmarks,
              startedAtMs,
              startIndex: index,
            })
          : null;

        this.upsertRecordingLink({
          archivedTargetDurationSeconds: null,
          archivedTargetTitle: null,
          bookmarkId: bookmark.id,
          durationSeconds: segmentDurationSeconds,
          offsetSeconds,
          recordingId: input.recordingId,
        });
      }
    });
  }

  private calculateLocationDurationSeconds(input: {
    durationSeconds: number | null;
    offsetSeconds: number | null;
    sortedBookmarks: Bookmark[];
    startedAtMs: number;
    startIndex: number;
  }): number | null {
    if (input.offsetSeconds === null) {
      return null;
    }

    let nextLocationBookmark: Bookmark | null = null;
    for (
      let index = input.startIndex + 1;
      index < input.sortedBookmarks.length;
      index += 1
    ) {
      const bookmark = input.sortedBookmarks[index];
      if (bookmark && isLocationBookmark(bookmark)) {
        nextLocationBookmark = bookmark;
        break;
      }
    }
    const nextOffsetSeconds = nextLocationBookmark
      ? Math.max(
          0,
          (Date.parse(nextLocationBookmark.occurredAt) - input.startedAtMs) /
            1_000,
        )
      : null;

    if (nextOffsetSeconds !== null) {
      return Math.max(0, nextOffsetSeconds - input.offsetSeconds);
    }

    return input.durationSeconds !== null
      ? Math.max(0, input.durationSeconds - input.offsetSeconds)
      : null;
  }

  archiveRecordingLinks(input: {
    recordingId: string;
    recordingTitle: string;
    recordingDurationSeconds: number | null;
  }): void {
    this.database.runQuery(
      this.database.kysely
        .updateTable("bookmark_links")
        .set({
          archived: 1,
          archived_target_title: input.recordingTitle,
          archived_target_duration_seconds: input.recordingDurationSeconds,
          updated_at: new Date().toISOString(),
        })
        .where("target_kind", "=", "recording")
        .where("target_id", "=", input.recordingId),
    );
  }

  deleteBookmarksForRecording(recordingId: string): void {
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("bookmark_links")
        .select("bookmark_id")
        .where("target_kind", "=", "recording")
        .where("target_id", "=", recordingId),
    ) as Array<{ bookmark_id: string }>;

    this.database.transaction(() => {
      for (const row of rows) {
        this.database.runQuery(
          this.database.kysely
            .deleteFrom("bookmarks")
            .where("id", "=", row.bookmark_id),
        );
      }
    });
  }

  deleteReplayClipLinks(replayClipId: string): void {
    const manualReplayBookmarkRows = this.database.queryAll(
      this.database.kysely
        .selectFrom("activity_session_clips")
        .innerJoin(
          "bookmarks",
          "bookmarks.id",
          "activity_session_clips.bookmark_id",
        )
        .select("bookmarks.id as id")
        .where("activity_session_clips.target_kind", "=", "replay-clip")
        .where("activity_session_clips.target_id", "=", replayClipId)
        .where("bookmarks.category", "=", "rewind-manual-replay"),
    ) as Array<{ id: string }>;

    this.database.transaction(() => {
      this.database.runQuery(
        this.database.kysely
          .deleteFrom("activity_session_clips")
          .where("target_kind", "=", "replay-clip")
          .where("target_id", "=", replayClipId),
      );

      for (const row of manualReplayBookmarkRows) {
        this.database.runQuery(
          this.database.kysely
            .deleteFrom("bookmarks")
            .where("id", "=", row.id)
            .where("category", "=", "rewind-manual-replay"),
        );
      }
    });
  }

  updateManual(input: {
    id: string;
    label: string;
    note?: string | null;
  }): void {
    this.database.runQuery(
      this.database.kysely
        .updateTable("bookmarks")
        .set({
          label: input.label,
          ...(input.note !== undefined ? { note: input.note } : {}),
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", input.id)
        .where("category", "=", "manual")
        .where("source", "=", "manual"),
    );
  }

  deleteManual(id: string): void {
    this.database.runQuery(
      this.database.kysely
        .deleteFrom("bookmarks")
        .where("id", "=", id)
        .where("category", "=", "manual")
        .where("source", "=", "manual"),
    );
  }

  private listBookmarksInRecordingWindow(
    input: RecordingWindowInput,
  ): Bookmark[] {
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("bookmarks")
        .selectAll()
        .where("source_game", "=", input.sourceGame)
        .where("occurred_at", ">=", input.startedAt)
        .where("occurred_at", "<=", input.stoppedAt)
        .orderBy("occurred_at", "asc"),
    ) as BookmarkRow[];

    return rows.map(mapBookmarkRow);
  }

  private upsertRecordingLink(input: {
    archivedTargetDurationSeconds: number | null;
    archivedTargetTitle: string | null;
    bookmarkId: string;
    durationSeconds: number | null;
    offsetSeconds: number | null;
    recordingId: string;
  }): void {
    const now = new Date().toISOString();

    this.database.runQuery(
      this.database.kysely
        .insertInto("bookmark_links")
        .values({
          id: randomUUID(),
          bookmark_id: input.bookmarkId,
          target_kind: "recording",
          target_id: input.recordingId,
          offset_seconds: input.offsetSeconds,
          duration_seconds: input.durationSeconds,
          archived: 0,
          archived_target_title: input.archivedTargetTitle,
          archived_target_duration_seconds: input.archivedTargetDurationSeconds,
          created_at: now,
          updated_at: now,
        })
        .onConflict((conflict) =>
          conflict
            .columns(["bookmark_id", "target_kind", "target_id"])
            .doUpdateSet({
              offset_seconds: input.offsetSeconds,
              duration_seconds: input.durationSeconds,
              archived: 0,
              archived_target_title: input.archivedTargetTitle,
              archived_target_duration_seconds:
                input.archivedTargetDurationSeconds,
              updated_at: now,
            }),
        ),
    );
  }

  private mapBookmarkLibraryItem(
    bookmark: Bookmark,
    recordingLinks: BookmarkLibraryRecordingLinks | null,
    activitySessionLink: BookmarkLibraryActivitySessionLink | null,
  ): BookmarkLibraryItem {
    const activeLink = recordingLinks?.activeLink ?? null;
    const archivedLink = recordingLinks?.archivedLink ?? null;

    return {
      ...bookmark,
      activeActivitySessionBookmarkDurationSeconds:
        activitySessionLink?.durationSeconds ?? null,
      activeActivitySessionId: activitySessionLink?.targetId ?? null,
      activeActivitySessionDurationSeconds:
        activitySessionLink?.targetDurationSeconds ?? null,
      activeActivitySessionOffsetSeconds:
        activitySessionLink?.offsetSeconds ?? null,
      activeRecordingBookmarkDurationSeconds:
        activeLink?.durationSeconds ?? null,
      activeRecordingDurationSeconds: activeLink?.targetDurationSeconds ?? null,
      activeRecordingId: activeLink?.targetId ?? null,
      activeRecordingOffsetSeconds: activeLink?.offsetSeconds ?? null,
      archivedRecordingBookmarkDurationSeconds:
        archivedLink?.durationSeconds ?? null,
      archivedRecordingId: archivedLink?.targetId ?? null,
      archivedRecordingTitle: archivedLink?.archivedTargetTitle ?? null,
      archivedRecordingDurationSeconds:
        archivedLink?.archivedTargetDurationSeconds ?? null,
    };
  }

  private listPrimaryRecordingLinksByBookmarkIds(
    bookmarkIds: string[],
  ): Map<string, BookmarkLibraryRecordingLinks> {
    if (bookmarkIds.length === 0) {
      return new Map();
    }

    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("bookmark_links")
        .leftJoin("run_recordings", (join) =>
          join
            .onRef("run_recordings.id", "=", "bookmark_links.target_id")
            .on("bookmark_links.target_kind", "=", "recording")
            .on("bookmark_links.archived", "=", 0),
        )
        .select([
          "bookmark_links.id as id",
          "bookmark_links.bookmark_id as bookmark_id",
          "bookmark_links.target_kind as target_kind",
          "bookmark_links.target_id as target_id",
          "bookmark_links.offset_seconds as offset_seconds",
          "bookmark_links.duration_seconds as duration_seconds",
          "bookmark_links.archived as archived",
          "bookmark_links.archived_target_title as archived_target_title",
          "bookmark_links.archived_target_duration_seconds as archived_target_duration_seconds",
          "bookmark_links.created_at as created_at",
          "bookmark_links.updated_at as updated_at",
          "run_recordings.duration_seconds as target_duration_seconds",
        ])
        .where("bookmark_links.bookmark_id", "in", bookmarkIds)
        .where("bookmark_links.target_kind", "=", "recording")
        .orderBy("bookmark_links.bookmark_id", "asc")
        .orderBy("bookmark_links.archived", "asc")
        .orderBy("bookmark_links.updated_at", "desc"),
    ) as Array<BookmarkLinkRow & { target_duration_seconds: number | null }>;

    const linksByBookmarkId = new Map<string, BookmarkLibraryRecordingLinks>();

    for (const row of rows) {
      const entry = linksByBookmarkId.get(row.bookmark_id) ?? {
        activeLink: null,
        archivedLink: null,
      };

      if (row.archived === 1) {
        entry.archivedLink ??= mapBookmarkLibraryRecordingLinkRow(row);
      } else {
        entry.activeLink ??= mapBookmarkLibraryRecordingLinkRow(row);
      }

      linksByBookmarkId.set(row.bookmark_id, entry);
    }

    return linksByBookmarkId;
  }

  private listPrimaryActivitySessionLinksByBookmarkIds(
    bookmarkIds: string[],
  ): Map<string, BookmarkLibraryActivitySessionLink> {
    if (bookmarkIds.length === 0) {
      return new Map();
    }

    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("bookmark_links")
        .innerJoin("bookmarks", "bookmarks.id", "bookmark_links.bookmark_id")
        .innerJoin(
          "activity_sessions",
          "activity_sessions.id",
          "bookmark_links.target_id",
        )
        .select([
          "bookmark_links.bookmark_id as bookmark_id",
          "bookmark_links.target_id as target_id",
          "bookmark_links.offset_seconds as offset_seconds",
          "bookmarks.category as category",
          sql<number>`COALESCE(strftime('%s', activity_sessions.stopped_at), strftime('%s', 'now')) - strftime('%s', activity_sessions.started_at)`.as(
            "target_duration_seconds",
          ),
        ])
        .where("bookmark_links.bookmark_id", "in", bookmarkIds)
        .where("bookmark_links.target_kind", "=", "activity-session")
        .where("bookmark_links.archived", "=", 0)
        .orderBy("bookmark_links.bookmark_id", "asc")
        .orderBy("bookmark_links.updated_at", "desc"),
    ) as Array<{
      bookmark_id: string;
      category: BookmarkCategory;
      offset_seconds: number | null;
      target_id: string;
      target_duration_seconds: number | null;
    }>;
    const locationOffsetsBySessionId =
      this.listActivitySessionLocationOffsetsBySessionIds(
        Array.from(new Set(rows.map((row) => row.target_id))),
      );

    const linksByBookmarkId = new Map<
      string,
      BookmarkLibraryActivitySessionLink
    >();
    for (const row of rows) {
      if (linksByBookmarkId.has(row.bookmark_id)) {
        continue;
      }

      linksByBookmarkId.set(row.bookmark_id, {
        bookmarkId: row.bookmark_id,
        durationSeconds: this.calculateActivitySessionBookmarkDurationSeconds({
          bookmarkId: row.bookmark_id,
          category: row.category,
          locationOffsets: locationOffsetsBySessionId.get(row.target_id) ?? [],
          offsetSeconds: row.offset_seconds,
          targetDurationSeconds: row.target_duration_seconds,
        }),
        offsetSeconds: row.offset_seconds,
        targetId: row.target_id,
        targetDurationSeconds: row.target_duration_seconds,
      });
    }

    return linksByBookmarkId;
  }

  private listActivitySessionLocationOffsetsBySessionIds(
    activitySessionIds: string[],
  ): Map<string, ActivitySessionLocationOffset[]> {
    if (activitySessionIds.length === 0) {
      return new Map();
    }

    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("bookmark_links")
        .innerJoin("bookmarks", "bookmarks.id", "bookmark_links.bookmark_id")
        .select([
          "bookmark_links.bookmark_id as bookmark_id",
          "bookmark_links.target_id as target_id",
          "bookmark_links.offset_seconds as offset_seconds",
        ])
        .where("bookmark_links.target_kind", "=", "activity-session")
        .where("bookmark_links.archived", "=", 0)
        .where("bookmark_links.target_id", "in", activitySessionIds)
        .where("bookmark_links.offset_seconds", "is not", null)
        .where(
          "bookmarks.category",
          "in",
          Array.from(locationBookmarkCategorySet),
        )
        .orderBy("bookmark_links.target_id", "asc")
        .orderBy("bookmark_links.offset_seconds", "asc"),
    ) as Array<{
      bookmark_id: string;
      offset_seconds: number;
      target_id: string;
    }>;

    const offsetsBySessionId = new Map<
      string,
      ActivitySessionLocationOffset[]
    >();
    for (const row of rows) {
      const offsets = offsetsBySessionId.get(row.target_id) ?? [];
      offsets.push({
        bookmarkId: row.bookmark_id,
        offsetSeconds: row.offset_seconds,
        targetId: row.target_id,
      });
      offsetsBySessionId.set(row.target_id, offsets);
    }

    return offsetsBySessionId;
  }

  private calculateActivitySessionBookmarkDurationSeconds(input: {
    bookmarkId: string;
    category: BookmarkCategory;
    locationOffsets: ActivitySessionLocationOffset[];
    offsetSeconds: number | null;
    targetDurationSeconds: number | null;
  }): number | null {
    if (
      !locationBookmarkCategorySet.has(input.category) ||
      input.offsetSeconds === null ||
      input.targetDurationSeconds === null
    ) {
      return null;
    }

    const offsetSeconds = input.offsetSeconds;
    const nextLocation = input.locationOffsets.find(
      (locationOffset) =>
        locationOffset.bookmarkId !== input.bookmarkId &&
        locationOffset.offsetSeconds > offsetSeconds,
    );
    const endSeconds =
      nextLocation?.offsetSeconds ?? input.targetDurationSeconds;

    return Math.max(0, endSeconds - offsetSeconds);
  }

  private count(filter: BookmarkFilter): number {
    const row = this.database.queryOne(
      this.createFilteredQuery(filter).select((eb) =>
        eb.fn.countAll<number>().as("count"),
      ),
    ) as { count: number } | null;

    return Number(row?.count ?? 0);
  }

  private listCategories(filter: BookmarkFilter = {}): BookmarkCategory[] {
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .select("category")
        .distinct()
        .orderBy("category", "asc"),
    ) as Array<{ category: BookmarkCategory }>;

    return rows.map((row) => row.category);
  }

  private listLeagues(filter: BookmarkFilter = {}): string[] {
    const rows = this.database.queryAll(
      this.createFilteredQuery(filter)
        .select("source_league")
        .distinct()
        .where("source_league", "!=", "")
        .orderBy("source_league", "asc"),
    ) as Array<{ source_league: string }>;

    return rows.map((row) => row.source_league);
  }

  private createFilteredQuery(
    filter: BookmarkFilter = {},
  ): BookmarkFilterQuery {
    let query = this.database.kysely.selectFrom("bookmarks");

    if (filter.game) {
      query = query.where("source_game", "=", filter.game);
    }
    if (filter.league) {
      query = query.where("source_league", "=", filter.league);
    }
    if (filter.category) {
      query = query.where("category", "=", filter.category);
    }

    return query;
  }

  private createActivitySessionFilterQuery(
    filter: ActivitySessionFilter = {},
  ): ActivitySessionFilterQuery {
    let query = this.database.kysely
      .selectFrom("activity_sessions")
      .where("mode", "=", "rewind");

    if (filter.game) {
      query = query.where("source_game", "=", filter.game);
    }
    if (filter.league) {
      query = query.where("source_league", "=", filter.league);
    }

    return query;
  }

  private getSortColumn(sortBy: BookmarkLibrarySortKey) {
    switch (sortBy) {
      case "category":
        return "category";
      case "label":
        return "label";
      case "sourceLeague":
        return "source_league";
      default:
        return "occurred_at";
    }
  }

  private getActivitySessionSortExpression(
    sortBy: ActivitySessionLibrarySortKey,
  ) {
    switch (sortBy) {
      case "bookmarkCount":
        return sql<number>`COALESCE(bookmark_counts.bookmark_count, 0)`;
      case "clipCount":
        return sql<number>`COALESCE(clip_counts.clip_count, 0)`;
      case "durationSeconds":
        return sql<number>`COALESCE(strftime('%s', activity_sessions.stopped_at), strftime('%s', 'now')) - strftime('%s', activity_sessions.started_at)`;
      case "sourceLeague":
        return "activity_sessions.source_league";
      default:
        return "activity_sessions.started_at";
    }
  }

  private countRecordingBookmarks(
    recordingId: string,
    category?: BookmarkCategory,
  ): number {
    const row = this.database.queryOne(
      this.createRecordingBookmarksQuery(recordingId, category)
        .clearSelect()
        .select((eb) => eb.fn.countAll<number>().as("count")),
    ) as { count: number } | null;

    return Number(row?.count ?? 0);
  }

  private listRecordingBookmarkCategories(
    recordingId: string,
  ): BookmarkCategory[] {
    const rows = this.database.queryAll(
      this.createRecordingBookmarksQuery(recordingId)
        .clearSelect()
        .select("bookmarks.category as category")
        .distinct()
        .orderBy("bookmarks.category", "asc"),
    ) as Array<{ category: BookmarkCategory }>;

    return rows.map((row) => row.category);
  }

  private countActivitySessions(filter: ActivitySessionFilter): number {
    const row = this.database.queryOne(
      this.createActivitySessionFilterQuery(filter).select((eb) =>
        eb.fn.countAll<number>().as("count"),
      ),
    ) as { count: number } | null;

    return Number(row?.count ?? 0);
  }

  private listActivitySessionLeagues(
    filter: ActivitySessionFilter = {},
  ): string[] {
    const rows = this.database.queryAll(
      this.createActivitySessionFilterQuery(filter)
        .select("source_league")
        .distinct()
        .where("source_league", "!=", "")
        .orderBy("source_league", "asc"),
    ) as Array<{ source_league: string }>;

    return rows.map((row) => row.source_league);
  }

  private createRecordingBookmarksQuery(
    recordingId: string,
    category?: BookmarkCategory,
  ) {
    let query = this.database.kysely
      .selectFrom("bookmark_links")
      .innerJoin("bookmarks", "bookmarks.id", "bookmark_links.bookmark_id")
      .select([
        "bookmarks.id as id",
        "bookmarks.source_game as source_game",
        "bookmarks.source_league as source_league",
        "bookmarks.source as source",
        "bookmarks.category as category",
        "bookmarks.subcategory as subcategory",
        "bookmarks.label as label",
        "bookmarks.scene_name as scene_name",
        "bookmarks.note as note",
        "bookmarks.occurred_at as occurred_at",
        "bookmarks.dedupe_key as dedupe_key",
        "bookmarks.created_at as created_at",
        "bookmarks.updated_at as updated_at",
        "bookmark_links.offset_seconds as offset_seconds",
        "bookmark_links.duration_seconds as duration_seconds",
      ])
      .where("bookmark_links.target_kind", "=", "recording")
      .where("bookmark_links.target_id", "=", recordingId)
      .where("bookmark_links.archived", "=", 0);

    if (category) {
      query = query.where("bookmarks.category", "=", category);
    }

    return query;
  }

  private createActivitySessionBookmarksQuery(activitySessionId: string) {
    return this.database.kysely
      .selectFrom("bookmark_links")
      .innerJoin("bookmarks", "bookmarks.id", "bookmark_links.bookmark_id")
      .select([
        "bookmarks.id as id",
        "bookmarks.source_game as source_game",
        "bookmarks.source_league as source_league",
        "bookmarks.source as source",
        "bookmarks.category as category",
        "bookmarks.subcategory as subcategory",
        "bookmarks.label as label",
        "bookmarks.scene_name as scene_name",
        "bookmarks.note as note",
        "bookmarks.occurred_at as occurred_at",
        "bookmarks.dedupe_key as dedupe_key",
        "bookmarks.created_at as created_at",
        "bookmarks.updated_at as updated_at",
        "bookmark_links.offset_seconds as offset_seconds",
      ])
      .where("bookmark_links.target_kind", "=", "activity-session")
      .where("bookmark_links.target_id", "=", activitySessionId)
      .where("bookmark_links.archived", "=", 0);
  }
}

export { BookmarksRepository };
