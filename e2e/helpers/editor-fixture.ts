import { expect, type Locator, type Page } from "@playwright/test";

import type {
  EditorCreateProjectInput,
  EditorExportInput,
  EditorMediaAsset,
  EditorProject,
  EditorProjectSummary,
  EditorTimelineClip,
  EditorWorkspace,
  EditorWorkspaceQuery,
} from "../../main/modules/editor";
import {
  type AppSettings,
  createDefaultSettings,
  type ManagedRecorderStatus,
} from "../../types";

interface TimelineClipSnapshot {
  durationSeconds: number;
  id: string;
  startSeconds: number;
}

interface EditorE2ECalls {
  copyRequests: unknown[];
  createProjectInputs: unknown[];
  deleteAllCount: number;
  deletedProjectIds: string[];
  exportRequests: unknown[];
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
    recordingAsset: EditorMediaAsset;
  };
  emptyProject: EditorProject;
  now: string;
  primaryProject: EditorProject;
  recordingStatus: ManagedRecorderStatus;
  secondaryProject: EditorProject;
  settings: AppSettings;
}

type EditorE2EElectron = Window["electron"];

const editorE2ENow = "2026-06-25T00:00:00.000Z";

function createEditorE2EFixture(): EditorE2EFixture {
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
  const emptyProject = createEditorE2EProject({
    asset: deathAsset,
    clips: [],
    id: "project-empty",
    title: "Untitled edit",
  });

  return {
    assets: {
      deathAsset,
      manualAsset,
      recordingAsset,
    },
    emptyProject,
    now: editorE2ENow,
    primaryProject,
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
    secondaryProject,
    settings: {
      ...createDefaultSettings(),
      activeGame: "poe2",
      activeLeague: "Runes of Aldur",
      installedGames: ["poe2"],
      poe2SelectedLeague: "Runes of Aldur",
      setupCompleted: true,
      setupStep: 3,
      setupVersion: 1,
    },
  };
}

function createEditorE2EAsset(input: {
  category: EditorMediaAsset["category"];
  id: string;
  kind: EditorMediaAsset["kind"];
  name: string;
  subtitle: string;
}): EditorMediaAsset {
  return {
    assetKey: `${input.kind}:${input.id}`,
    category: input.category,
    createdAt: editorE2ENow,
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
    sourceGame: "poe2",
    sourceLeague: "Standard",
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
  clips: EditorTimelineClip[];
  id: string;
  title: string;
}): EditorProject {
  return {
    activeClipId: null,
    assets: [input.asset],
    createdAt: editorE2ENow,
    durationSeconds: input.clips.reduce(
      (duration, clip) =>
        Math.max(duration, clip.startSeconds + clip.durationSeconds),
      0,
    ),
    id: input.id,
    selectedAssetKey: input.asset.assetKey,
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

async function setupEditorE2E(page: Page) {
  await page.setViewportSize({ height: 760, width: 1280 });
  await page.addInitScript((fixture: EditorE2EFixture) => {
    const { deathAsset, manualAsset, recordingAsset } = fixture.assets;
    const { emptyProject, now, primaryProject, recordingStatus } = fixture;
    const settings = { ...fixture.settings };
    const secondaryProject = fixture.secondaryProject;
    const unsubscribe = () => undefined;
    const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
    const projectsById = new Map([
      [primaryProject.id, primaryProject],
      [secondaryProject.id, secondaryProject],
    ]);
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
    const state = {
      copyRequests: [] as unknown[],
      createProjectInputs: [] as unknown[],
      currentProjectId: primaryProject.id,
      deleteAllCount: 0,
      deletedProjectIds: [] as string[],
      exportRequests: [] as unknown[],
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
      methods: Partial<TBridge>,
    ): TBridge =>
      new Proxy(methods as Record<PropertyKey, unknown>, {
        get(target, property, receiver) {
          if (typeof property === "symbol") {
            return Reflect.get(target, property, receiver);
          }

          const callName = `${domain}.${property}`;
          const value = Reflect.get(target, property, receiver);

          if (typeof value === "function") {
            return (...args: unknown[]) => {
              return (value as (...args: unknown[]) => unknown)(...args);
            };
          }

          if (value !== undefined) {
            return value;
          }

          return () => {
            state.unexpectedBridgeCalls.push(callName);
            throw new Error(`Unexpected editor e2e bridge call: ${callName}`);
          };
        },
      }) as TBridge;

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
        currentPlayback.frameId = window.requestAnimationFrame(advancePlayback);
      };

      playback.frameId = window.requestAnimationFrame(advancePlayback);
    };
    HTMLMediaElement.prototype.pause = function pause() {
      stopPlaybackClock(this);
    };
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
      appSetup: createBridgeDomain<EditorE2EElectron["appSetup"]>("appSetup", {
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
      }),
      capturePreview: createBridgeDomain<EditorE2EElectron["capturePreview"]>(
        "capturePreview",
        {},
      ),
      clientLog: createBridgeDomain<EditorE2EElectron["clientLog"]>(
        "clientLog",
        {
          getStatus: async () => ({
            activeGame: "poe2",
            lastError: null,
            path: null,
            watching: false,
          }),
          onStatusChanged: () => unsubscribe,
        },
      ),
      diagLog: createBridgeDomain<EditorE2EElectron["diagLog"]>("diagLog", {}),
      editor: createBridgeDomain<EditorE2EElectron["editor"]>("editor", {
        copyExport: async () => ({ error: null, ok: true }),
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

          return clone(project);
        },
        deleteAllProjects: async () => {
          state.deleteAllCount += 1;
          projectsById.clear();
          state.currentProjectId = emptyProject.id;

          return clone(createWorkspace(emptyProject));
        },
        deleteProject: async (projectId: string) => {
          state.deletedProjectIds.push(projectId);
          projectsById.delete(projectId);
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
        onExportProgress: () => unsubscribe,
        revealExport: async () => ({ error: null, ok: true }),
        saveProject: async ({
          project,
        }: {
          project: typeof primaryProject;
        }) => {
          const nextProject = clone(project);
          state.savedProjects.push(nextProject);
          state.currentProjectId = nextProject.id;
          projectsById.set(nextProject.id, nextProject);

          return clone(nextProject);
        },
      }),
      mainWindow: createBridgeDomain<EditorE2EElectron["mainWindow"]>(
        "mainWindow",
        {
          isMaximized: async () => false,
        },
      ),
      managedRecorder: createBridgeDomain<EditorE2EElectron["managedRecorder"]>(
        "managedRecorder",
        {
          getCaptureMode: async () => "rewind",
          getStatus: async () => recordingStatus,
          onCaptureModeChanged: () => unsubscribe,
          onStatusChanged: () => unsubscribe,
        },
      ),
      overlayWindows: createBridgeDomain<EditorE2EElectron["overlayWindows"]>(
        "overlayWindows",
        {
          isAuraLocked: async () => false,
          isRecorderVisible: async () => false,
          onAuraLockChanged: () => unsubscribe,
          onRecorderVisibilityChanged: () => unsubscribe,
        },
      ),
      poeProcess: createBridgeDomain<EditorE2EElectron["poeProcess"]>(
        "poeProcess",
        {
          getState: async () => ({ isRunning: false, processName: "" }),
          onError: () => unsubscribe,
          onStart: () => unsubscribe,
          onState: () => unsubscribe,
          onStop: () => unsubscribe,
        },
      ),
      profiles: createBridgeDomain<EditorE2EElectron["profiles"]>("profiles", {
        list: async () => [],
        onChanged: () => unsubscribe,
      }),
      recordingStorage: createBridgeDomain<
        EditorE2EElectron["recordingStorage"]
      >("recordingStorage", {}),
      replayClips: createBridgeDomain<EditorE2EElectron["replayClips"]>(
        "replayClips",
        {
          onStatusChanged: () => unsubscribe,
        },
      ),
      settings: createBridgeDomain<EditorE2EElectron["settings"]>("settings", {
        get: async () => clone(settings),
        update: async (input: Partial<typeof settings>) => {
          state.settingsUpdates.push(clone(input));
          Object.assign(settings, input);

          return clone(settings);
        },
      }),
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
  }, createEditorE2EFixture());

  await page.goto("/#/editor?kind=clip&id=asset-1");
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
