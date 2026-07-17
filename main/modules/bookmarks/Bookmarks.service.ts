import type { IpcMainInvokeEvent } from "electron";

import type {
  ClientLogActivityEvent,
  ClientLogDeathEvent,
} from "~/main/modules/client-log";
import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import type { RunRecordingItem } from "~/main/modules/recording-storage";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { logInfo } from "~/main/utils/app-log";
import {
  assertNumber,
  assertObject,
  assertString,
  handleValidationError,
  IpcValidationError,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import type { GameId, ReplayClip } from "~/types";
import { BookmarksChannel } from "./Bookmarks.channels";
import { classifyBookmarkLocation } from "./Bookmarks.classifier";
import type {
  ActivitySessionLibraryQuery,
  ActivitySessionTimeline,
  Bookmark,
  BookmarkCategory,
  BookmarkLibraryQuery,
  BookmarkManualCreateResult,
  BookmarkManualUpdateInput,
  BookmarkSubcategory,
  RecordingBookmarksPage,
  RecordingBookmarksQuery,
} from "./Bookmarks.dto";
import { bookmarkCategories } from "./Bookmarks.dto";
import { BookmarksRepository } from "./Bookmarks.repository";

const BOOKMARKS_LOG_SCOPE = "bookmarks";
const manualBookmarkLabel = "Manual bookmark";
const manualReplayBookmarkLabel = "Manual replay";
const deathBookmarkLabel = "Death";
const maxPendingReplayClipSessionLinks = 64;
const maxGeneratedAreaScenePairAgeMs = 30_000;
const bookmarkCategorySet = new Set<BookmarkCategory>(bookmarkCategories);
const bookmarkLibrarySortKeys = new Set<BookmarkLibraryQuery["sortBy"]>([
  "category",
  "label",
  "occurredAt",
  "sourceLeague",
]);
const activitySessionLibrarySortKeys = new Set<
  ActivitySessionLibraryQuery["sortBy"]
>([
  "bookmarkCount",
  "clipCount",
  "durationSeconds",
  "sourceLeague",
  "startedAt",
]);

interface BookmarkSession {
  activitySessionId?: string;
  game: GameId;
  league: string;
  startedAt: string;
}

interface LatestScene {
  category: BookmarkCategory;
  label: string;
  sceneName: string;
  subcategory: BookmarkSubcategory;
}

interface PendingGeneratedArea {
  areaId: string;
  occurredAtMs: number;
}

class BookmarksService {
  private static instance: BookmarksService | null = null;

  private activeRecordingSession: BookmarkSession | null = null;
  private activeRewindSession: BookmarkSession | null = null;
  private latestGeneratedAreaByGame: Record<
    GameId,
    PendingGeneratedArea | null
  > = {
    poe1: null,
    poe2: null,
  };
  private latestSceneByGame: Record<GameId, LatestScene | null> = {
    poe1: null,
    poe2: null,
  };
  private lastBookmarkedSceneByGame: Record<GameId, LatestScene | null> = {
    poe1: null,
    poe2: null,
  };
  private readonly pendingReplayClipSessions = new Map<
    string,
    BookmarkSession & { activitySessionId: string }
  >();

  static getInstance(): BookmarksService {
    if (!BookmarksService.instance) {
      BookmarksService.instance = new BookmarksService();
    }

    return BookmarksService.instance;
  }

  static resetForTests(): void {
    BookmarksService.instance = null;
  }

  private readonly injectedRepository: BookmarksRepository | null;
  private repositoryCache: BookmarksRepository | null = null;
  private repositoryDatabase: DatabaseService | null = null;

  constructor(repository?: BookmarksRepository) {
    this.injectedRepository = repository ?? null;
    this.setupHandlers();
  }

  private get repository(): BookmarksRepository {
    if (this.injectedRepository) {
      return this.injectedRepository;
    }

    const database = DatabaseService.getInstance();
    if (!this.repositoryCache || this.repositoryDatabase !== database) {
      this.repositoryCache = new BookmarksRepository(database);
      this.repositoryDatabase = database;
    }

    return this.repositoryCache;
  }

  beginRecordingSession(input: BookmarkSession): void {
    this.activeRecordingSession = input;
    this.lastBookmarkedSceneByGame[input.game] = null;
    this.createSessionAnchorBookmark(input, "recording");
    logInfo(BOOKMARKS_LOG_SCOPE, "Recording bookmark session started", {
      game: input.game,
      league: input.league,
      startedAt: input.startedAt,
    });
  }

  finalizeRecordingSession(recording: RunRecordingItem): void {
    const session = this.activeRecordingSession;
    this.activeRecordingSession = null;
    if (!session) {
      return;
    }

    this.repository.linkRecordingBookmarks({
      durationSeconds: recording.durationSeconds,
      recordingId: recording.id,
      recordingTitle: recording.fileName,
      sourceGame: recording.sourceGame,
      startedAt: recording.startedAt,
      stoppedAt: recording.stoppedAt,
    });
    logInfo(BOOKMARKS_LOG_SCOPE, "Recording bookmarks linked", {
      game: recording.sourceGame,
      league: recording.sourceLeague,
      recordingId: recording.id,
    });
  }

  discardRecordingSession(): void {
    if (this.activeRecordingSession) {
      this.lastBookmarkedSceneByGame[this.activeRecordingSession.game] = null;
    }
    this.activeRecordingSession = null;
  }

  beginRewindSession(input: BookmarkSession): void {
    const activitySession = this.rewindTrackingEnabled()
      ? this.repository.openActivitySession({
          mode: "rewind",
          sourceGame: input.game,
          sourceLeague: input.league,
          startedAt: input.startedAt,
        })
      : null;
    this.activeRewindSession = {
      ...input,
      ...(activitySession ? { activitySessionId: activitySession.id } : {}),
    };
    this.lastBookmarkedSceneByGame[input.game] = null;
    if (activitySession) {
      this.createSessionAnchorBookmark(this.activeRewindSession, "rewind");
    }
    logInfo(BOOKMARKS_LOG_SCOPE, "Rewind bookmark session started", {
      game: input.game,
      activitySessionId: activitySession?.id ?? null,
      league: input.league,
      startedAt: input.startedAt,
    });
  }

  endRewindSession(): void {
    const session = this.activeRewindSession;
    if (session) {
      this.lastBookmarkedSceneByGame[session.game] = null;
      if (session.activitySessionId) {
        this.repository.closeActivitySession({
          id: session.activitySessionId,
          stoppedAt: new Date().toISOString(),
        });
      }
    }
    this.activeRewindSession = null;
  }

  handleClientLogActivityEvents(
    game: GameId,
    events: ClientLogActivityEvent[],
  ): void {
    for (const event of events) {
      this.applyClientLogActivityEvent(game, event, { createBookmark: true });
    }
  }

  seedClientLogActivityState(
    game: GameId,
    events: ClientLogActivityEvent[],
  ): void {
    for (const event of events) {
      this.applyClientLogActivityEvent(game, event, { createBookmark: false });
    }
  }

  handleClientLogDeath(event: ClientLogDeathEvent): void {
    this.createTrackedBookmark(event.game, {
      category: "death",
      dedupeKey: `client-log:${event.game}:death:${event.lineHash}`,
      label: deathBookmarkLabel,
      occurredAt: event.detectedAt,
      sceneName: this.latestSceneByGame[event.game]?.sceneName ?? null,
      source: "client-log",
      subcategory: null,
    });
  }

  createManualBookmark(): BookmarkManualCreateResult {
    const session = this.resolveActiveSession("recording");
    if (!session) {
      return {
        bookmark: null,
        error: "Manual bookmarks can only be saved while recording is active.",
        ok: false,
      };
    }

    const latestScene = this.latestSceneByGame[session.game];
    const occurredAt = new Date().toISOString();
    const bookmark = this.repository.upsertBookmark({
      category: "manual",
      label: manualBookmarkLabel,
      note: null,
      occurredAt,
      sceneName: latestScene?.sceneName ?? null,
      source: "manual",
      sourceGame: session.game,
      sourceLeague: this.resolveCurrentLeague(),
      subcategory: null,
    });
    this.linkBookmarkToActiveActivitySession(bookmark, session, occurredAt);
    logInfo(BOOKMARKS_LOG_SCOPE, "Manual bookmark saved", {
      game: session.game,
      league: session.league,
      bookmarkId: bookmark.id,
    });

    return { bookmark, error: null, ok: true };
  }

  rememberReplayClipSession(input: {
    game: GameId;
    triggerLineHash: string;
  }): void {
    const session = this.resolveActiveRewindActivitySessionForGame(input.game);
    if (!session) {
      return;
    }

    this.pendingReplayClipSessions.set(input.triggerLineHash, session);
    this.trimPendingReplayClipSessions();
  }

  linkReplayClip(clip: ReplayClip): void {
    const session = this.resolveReplayClipActivitySession(clip);
    if (!session) {
      return;
    }

    const bookmark =
      clip.kind === "manual"
        ? this.createManualReplayBookmarkForClip(clip, session)
        : this.repository.getByDedupeKey(
            `client-log:${clip.sourceGame}:death:${clip.triggerLineHash}`,
          );
    const occurredAt = bookmark?.occurredAt ?? clip.deathTimestamp;

    this.repository.linkActivitySessionClip({
      activitySessionId: session.activitySessionId,
      bookmarkId: bookmark?.id ?? null,
      offsetSeconds: this.calculateSessionOffsetSeconds(session, occurredAt),
      targetId: clip.id,
      targetKind: "replay-clip",
    });
    this.pendingReplayClipSessions.delete(clip.triggerLineHash);
  }

  listActivitySessionTimeline(
    activitySessionId: string,
  ): ActivitySessionTimeline | null {
    return this.repository.listActivitySessionTimeline(activitySessionId);
  }

  listActivitySessions(query: ActivitySessionLibraryQuery = {}) {
    return this.repository.listActivitySessionsPage(query);
  }

  listLibrary(query: BookmarkLibraryQuery = {}) {
    return this.repository.listLibraryPage(query);
  }

  listRecording(
    recordingId: string,
    query: RecordingBookmarksQuery = {},
  ): RecordingBookmarksPage {
    return this.repository.listRecordingBookmarks(recordingId, query);
  }

  updateManual(input: BookmarkManualUpdateInput): void {
    this.repository.updateManual(input);
  }

  deleteManual(id: string): void {
    this.repository.deleteManual(id);
  }

  archiveRecordingLinks(recording: RunRecordingItem): void {
    this.repository.archiveRecordingLinks({
      recordingDurationSeconds: recording.durationSeconds,
      recordingId: recording.id,
      recordingTitle: recording.fileName,
    });
  }

  deleteBookmarksForRecording(recordingId: string): void {
    this.repository.deleteBookmarksForRecording(recordingId);
  }

  deleteBookmarksForRecordings(recordingIds: string[]): void {
    this.repository.deleteBookmarksForRecordings(recordingIds);
  }

  deleteReplayClipLinks(replayClipId: string): void {
    this.repository.deleteReplayClipLinks(replayClipId);
  }

  deleteReplayClipLinksMany(replayClipIds: string[]): void {
    this.repository.deleteReplayClipLinksMany(replayClipIds);
  }

  private createTrackedBookmark(
    game: GameId,
    input: {
      category: BookmarkCategory;
      dedupeKey: string;
      label: string;
      occurredAt: string;
      sceneName: string | null;
      source: "client-log";
      subcategory: BookmarkSubcategory;
    },
  ): Bookmark | null {
    const session = this.resolveActiveSessionForGame(game);
    if (!session) {
      return null;
    }

    const bookmark = this.repository.upsertBookmark({
      ...input,
      sourceGame: session.game,
      sourceLeague: this.resolveCurrentLeague(),
    });
    this.linkBookmarkToActiveActivitySession(
      bookmark,
      session,
      input.occurredAt,
    );
    logInfo(BOOKMARKS_LOG_SCOPE, "Tracked bookmark saved", {
      activitySessionId: session.activitySessionId ?? null,
      bookmarkId: bookmark.id,
      category: bookmark.category,
      game: session.game,
      label: bookmark.label,
      league: session.league,
    });

    return bookmark;
  }

  private createManualReplayBookmarkForClip(
    clip: ReplayClip,
    session: BookmarkSession & { activitySessionId: string },
  ): Bookmark {
    const latestScene = this.latestSceneByGame[session.game];
    const bookmark = this.repository.upsertBookmark({
      category: "rewind-manual-replay",
      dedupeKey: `system:${clip.sourceGame}:manual-replay:${clip.triggerLineHash}`,
      label: manualReplayBookmarkLabel,
      occurredAt: clip.deathTimestamp,
      sceneName: latestScene?.sceneName ?? null,
      source: "system",
      sourceGame: clip.sourceGame,
      sourceLeague: clip.sourceLeague,
      subcategory: null,
    });
    this.linkBookmarkToActiveActivitySession(
      bookmark,
      session,
      clip.deathTimestamp,
    );

    return bookmark;
  }

  private linkBookmarkToActiveActivitySession(
    bookmark: Bookmark,
    session: BookmarkSession,
    occurredAt: string,
  ): void {
    if (!session.activitySessionId) {
      return;
    }

    this.repository.linkActivitySessionBookmark({
      activitySessionId: session.activitySessionId,
      bookmarkId: bookmark.id,
      offsetSeconds: this.calculateSessionOffsetSeconds(session, occurredAt),
    });
  }

  private calculateSessionOffsetSeconds(
    session: BookmarkSession,
    occurredAt: string,
  ): number | null {
    const startedAtMs = Date.parse(session.startedAt);
    const occurredAtMs = Date.parse(occurredAt);
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(occurredAtMs)) {
      return null;
    }

    return Math.max(0, (occurredAtMs - startedAtMs) / 1_000);
  }

  private createSessionAnchorBookmark(
    session: BookmarkSession,
    mode: "recording" | "rewind",
  ): void {
    const scene = this.latestSceneByGame[session.game];
    if (!scene) {
      return;
    }

    const bookmark = this.createTrackedBookmark(session.game, {
      category: scene.category,
      dedupeKey: this.createDedupeKey(
        session.game,
        `${mode}:${session.startedAt}`,
        "session-anchor",
      ),
      label: scene.label,
      occurredAt: session.startedAt,
      sceneName: scene.sceneName,
      source: "client-log",
      subcategory: scene.subcategory,
    });
    /* v8 ignore next -- session anchors are created only with an active session, and repository upsert returns either created or existing bookmark. */
    if (bookmark) {
      this.lastBookmarkedSceneByGame[session.game] = scene;
    }
  }

  private applyClientLogActivityEvent(
    game: GameId,
    event: ClientLogActivityEvent,
    options: { createBookmark: boolean },
  ): void {
    if (event.kind === "generated-area") {
      this.latestGeneratedAreaByGame[game] = {
        areaId: event.areaId,
        occurredAtMs: Date.parse(event.occurredAt),
      };
      return;
    }

    const generatedArea = this.latestGeneratedAreaByGame[game];
    if (!generatedArea) {
      return;
    }
    this.latestGeneratedAreaByGame[game] = null;
    if (!this.canPairGeneratedAreaWithScene(generatedArea, event.occurredAt)) {
      return;
    }

    const classification = classifyBookmarkLocation({
      areaId: generatedArea.areaId,
      sceneName: event.sceneName,
    });
    const scene: LatestScene = {
      ...classification,
      label: event.sceneName,
      sceneName: event.sceneName,
    };
    this.latestSceneByGame[game] = scene;
    if (
      !options.createBookmark ||
      this.isSameScene(this.lastBookmarkedSceneByGame[game], scene)
    ) {
      return;
    }

    const bookmark = this.createTrackedBookmark(game, {
      category: classification.category,
      dedupeKey: this.createDedupeKey(game, event.sequenceId, "scene"),
      label: event.sceneName,
      occurredAt: event.occurredAt,
      sceneName: event.sceneName,
      source: "client-log",
      subcategory: classification.subcategory,
    });
    if (bookmark) {
      this.lastBookmarkedSceneByGame[game] = scene;
    }
  }

  private canPairGeneratedAreaWithScene(
    generatedArea: PendingGeneratedArea,
    sceneOccurredAt: string,
  ): boolean {
    const sceneOccurredAtMs = Date.parse(sceneOccurredAt);
    if (
      !Number.isFinite(generatedArea.occurredAtMs) ||
      !Number.isFinite(sceneOccurredAtMs)
    ) {
      return true;
    }

    return (
      sceneOccurredAtMs >= generatedArea.occurredAtMs &&
      sceneOccurredAtMs - generatedArea.occurredAtMs <=
        maxGeneratedAreaScenePairAgeMs
    );
  }

  private resolveActiveSession(
    preferredMode?: "recording" | "rewind",
  ): BookmarkSession | null {
    if (preferredMode === "recording") {
      return this.activeRecordingSession;
    }
    if (preferredMode === "rewind") {
      return this.activeRewindSession;
    }

    return this.activeRecordingSession ?? this.activeRewindSession;
  }

  private resolveActiveSessionForGame(game: GameId): BookmarkSession | null {
    if (this.activeRecordingSession?.game === game) {
      return this.activeRecordingSession;
    }

    if (
      this.rewindTrackingEnabled() &&
      this.activeRewindSession?.game === game
    ) {
      return this.activeRewindSession;
    }

    return null;
  }

  private resolveActiveRewindActivitySessionForGame(
    game: GameId,
  ): (BookmarkSession & { activitySessionId: string }) | null {
    const session = this.activeRewindSession;
    if (
      !this.rewindTrackingEnabled() ||
      session?.game !== game ||
      !session.activitySessionId
    ) {
      return null;
    }

    return {
      ...session,
      activitySessionId: session.activitySessionId,
    };
  }

  private resolveReplayClipActivitySession(
    clip: ReplayClip,
  ): (BookmarkSession & { activitySessionId: string }) | null {
    const activeSession = this.resolveActiveRewindActivitySessionForGame(
      clip.sourceGame,
    );
    if (activeSession) {
      return activeSession;
    }

    const pendingSession = this.pendingReplayClipSessions.get(
      clip.triggerLineHash,
    );
    return pendingSession?.game === clip.sourceGame ? pendingSession : null;
  }

  private trimPendingReplayClipSessions(): void {
    while (
      this.pendingReplayClipSessions.size > maxPendingReplayClipSessionLinks
    ) {
      const oldestKey = this.pendingReplayClipSessions.keys().next().value;
      /* v8 ignore next -- size is above the cap, so Map.keys() must yield a key. */
      if (!oldestKey) {
        return;
      }
      this.pendingReplayClipSessions.delete(oldestKey);
    }
  }

  private rewindTrackingEnabled(): boolean {
    return SettingsStoreService.getInstance().get()
      .recordingTrackBookmarksInRewind;
  }

  private resolveCurrentLeague(): string {
    return SettingsStoreService.getInstance().get().activeLeague;
  }

  private createDedupeKey(
    game: GameId,
    sequenceId: string,
    eventKind: string,
  ): string {
    return `client-log:${game}:${eventKind}:${sequenceId}`;
  }

  private isSameScene(current: LatestScene | null, next: LatestScene): boolean {
    return (
      current?.sceneName === next.sceneName &&
      current.category === next.category &&
      current.subcategory === next.subcategory
    );
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      BookmarksChannel.CreateManual,
      [WindowName.Main, WindowName.RecorderOverlay],
      () => this.createManualBookmark(),
    );
    registerGuardedIpcHandler(
      BookmarksChannel.DeleteManual,
      [WindowName.Main],
      (_event: IpcMainInvokeEvent, id: unknown) => {
        try {
          assertString(id, "bookmark id", BookmarksChannel.DeleteManual, {
            min: 1,
            max: 128,
          });
          this.deleteManual(id);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      BookmarksChannel.ListLibrary,
      [WindowName.Main],
      (_event: IpcMainInvokeEvent, query: unknown) => {
        try {
          return this.listLibrary(
            query && typeof query === "object" && !Array.isArray(query)
              ? this.parseLibraryQuery(query)
              : {},
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      BookmarksChannel.ListActivitySessions,
      [WindowName.Main],
      (_event: IpcMainInvokeEvent, query: unknown) => {
        try {
          return this.listActivitySessions(
            query && typeof query === "object" && !Array.isArray(query)
              ? this.parseActivitySessionLibraryQuery(query)
              : {},
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      BookmarksChannel.GetActivitySessionTimeline,
      [WindowName.Main],
      (_event: IpcMainInvokeEvent, activitySessionId: unknown) => {
        try {
          assertString(
            activitySessionId,
            "activity session id",
            BookmarksChannel.GetActivitySessionTimeline,
            { min: 1, max: 128 },
          );
          return this.listActivitySessionTimeline(activitySessionId);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      BookmarksChannel.ListRecording,
      [WindowName.Main],
      (_event: IpcMainInvokeEvent, recordingId: unknown, query: unknown) => {
        try {
          assertString(
            recordingId,
            "recording id",
            BookmarksChannel.ListRecording,
            { min: 1, max: 128 },
          );
          return this.listRecording(
            recordingId,
            query && typeof query === "object" && !Array.isArray(query)
              ? this.parseRecordingBookmarksQuery(query)
              : {},
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      BookmarksChannel.UpdateManual,
      [WindowName.Main],
      (_event: IpcMainInvokeEvent, input: unknown) => {
        try {
          assertObject(input, "bookmark update", BookmarksChannel.UpdateManual);
          assertString(input.id, "bookmark id", BookmarksChannel.UpdateManual, {
            min: 1,
            max: 128,
          });
          assertString(
            input.label,
            "bookmark label",
            BookmarksChannel.UpdateManual,
            {
              min: 1,
              max: 120,
            },
          );
          if (input.note !== undefined && input.note !== null) {
            assertString(
              input.note,
              "bookmark note",
              BookmarksChannel.UpdateManual,
              { max: 500 },
            );
          }
          this.updateManual({
            id: input.id,
            label: input.label,
            ...(input.note !== undefined ? { note: input.note } : {}),
          });
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }

  private parseLibraryQuery(input: object): BookmarkLibraryQuery {
    const query = input as Record<string, unknown>;
    const parsed: BookmarkLibraryQuery = {};
    if (query.game !== undefined) {
      assertGameId(query.game, BookmarksChannel.ListLibrary);
      parsed.game = query.game;
    }
    if (query.league !== undefined) {
      assertString(query.league, "league", BookmarksChannel.ListLibrary, {
        min: 1,
        max: 80,
      });
      parsed.league = query.league;
    }
    if (query.category !== undefined) {
      assertBookmarkCategory(query.category, BookmarksChannel.ListLibrary);
      parsed.category = query.category;
    }
    if (query.pageIndex !== undefined) {
      assertNumber(
        query.pageIndex,
        "page index",
        BookmarksChannel.ListLibrary,
        {
          integer: true,
          min: 0,
          max: 10_000,
        },
      );
      parsed.pageIndex = query.pageIndex;
    }
    if (query.pageSize !== undefined) {
      assertNumber(query.pageSize, "page size", BookmarksChannel.ListLibrary, {
        integer: true,
        min: 1,
        max: 100,
      });
      parsed.pageSize = query.pageSize;
    }
    if (query.sortBy !== undefined) {
      assertBookmarkLibrarySortKey(query.sortBy, BookmarksChannel.ListLibrary);
      parsed.sortBy = query.sortBy;
    }
    if (query.sortDirection !== undefined) {
      assertSortDirection(query.sortDirection, BookmarksChannel.ListLibrary);
      parsed.sortDirection = query.sortDirection;
    }

    return parsed;
  }

  private parseActivitySessionLibraryQuery(
    input: object,
  ): ActivitySessionLibraryQuery {
    const query = input as Record<string, unknown>;
    const parsed: ActivitySessionLibraryQuery = {};

    if (query.game !== undefined) {
      assertGameId(query.game, BookmarksChannel.ListActivitySessions);
      parsed.game = query.game;
    }
    if (query.league !== undefined) {
      assertString(
        query.league,
        "league",
        BookmarksChannel.ListActivitySessions,
        {
          min: 1,
          max: 80,
        },
      );
      parsed.league = query.league;
    }
    if (query.pageIndex !== undefined) {
      assertNumber(
        query.pageIndex,
        "page index",
        BookmarksChannel.ListActivitySessions,
        {
          integer: true,
          min: 0,
          max: 10_000,
        },
      );
      parsed.pageIndex = query.pageIndex;
    }
    if (query.pageSize !== undefined) {
      assertNumber(
        query.pageSize,
        "page size",
        BookmarksChannel.ListActivitySessions,
        {
          integer: true,
          min: 1,
          max: 100,
        },
      );
      parsed.pageSize = query.pageSize;
    }
    if (query.sortBy !== undefined) {
      assertActivitySessionLibrarySortKey(
        query.sortBy,
        BookmarksChannel.ListActivitySessions,
      );
      parsed.sortBy = query.sortBy;
    }
    if (query.sortDirection !== undefined) {
      assertSortDirection(
        query.sortDirection,
        BookmarksChannel.ListActivitySessions,
      );
      parsed.sortDirection = query.sortDirection;
    }

    return parsed;
  }

  private parseRecordingBookmarksQuery(input: object): RecordingBookmarksQuery {
    const query = input as Record<string, unknown>;
    const parsed: RecordingBookmarksQuery = {};

    if (query.category !== undefined) {
      assertBookmarkCategory(query.category, BookmarksChannel.ListRecording);
      parsed.category = query.category;
    }
    if (query.includeTimeline !== undefined) {
      if (typeof query.includeTimeline !== "boolean") {
        throw new IpcValidationError(
          BookmarksChannel.ListRecording,
          "include timeline must be a boolean",
        );
      }
      parsed.includeTimeline = query.includeTimeline;
    }
    if (query.pageIndex !== undefined) {
      assertNumber(
        query.pageIndex,
        "page index",
        BookmarksChannel.ListRecording,
        {
          integer: true,
          min: 0,
          max: 10_000,
        },
      );
      parsed.pageIndex = query.pageIndex;
    }
    if (query.pageSize !== undefined) {
      assertNumber(
        query.pageSize,
        "page size",
        BookmarksChannel.ListRecording,
        {
          integer: true,
          min: 1,
          max: 100,
        },
      );
      parsed.pageSize = query.pageSize;
    }

    return parsed;
  }
}

function assertGameId(
  value: unknown,
  channel: BookmarksChannel,
): asserts value is NonNullable<BookmarkLibraryQuery["game"]> {
  if (value !== "poe1" && value !== "poe2") {
    throw new IpcValidationError(channel, "game must be poe1 or poe2");
  }
}

function assertBookmarkCategory(
  value: unknown,
  channel: BookmarksChannel,
): asserts value is BookmarkCategory {
  if (!bookmarkCategorySet.has(value as BookmarkCategory)) {
    throw new IpcValidationError(channel, "bookmark category is invalid");
  }
}

function assertBookmarkLibrarySortKey(
  value: unknown,
  channel: BookmarksChannel,
): asserts value is NonNullable<BookmarkLibraryQuery["sortBy"]> {
  if (!bookmarkLibrarySortKeys.has(value as BookmarkLibraryQuery["sortBy"])) {
    throw new IpcValidationError(channel, "bookmark sort field is invalid");
  }
}

function assertActivitySessionLibrarySortKey(
  value: unknown,
  channel: BookmarksChannel,
): asserts value is NonNullable<ActivitySessionLibraryQuery["sortBy"]> {
  if (
    !activitySessionLibrarySortKeys.has(
      value as ActivitySessionLibraryQuery["sortBy"],
    )
  ) {
    throw new IpcValidationError(channel, "rewind sort field is invalid");
  }
}

function assertSortDirection(
  value: unknown,
  channel: BookmarksChannel,
): asserts value is "asc" | "desc" {
  if (value !== "asc" && value !== "desc") {
    throw new IpcValidationError(channel, "sort direction must be asc or desc");
  }
}

export { BookmarksService };
