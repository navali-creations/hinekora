import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { app } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import { ReplayClipCreationService } from "~/main/modules/replay-clips/ReplayClips.creation";
import { ReplayStatusOverlayService } from "~/main/modules/replay-status-overlay";
import { SettingsStoreService } from "~/main/modules/settings-store";

import {
  createDefaultSettings,
  type ManagedRecorderStatus,
  type ReplayClip,
} from "~/types";

interface NativeReplayStatusE2EState {
  clipStatus: ReplayClip["status"] | null;
  finalStatus: "failed" | "saved" | null;
  manualReplayShowPreview: boolean;
  previewRequested: boolean;
  statusRequested: boolean;
}

const replayDirectory = mkdtempSync(
  join(tmpdir(), "hinekora-replay-status-e2e-"),
);
const replayPath = join(replayDirectory, "manual-replay.mp4");
const state: NativeReplayStatusE2EState = {
  clipStatus: null,
  finalStatus: null,
  manualReplayShowPreview: false,
  previewRequested: false,
  statusRequested: false,
};

Object.assign(globalThis, { __HINEKORA_REPLAY_STATUS_E2E__: state });

let replayStatusOverlay: ReplayStatusOverlayService | null = null;

async function runReplayStatusLifecycle(): Promise<void> {
  writeFileSync(replayPath, "native replay status e2e", "utf8");

  const coordinator = new GameOverlayCoordinator();
  coordinator.setGameRunningActive(true);
  coordinator.setPoeFocusActive(true);
  replayStatusOverlay = new ReplayStatusOverlayService(
    coordinator,
    () => ({ height: 1, width: 1, x: 0, y: 0 }),
    () => true,
  );

  const settings = {
    ...createDefaultSettings(),
    activeGame: "poe1" as const,
    activeLeague: "Standard",
    manualReplaySeconds: 5,
    manualReplayShowPreview: false,
    recordingStoragePath: replayDirectory,
  };
  state.manualReplayShowPreview = settings.manualReplayShowPreview;

  const recorderStatus: ManagedRecorderStatus = {
    activeSessionDirectory: null,
    available: true,
    bufferActive: true,
    encoder: "hardware_h264",
    error: null,
    fps: 60,
    gameRunning: true,
    initialized: true,
    isStartingRecording: false,
    isStoppingRecording: false,
    lastRecordingPath: null,
    outputDirectory: replayDirectory,
    outputResolution: "native",
    recording: true,
    recordingStartedAt: null,
    runRecordingActive: false,
    runRecordingSession: null,
    runtime: "packaged_obs",
    runtimePath: null,
  };

  Object.defineProperty(SettingsStoreService, "getInstance", {
    configurable: true,
    value: () => ({ get: () => settings }) as SettingsStoreService,
  });
  Object.defineProperty(ManagedRecorderService, "getInstance", {
    configurable: true,
    value: () =>
      ({
        getStatus: () => recorderStatus,
        saveReplay: async () => ({ error: null, ok: true, path: replayPath }),
      }) as unknown as ManagedRecorderService,
  });
  Object.defineProperty(BookmarksService, "getInstance", {
    configurable: true,
    value: () =>
      ({
        rememberReplayClipSession: () => undefined,
      }) as unknown as BookmarksService,
  });
  Object.defineProperty(OverlayWindowsService, "getInstance", {
    configurable: true,
    value: () =>
      ({
        finishReplayStatusOverlay: (
          clipId: string,
          finalStatus: "failed" | "saved",
        ) => {
          state.finalStatus = finalStatus;
          replayStatusOverlay?.finish(clipId, finalStatus);
        },
        showClipPreviewOverlay: async () => {
          state.previewRequested = true;
        },
        showReplayStatusOverlay: async (clipId: string) => {
          state.statusRequested = true;
          await replayStatusOverlay?.showProcessing(clipId);
        },
      }) as unknown as OverlayWindowsService,
  });

  const creationService = new ReplayClipCreationService({
    persistAndPublish: () => undefined,
    preparePreview: async () => undefined,
    readDuration: () => 1,
    repository: { getByTriggerLineHash: () => null },
    resolveStoredPath: (path) => (path === replayPath ? path : null),
    runClipOperation: (_clipId, operation) => operation(),
    updateClip: (clip, update) => ({
      ...clip,
      ...update,
      updatedAt: new Date().toISOString(),
    }),
  });
  const clip = await creationService.execute({
    detectedAt: new Date().toISOString(),
    game: "poe1",
    kind: "manual",
    line: "native replay status e2e",
    lineHash: `native-replay-${Date.now()}`,
  });
  state.clipStatus = clip?.status ?? null;
}

app.whenReady().then(runReplayStatusLifecycle);

app.on("will-quit", () => {
  replayStatusOverlay?.destroy();
  replayStatusOverlay = null;
  rmSync(replayDirectory, { force: true, recursive: true });
});

app.on("window-all-closed", () => {
  app.quit();
});
