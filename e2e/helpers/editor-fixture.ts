import { expect, type Locator, type Page } from "@playwright/test";

import type {
  RecordingBookmarksPage,
  RecordingBookmarksQuery,
} from "../../main/modules/bookmarks";
import type {
  EditorCreateProjectInput,
  EditorExportInput,
  EditorMediaAsset,
  EditorMediaAssetPageQuery,
  EditorProject,
  EditorProjectSummary,
  EditorTimelineClip,
  EditorWorkspace,
  EditorWorkspaceQuery,
} from "../../main/modules/editor";
import {
  createEditorProjectPersistedMetadata,
  type EditorProjectSourceLeagueMembership,
} from "../../main/modules/editor/EditorProject.metadata";
import type {
  SavedEditItem,
  SavedEditsLibraryPage,
  SavedEditsLibraryQuery,
  SavedEditsLibrarySortKey,
} from "../../main/modules/saved-edits";
import {
  type AppSettings,
  createDefaultSettings,
  type ManagedRecorderStatus,
} from "../../types";
import {
  type E2EBridgeDomainFactory,
  type E2EBridgeDomainMethods,
  e2eBridgeDomainFactorySource,
} from "./bridge-fixture";
import {
  type E2EPoeProcessSnapshotFactory,
  e2ePoeProcessSnapshotFactoryScript,
} from "./poe-process-fixture";

interface TimelineClipSnapshot {
  durationSeconds: number;
  id: string;
  startSeconds: number;
}

interface EditorE2ECalls {
  copiedExportIds: string[];
  copyRequests: unknown[];
  createProjectInputs: unknown[];
  debugClipboardWrites: string[];
  deleteAllCount: number;
  deletedProjectIds: string[];
  deletedSavedEditIds: string[];
  exportRequests: unknown[];
  mediaAssetQueries: unknown[];
  revealedClipIds: string[];
  revealedExportIds: string[];
  revealedSavedEditIds: string[];
  recordingBookmarkQueries: Array<{ query: unknown; recordingId: string }>;
  savedEditDeleteAllCount: number;
  savedProjects: Array<{
    id: string;
    title: string;
    tracks: Array<{ clips: TimelineClipSnapshot[] }>;
  }>;
  settingsUpdates: Array<Record<string, unknown>>;
  unexpectedBridgeCalls: string[];
  workspaceQueries: unknown[];
}

interface EditorE2EFixture {
  assets: {
    deathAsset: EditorMediaAsset;
    manualAsset: EditorMediaAsset;
    mediaAssets: EditorMediaAsset[];
    recordingAsset: EditorMediaAsset;
  };
  emptyProject: EditorProject;
  extraProjects: EditorProject[];
  historyOverflowProject: EditorProject;
  now: string;
  mixedLeagueProject: EditorProject;
  primaryProject: EditorProject;
  recordingBookmarkPages: Record<string, RecordingBookmarksPage>;
  recordingStatus: ManagedRecorderStatus;
  savedEditRecords: EditorE2ESavedEditRecord[];
  secondaryProject: EditorProject;
  settings: AppSettings;
}

type EditorE2EElectron = Window["electron"];

interface EditorE2ESavedEditRecord {
  item: SavedEditItem;
  sourceLeagueMemberships: EditorProjectSourceLeagueMembership[];
}

interface SetupEditorE2EOptions {
  extraAssets?: EditorMediaAsset[];
  extraProjects?: EditorProject[];
  initialRoute?: string;
  recordingBookmarkPages?: Record<string, RecordingBookmarksPage>;
}

const editorE2ENow = "2026-06-25T00:00:00.000Z";

function createEditorE2EFixture(): EditorE2EFixture {
  const recentAssetCreatedAt = new Date().toISOString();
  const deathAsset = createEditorE2EAsset({
    category: "death-clip",
    id: "asset-1",
    kind: "clip",
    name: "asset-1.mp4",
    subtitle: "Death clip - Standard",
  });
  const manualAsset = createEditorE2EAsset({
    category: "manual-replay",
    id: "manual-1",
    kind: "clip",
    name: "manual-1.mp4",
    subtitle: "Manual replay - Standard",
  });
  const recordingAsset = createEditorE2EAsset({
    category: "recording",
    id: "recording-1",
    kind: "recording",
    name: "recording-1.mp4",
    subtitle: "Recording - Standard",
  });
  const runesDeathAsset = createEditorE2EAsset({
    category: "death-clip",
    id: "asset-runes",
    kind: "clip",
    name: "asset-runes.mp4",
    sourceLeague: "Runes of Aldur",
    subtitle: "Death clip - Runes of Aldur",
  });
  const extraDeathAssets = Array.from({ length: 6 }, (_, index) =>
    createEditorE2EAsset({
      category: "death-clip",
      ...(index === 0 ? { createdAt: recentAssetCreatedAt } : {}),
      id: `asset-${index + 2}`,
      kind: "clip",
      name: `asset-${index + 2}.mp4`,
      subtitle: "Death clip - Standard",
    }),
  );
  const mediaAssets = [
    deathAsset,
    ...extraDeathAssets,
    runesDeathAsset,
    manualAsset,
    recordingAsset,
  ];
  const primaryProject = createEditorE2EProject({
    asset: deathAsset,
    clips: [
      createEditorE2EClip(deathAsset, {
        durationSeconds: 1,
        id: "timeline-c",
        startSeconds: 4,
      }),
      createEditorE2EClip(deathAsset, {
        durationSeconds: 2,
        id: "timeline-b",
        startSeconds: 1,
      }),
      createEditorE2EClip(deathAsset, {
        durationSeconds: 2,
        id: "timeline-a",
        startSeconds: 0,
      }),
    ],
    id: "project-1",
    title: "asset-1.mp4 edit",
  });
  const secondaryProject = createEditorE2EProject({
    asset: deathAsset,
    clips: [
      createEditorE2EClip(deathAsset, {
        durationSeconds: 3,
        id: "timeline-second",
        startSeconds: 0,
      }),
    ],
    id: "project-2",
    title: "secondary.mp4 edit",
  });
  const mixedLeagueProject = createEditorE2EProject({
    asset: deathAsset,
    assets: [deathAsset, runesDeathAsset],
    clips: [
      createEditorE2EClip(deathAsset, {
        durationSeconds: 3,
        id: "timeline-mixed-standard",
        startSeconds: 0,
      }),
      createEditorE2EClip(runesDeathAsset, {
        durationSeconds: 3,
        id: "timeline-mixed-runes",
        startSeconds: 3,
      }),
    ],
    id: "project-mixed-league",
    title: "mixed league edit",
  });
  const emptyProject = createEditorE2EProject({
    asset: deathAsset,
    clips: [],
    id: "project-empty",
    title: "Untitled edit",
  });
  const historyOverflowProject = {
    ...createEditorE2EProject({
      asset: deathAsset,
      clips: [
        createEditorE2EClip(deathAsset, {
          durationSeconds: 3,
          id: "timeline-history-overflow",
          startSeconds: 0,
        }),
      ],
      id: "project-history-overflow",
      title: "history overflow edit",
    }),
    history: {
      editCount: 51,
      labels: Array.from(
        { length: 51 },
        (_, index) => `History edit ${index + 1}`,
      ),
      subtitles: Array.from(
        { length: 51 },
        (_, index) => `asset-${index + 1}.mp4`,
      ),
    },
  };

  return {
    assets: {
      deathAsset,
      manualAsset,
      mediaAssets,
      recordingAsset,
    },
    emptyProject,
    extraProjects: [],
    historyOverflowProject,
    mixedLeagueProject,
    now: editorE2ENow,
    primaryProject,
    recordingBookmarkPages: {},
    recordingStatus: {
      activeSessionDirectory: null,
      available: true,
      bufferActive: false,
      encoder: "hardware_h264",
      error: null,
      fps: 60,
      gameRunning: false,
      initialized: true,
      isStartingRecording: false,
      isStoppingRecording: false,
      lastRecordingPath: null,
      outputDirectory: null,
      outputResolution: "native",
      recording: false,
      recordingStartedAt: null,
      runRecordingActive: false,
      runRecordingPath: null,
      runRecordingStartedAt: null,
      runtime: "packaged_obs",
      runtimePath: null,
    },
    savedEditRecords: [
      primaryProject,
      secondaryProject,
      mixedLeagueProject,
      historyOverflowProject,
    ].map(createEditorE2ESavedEditRecord),
    secondaryProject,
    settings: {
      ...createDefaultSettings(),
      activeGame: "poe2",
      activeLeague: "Standard",
      installedGames: ["poe2"],
      poe2SelectedLeague: "Standard",
      setupCompleted: true,
      setupStep: 3,
      setupVersion: 1,
    },
  };
}

function createEditorE2ESavedEditRecord(
  project: EditorProject,
): EditorE2ESavedEditRecord {
  const metadata = createEditorProjectPersistedMetadata(project);

  return {
    item: {
      ...createEditorE2EProjectSummary(project),
      historyEditCount: metadata.historyEditCount,
      sizeBytes: metadata.sourceSizeBytes,
      sourceGame: metadata.sourceGame,
      sourceLeague: metadata.sourceLeague,
    },
    sourceLeagueMemberships: metadata.sourceLeagueMemberships,
  };
}

function createEditorE2EProjectSummary(
  project: EditorProject,
): EditorProjectSummary {
  return {
    clipCount: project.tracks.reduce(
      (clipCount, track) => clipCount + track.clips.length,
      0,
    ),
    createdAt: project.createdAt,
    durationSeconds: project.durationSeconds,
    id: project.id,
    title: project.title,
    updatedAt: project.updatedAt,
  };
}

function createEditorE2EAsset(input: {
  category: EditorMediaAsset["category"];
  createdAt?: string;
  id: string;
  kind: EditorMediaAsset["kind"];
  name: string;
  sourceGame?: EditorMediaAsset["sourceGame"];
  sourceLeague?: string;
  subtitle: string;
}): EditorMediaAsset {
  return {
    assetKey: `${input.kind}:${input.id}`,
    category: input.category,
    createdAt: input.createdAt ?? editorE2ENow,
    durationSeconds: 10,
    exists: true,
    id: input.id,
    kind: input.kind,
    mediaUrl:
      input.kind === "clip"
        ? `hinekora-media://replay-clip/${input.id}`
        : `hinekora-media://run-recording/${input.id}`,
    name: input.name,
    sizeBytes: 1024,
    sourceGame: input.sourceGame ?? "poe2",
    sourceLeague: input.sourceLeague ?? "Standard",
    status: "ready",
    subtitle: input.subtitle,
  };
}

function createEditorE2EClip(
  asset: EditorMediaAsset,
  input: {
    durationSeconds: number;
    id: string;
    startSeconds: number;
  },
): EditorTimelineClip {
  return {
    assetKey: asset.assetKey,
    color: "primary",
    durationSeconds: input.durationSeconds,
    id: input.id,
    inSeconds: 0,
    mediaUrl: asset.mediaUrl,
    name: asset.name,
    outSeconds: input.durationSeconds,
    sourceInSeconds: 0,
    sourceOutSeconds: 10,
    startSeconds: input.startSeconds,
    trackId: "video-track",
  };
}

function createEditorE2EProject(input: {
  asset: EditorMediaAsset;
  assets?: EditorMediaAsset[];
  clips: EditorTimelineClip[];
  id: string;
  title: string;
}): EditorProject {
  const assets = input.assets ?? [input.asset];
  const sourceGame = resolveCommonEditorE2EAssetValue(
    assets.map((asset) => asset.sourceGame),
  );
  const sourceLeague = resolveCommonEditorE2EAssetValue(
    assets.map((asset) => asset.sourceLeague),
  );

  return {
    activeClipId: null,
    assets,
    createdAt: editorE2ENow,
    durationSeconds: input.clips.reduce(
      (duration, clip) =>
        Math.max(duration, clip.startSeconds + clip.durationSeconds),
      0,
    ),
    id: input.id,
    selectedAssetKey: input.asset.assetKey,
    sourceGame,
    sourceLeague,
    title: input.title,
    tracks: [
      {
        clips: input.clips,
        id: "video-track",
        kind: "video",
        label: "Video",
      },
    ],
    updatedAt: editorE2ENow,
  };
}

function resolveCommonEditorE2EAssetValue<TValue extends string>(
  values: TValue[],
): TValue | null {
  const firstValue = values[0];
  if (!firstValue) {
    return null;
  }

  return values.every((value) => value === firstValue) ? firstValue : null;
}

async function setupEditorE2E(page: Page, options: SetupEditorE2EOptions = {}) {
  await page.setViewportSize({ height: 760, width: 1280 });
  const fixture = createEditorE2EFixture();
  fixture.assets.mediaAssets.push(...(options.extraAssets ?? []));
  fixture.extraProjects = options.extraProjects ?? [];
  fixture.recordingBookmarkPages = options.recordingBookmarkPages ?? {};
  fixture.savedEditRecords.push(
    ...fixture.extraProjects.map(createEditorE2ESavedEditRecord),
  );
  await page.exposeFunction(
    "__HINEKORA_E2E_CREATE_SAVED_EDIT_RECORD__",
    (project: EditorProject) => createEditorE2ESavedEditRecord(project),
  );
  await page.addInitScript(
    (input: {
      bridgeFactorySource: string;
      fixture: EditorE2EFixture;
      poeProcessSnapshotFactoryScript: string;
    }) => {
      const { fixture } = input;
      const { deathAsset, manualAsset, mediaAssets, recordingAsset } =
        fixture.assets;
      const {
        emptyProject,
        extraProjects,
        historyOverflowProject,
        mixedLeagueProject,
        now,
        primaryProject,
        recordingBookmarkPages,
        recordingStatus,
      } = fixture;
      const settings = { ...fixture.settings };
      let settingsChangedListener: ((settings: AppSettings) => void) | null =
        null;
      const secondaryProject = fixture.secondaryProject;
      const unsubscribe = () => undefined;
      const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
      const createBridgeDomainFactory = Function(
        `"use strict"; return (${input.bridgeFactorySource});`,
      )() as E2EBridgeDomainFactory;
      const createPoeProcessSnapshotFactory = Function(
        input.poeProcessSnapshotFactoryScript,
      )() as () => E2EPoeProcessSnapshotFactory;
      const poeProcessSnapshotFactory = createPoeProcessSnapshotFactory();
      const createSavedEditRecord = (project: EditorProject) =>
        (
          window as unknown as {
            __HINEKORA_E2E_CREATE_SAVED_EDIT_RECORD__: (
              project: EditorProject,
            ) => Promise<EditorE2ESavedEditRecord>;
          }
        ).__HINEKORA_E2E_CREATE_SAVED_EDIT_RECORD__(clone(project));
      const projectsById = new Map([
        [primaryProject.id, primaryProject],
        [secondaryProject.id, secondaryProject],
        [mixedLeagueProject.id, mixedLeagueProject],
        [historyOverflowProject.id, historyOverflowProject],
        ...extraProjects.map((project) => [project.id, project] as const),
      ]);
      const savedEditRecordsById = new Map(
        fixture.savedEditRecords.map((record) => [record.item.id, record]),
      );
      const createProjectSummary = (
        project: EditorProject,
      ): EditorProjectSummary => ({
        clipCount: project.tracks.reduce(
          (clipCount, track) => clipCount + track.clips.length,
          0,
        ),
        createdAt: project.createdAt,
        durationSeconds: project.durationSeconds,
        id: project.id,
        title: project.title,
        updatedAt: project.updatedAt,
      });
      const compareSavedEditItems = (
        first: SavedEditItem,
        second: SavedEditItem,
        sortBy: SavedEditsLibrarySortKey,
      ) => {
        const firstValue = first[sortBy];
        const secondValue = second[sortBy];
        if (typeof firstValue === "number" && typeof secondValue === "number") {
          return firstValue - secondValue;
        }

        return String(firstValue).localeCompare(String(secondValue));
      };
      const listSavedEdits = (
        query: SavedEditsLibraryQuery = {},
      ): SavedEditsLibraryPage => {
        const pageIndex = query.pageIndex ?? 0;
        const pageSize = query.pageSize ?? 20;
        const sortBy = query.sortBy ?? "updatedAt";
        const sortDirection = query.sortDirection ?? "desc";
        const records = Array.from(savedEditRecordsById.values())
          .filter((record) =>
            record.sourceLeagueMemberships.some(
              (membership) =>
                (!query.game || membership.sourceGame === query.game) &&
                (!query.league || membership.sourceLeague === query.league),
            ),
          )
          .sort((first, second) => {
            const multiplier = sortDirection === "asc" ? 1 : -1;

            return (
              compareSavedEditItems(first.item, second.item, sortBy) *
                multiplier || first.item.id.localeCompare(second.item.id)
            );
          });
        const items = records.map((record) => record.item);
        const availableLeagues = Array.from(
          new Set(
            Array.from(savedEditRecordsById.values())
              .flatMap((record) => record.sourceLeagueMemberships)
              .filter(
                (membership) =>
                  !query.game || membership.sourceGame === query.game,
              )
              .map((membership) => membership.sourceLeague),
          ),
        ).sort((first, second) => first.localeCompare(second));

        return {
          availableLeagues,
          globalTotalCount: savedEditRecordsById.size,
          items: clone(
            items.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
          ),
          pageCount: Math.max(1, Math.ceil(items.length / pageSize)),
          pageIndex,
          pageSize,
          sortBy,
          sortDirection,
          totalCount: items.length,
        };
      };
      const listEditorMediaAssets = (query: EditorMediaAssetPageQuery) => {
        const pageIndex = query.pageIndex ?? 0;
        const pageSize = query.pageSize ?? 5;
        const items = mediaAssets.filter((asset) => {
          if (asset.category !== query.category) {
            return false;
          }
          if (query.includeAssetKeys) {
            return query.includeAssetKeys.includes(asset.assetKey);
          }
          if (asset.sourceGame !== query.game) {
            return false;
          }
          if (query.league && asset.sourceLeague !== query.league) {
            return false;
          }
          if (query.excludeAssetKeys?.includes(asset.assetKey)) {
            return false;
          }
          if (
            query.createdAfter &&
            Date.parse(asset.createdAt) < Date.parse(query.createdAfter)
          ) {
            return false;
          }

          return true;
        });

        return {
          items: clone(
            items.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
          ),
          pageCount: Math.max(1, Math.ceil(items.length / pageSize)),
          pageIndex,
          pageSize,
          totalCount: items.length,
        };
      };
      const state = {
        copiedExportIds: [] as string[],
        copyRequests: [] as unknown[],
        createProjectInputs: [] as unknown[],
        debugClipboardWrites: [] as string[],
        currentProjectId: primaryProject.id,
        deleteAllCount: 0,
        deletedProjectIds: [] as string[],
        deletedSavedEditIds: [] as string[],
        exportRequests: [] as unknown[],
        mediaAssetQueries: [] as unknown[],
        revealedClipIds: [] as string[],
        revealedExportIds: [] as string[],
        revealedSavedEditIds: [] as string[],
        recordingBookmarkQueries: [] as Array<{
          query: unknown;
          recordingId: string;
        }>,
        savedEditDeleteAllCount: 0,
        savedProjects: [] as EditorProject[],
        settingsUpdates: [] as Record<string, unknown>[],
        unexpectedBridgeCalls: [] as string[],
        workspaceQueries: [] as unknown[],
      };
      const createWorkspace = (
        project = projectsById.get(state.currentProjectId),
      ): EditorWorkspace => ({
        assets: [deathAsset, manualAsset, recordingAsset],
        hasMoreProjects: false,
        project: project ?? emptyProject,
        projects: Array.from(projectsById.values()).map(createProjectSummary),
      });
      const createBridgeDomain = <TBridge extends object>(
        domain: string,
        methods: E2EBridgeDomainMethods<TBridge>,
      ): TBridge =>
        createBridgeDomainFactory(
          domain,
          methods,
          state.unexpectedBridgeCalls,
          "editor",
        );

      const playbackFrames = new WeakMap<
        HTMLMediaElement,
        { frameId: number | null; lastMs: number }
      >();
      const stopPlaybackClock = (media: HTMLMediaElement) => {
        const playback = playbackFrames.get(media);
        if (playback?.frameId !== null && playback?.frameId !== undefined) {
          window.cancelAnimationFrame(playback.frameId);
        }
        playbackFrames.delete(media);
      };
      HTMLMediaElement.prototype.play = async function play() {
        if (playbackFrames.has(this)) {
          return;
        }

        const playback: { frameId: number | null; lastMs: number } = {
          frameId: null,
          lastMs: performance.now(),
        };
        playbackFrames.set(this, playback);

        const advancePlayback = (nowMs: number) => {
          const currentPlayback = playbackFrames.get(this);
          if (!currentPlayback) {
            return;
          }

          const elapsedSeconds =
            Math.max(0, nowMs - currentPlayback.lastMs) / 1_000;
          currentPlayback.lastMs = nowMs;
          this.currentTime += elapsedSeconds;
          this.dispatchEvent(new Event("timeupdate"));
          currentPlayback.frameId =
            window.requestAnimationFrame(advancePlayback);
        };

        playback.frameId = window.requestAnimationFrame(advancePlayback);
      };
      HTMLMediaElement.prototype.pause = function pause() {
        stopPlaybackClock(this);
      };
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            state.debugClipboardWrites.push(text);
          },
        },
      });
      (
        window as unknown as {
          __HINEKORA_E2E__: typeof state;
          electron: unknown;
        }
      ).__HINEKORA_E2E__ = state;
      const electron: EditorE2EElectron = {
        app: createBridgeDomain<EditorE2EElectron["app"]>("app", {
          getVersion: async () => "0.1.1",
        }),
        appSetup: createBridgeDomain<EditorE2EElectron["appSetup"]>(
          "appSetup",
          {
            isSetupComplete: async () => true,
            getSetupState: async () => ({
              currentStep: 3,
              isComplete: true,
              poe1ClientPath: null,
              poe2ClientPath: null,
              selectedGames: ["poe2"],
              telemetryCrashReporting: false,
              telemetryUsageAnalytics: false,
            }),
          },
        ),
        bookmarks: createBridgeDomain<EditorE2EElectron["bookmarks"]>(
          "bookmarks",
          {
            createManual: async () => ({
              bookmark: null,
              error: null,
              ok: true,
            }),
            deleteManual: async () => undefined,
            listLibrary: async () => ({
              availableCategories: [],
              availableLeagues: [],
              items: [],
              pageCount: 1,
              pageIndex: 0,
              pageSize: 20,
              sortBy: "occurredAt",
              sortDirection: "desc",
              totalCount: 0,
            }),
            listRecording: async (
              recordingId: string,
              query: RecordingBookmarksQuery = {},
            ) => {
              state.recordingBookmarkQueries.push({
                query: clone(query),
                recordingId,
              });
              const page = recordingBookmarkPages[recordingId];
              if (page) {
                return clone(page);
              }

              return {
                availableCategories: [],
                items: [],
                pageCount: 1,
                pageIndex: query.pageIndex ?? 0,
                pageSize: query.pageSize ?? 10,
                timelineItems: [],
                timelineItemsTruncated: false,
                totalCount: 0,
              };
            },
            updateManual: async () => undefined,
          },
        ),
        capturePreview: createBridgeDomain<EditorE2EElectron["capturePreview"]>(
          "capturePreview",
          {
            onRefreshRequested: () => unsubscribe,
          },
        ),
        captureProfiles: createBridgeDomain<
          EditorE2EElectron["captureProfiles"]
        >("captureProfiles", {
          list: async () => [],
          onChanged: () => unsubscribe,
        }),
        clientLog: createBridgeDomain<EditorE2EElectron["clientLog"]>(
          "clientLog",
          {
            getStatus: async () => ({
              activeGame: "poe2",
              activeGameFocused: null,
              lastError: null,
              path: null,
              watching: false,
            }),
            onStatusChanged: () => unsubscribe,
          },
        ),
        diagLog: createBridgeDomain<EditorE2EElectron["diagLog"]>(
          "diagLog",
          {},
        ),
        editor: createBridgeDomain<EditorE2EElectron["editor"]>("editor", {
          copyExport: async (exportId: string) => {
            state.copiedExportIds.push(exportId);

            return { error: null, ok: true };
          },
          copyProjectToClipboard: async (input: unknown) => {
            state.copyRequests.push(clone(input));

            return { error: null, ok: true };
          },
          createProject: async (input: EditorCreateProjectInput = {}) => {
            state.createProjectInputs.push(clone(input));
            const project = {
              ...emptyProject,
              id: `project-new-${state.createProjectInputs.length}`,
            };
            state.currentProjectId = project.id;
            projectsById.set(project.id, project);
            savedEditRecordsById.set(
              project.id,
              await createSavedEditRecord(project),
            );

            return clone(project);
          },
          deleteAllProjects: async () => {
            state.deleteAllCount += 1;
            projectsById.clear();
            savedEditRecordsById.clear();
            state.currentProjectId = emptyProject.id;

            return clone(createWorkspace(emptyProject));
          },
          deleteProject: async (projectId: string) => {
            state.deletedProjectIds.push(projectId);
            projectsById.delete(projectId);
            savedEditRecordsById.delete(projectId);
            state.currentProjectId =
              Array.from(projectsById.values())[0]?.id ?? emptyProject.id;

            return clone(
              createWorkspace(
                projectsById.get(state.currentProjectId) ?? emptyProject,
              ),
            );
          },
          exportProject: async (input: EditorExportInput) => {
            state.exportRequests.push(clone(input));

            return {
              createdAt: now,
              durationSeconds: 5,
              exportId: "export-1",
              fileName: "export.mp4",
              mediaUrl: null,
              mode: "new-file",
              resolution: "1080p",
              sizeBytes: 1024,
            };
          },
          getWorkspace: async (query: EditorWorkspaceQuery = {}) => {
            state.workspaceQueries.push(clone(query));
            const project = query.projectId
              ? projectsById.get(query.projectId)
              : projectsById.get(state.currentProjectId);
            if (project) {
              state.currentProjectId = project.id;
            }

            return clone(createWorkspace(project));
          },
          listMediaAssets: async (query: EditorMediaAssetPageQuery) => {
            state.mediaAssetQueries.push(clone(query));

            return listEditorMediaAssets(query);
          },
          onExportProgress: () => unsubscribe,
          revealExport: async (exportId: string) => {
            state.revealedExportIds.push(exportId);

            return { error: null, ok: true };
          },
          saveProject: async ({
            project,
          }: {
            project: typeof primaryProject;
          }) => {
            const nextProject = clone(project);
            state.savedProjects.push(nextProject);
            state.currentProjectId = nextProject.id;
            projectsById.set(nextProject.id, nextProject);
            savedEditRecordsById.set(
              nextProject.id,
              await createSavedEditRecord(nextProject),
            );

            return clone(nextProject);
          },
        }),
        mainWindow: createBridgeDomain<EditorE2EElectron["mainWindow"]>(
          "mainWindow",
          {
            isMaximized: async () => false,
          },
        ),
        managedRecorder: createBridgeDomain<
          EditorE2EElectron["managedRecorder"]
        >("managedRecorder", {
          getCaptureMode: async () => "rewind",
          getStatus: async () => recordingStatus,
          onCaptureModeChanged: () => unsubscribe,
          onStatusChanged: () => unsubscribe,
        }),
        overlayWindows: createBridgeDomain<EditorE2EElectron["overlayWindows"]>(
          "overlayWindows",
          {
            isAuraLocked: async () => false,
            isRecorderRequested: async () => false,
            isRecorderVisible: async () => false,
            onAuraLockChanged: () => unsubscribe,
            onRecorderVisibilityChanged: () => unsubscribe,
          },
        ),
        poeProcess: createBridgeDomain<EditorE2EElectron["poeProcess"]>(
          "poeProcess",
          {
            getSnapshot: async () =>
              poeProcessSnapshotFactory.createPoeProcessSnapshot(
                poeProcessSnapshotFactory.createStoppedPoeProcessStates(),
              ),
            onError: () => unsubscribe,
            onStart: () => unsubscribe,
            onSnapshot: () => unsubscribe,
            onStop: () => unsubscribe,
          },
        ),
        profiles: createBridgeDomain<EditorE2EElectron["profiles"]>(
          "profiles",
          {
            list: async () => [],
            onChanged: () => unsubscribe,
          },
        ),
        recordingStorage: createBridgeDomain<
          EditorE2EElectron["recordingStorage"]
        >("recordingStorage", {}),
        replayClips: createBridgeDomain<EditorE2EElectron["replayClips"]>(
          "replayClips",
          {
            reveal: async (id: string) => {
              state.revealedClipIds.push(id);

              return { error: null, ok: true };
            },
            onStatusChanged: () => unsubscribe,
          },
        ),
        savedEdits: createBridgeDomain<EditorE2EElectron["savedEdits"]>(
          "savedEdits",
          {
            delete: async (projectId: string) => {
              state.deletedSavedEditIds.push(projectId);
              projectsById.delete(projectId);
              savedEditRecordsById.delete(projectId);
            },
            deleteAll: async () => {
              state.savedEditDeleteAllCount += 1;
              projectsById.clear();
              savedEditRecordsById.clear();
            },
            listLibrary: async (query?: SavedEditsLibraryQuery) =>
              listSavedEdits(query),
            revealInExplorer: async (projectId: string) => {
              state.revealedSavedEditIds.push(projectId);

              return { error: null, status: "success" };
            },
          },
        ),
        settings: createBridgeDomain<EditorE2EElectron["settings"]>(
          "settings",
          {
            get: async () => clone(settings),
            onChanged: (callback) => {
              settingsChangedListener = callback;

              return unsubscribe;
            },
            update: async (input: Partial<typeof settings>) => {
              state.settingsUpdates.push(clone(input));
              Object.assign(settings, input);
              settingsChangedListener?.(clone(settings));

              return clone(settings);
            },
          },
        ),
        storage: createBridgeDomain<EditorE2EElectron["storage"]>("storage", {
          checkDiskSpace: async () => ({
            diskFreeBytes: 1_000_000_000,
            isLow: false,
          }),
        }),
        stateTransfer: createBridgeDomain<EditorE2EElectron["stateTransfer"]>(
          "stateTransfer",
          {},
        ),
        updater: createBridgeDomain<EditorE2EElectron["updater"]>("updater", {
          getRecentReleases: async () => [],
          onDownloadProgress: () => unsubscribe,
          onUpdateAvailable: () => unsubscribe,
        }),
      };
      (
        window as unknown as {
          electron: EditorE2EElectron;
        }
      ).electron = electron;
    },
    {
      bridgeFactorySource: e2eBridgeDomainFactorySource,
      fixture,
      poeProcessSnapshotFactoryScript: e2ePoeProcessSnapshotFactoryScript,
    },
  );

  await page.goto(options.initialRoute ?? "/#/editor?kind=clip&id=asset-1");
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
  await expect(page.locator("[data-timeline-grid='true']")).toBeVisible();
}

async function getEditorE2ECalls(page: Page): Promise<EditorE2ECalls> {
  return page.evaluate(() => {
    const e2eWindow = window as unknown as {
      __HINEKORA_E2E__: EditorE2ECalls;
    };

    return e2eWindow.__HINEKORA_E2E__;
  });
}

async function expectNoUnexpectedEditorBridgeCalls(page: Page) {
  const unexpectedBridgeCalls = await page.evaluate(() => {
    const e2eWindow = window as unknown as {
      __HINEKORA_E2E__?: EditorE2ECalls;
    };

    return e2eWindow.__HINEKORA_E2E__?.unexpectedBridgeCalls ?? [];
  });

  expect(unexpectedBridgeCalls).toEqual([]);
}

async function waitForSavedProjectCount(page: Page, count: number) {
  await page.waitForFunction((expectedCount) => {
    const e2eWindow = window as unknown as {
      __HINEKORA_E2E__?: EditorE2ECalls;
    };

    return (
      (e2eWindow.__HINEKORA_E2E__?.savedProjects.length ?? 0) >= expectedCount
    );
  }, count);
}

async function readRenderedTimelineClips(
  page: Page,
): Promise<TimelineClipSnapshot[]> {
  return page.locator("[data-clip-body='true']").evaluateAll((nodes) =>
    nodes.map((node) => {
      const element = node as HTMLElement;

      return {
        durationSeconds: Number(element.dataset.clipDurationSeconds),
        id: element.dataset.clipId ?? "",
        startSeconds: Number(element.dataset.clipStartSeconds),
      };
    }),
  );
}

async function expectNoTimelineOverlap(page: Page) {
  const clips = await readRenderedTimelineClips(page);
  let cursorSeconds = 0;

  for (const clip of clips) {
    expect(clip.startSeconds).toBeGreaterThanOrEqual(cursorSeconds);
    cursorSeconds = clip.startSeconds + clip.durationSeconds;
  }
}

function expectTimelineOrder(clips: TimelineClipSnapshot[]) {
  expect(
    clips.map((clip) => ({
      id: clip.id,
      startSeconds: clip.startSeconds,
    })),
  ).toEqual([
    { id: "timeline-a", startSeconds: 0 },
    { id: "timeline-b", startSeconds: 2 },
    { id: "timeline-c", startSeconds: 4 },
  ]);
}

async function openEditorActionsMenu(page: Page) {
  const trigger = page.getByLabel("More editor actions");
  const isOpen = await trigger.evaluate((element) => {
    const details = element.closest("details");

    return details instanceof HTMLDetailsElement && details.open;
  });

  if (!isOpen) {
    await trigger.click();
  }
}

async function clickTimelineMarkerAtClipOffset(input: {
  clipId: string;
  offsetSeconds: number;
  page: Page;
}) {
  const point = await input.page.evaluate(
    ({ clipId, offsetSeconds }) => {
      const clip = document.querySelector<HTMLElement>(
        `[data-clip-body='true'][data-clip-id='${clipId}']`,
      );
      const markerZone = document.querySelector<HTMLElement>(
        "[data-timeline-marker-zone='true']",
      );
      if (!clip || !markerZone) {
        throw new Error("Timeline clip or marker zone was not found");
      }

      const clipBounds = clip.getBoundingClientRect();
      const markerBounds = markerZone.getBoundingClientRect();
      const durationSeconds = Number(clip.dataset.clipDurationSeconds);

      return {
        x:
          clipBounds.left +
          clipBounds.width * (offsetSeconds / durationSeconds),
        y: markerBounds.top + markerBounds.height / 2,
      };
    },
    { clipId: input.clipId, offsetSeconds: input.offsetSeconds },
  );

  await input.page.mouse.click(point.x, point.y);
}

async function dragLocatorBy(
  locator: Locator,
  input: { x: number; y: number },
) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Cannot drag an element without a bounding box");
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await locator.page().mouse.move(startX, startY);
  await locator.page().mouse.down();
  await locator.page().mouse.move(startX + input.x, startY + input.y, {
    steps: 8,
  });
  await locator.page().mouse.up();
}

export {
  clickTimelineMarkerAtClipOffset,
  createEditorE2EAsset,
  createEditorE2EClip,
  createEditorE2EProject,
  dragLocatorBy,
  expectNoTimelineOverlap,
  expectNoUnexpectedEditorBridgeCalls,
  expectTimelineOrder,
  getEditorE2ECalls,
  openEditorActionsMenu,
  readRenderedTimelineClips,
  setupEditorE2E,
  type TimelineClipSnapshot,
  waitForSavedProjectCount,
};
