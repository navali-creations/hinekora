import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { app, BrowserWindow } from "electron";

import { BookmarksService } from "~/main/modules/bookmarks";
import { DeathClipsOverlayService } from "~/main/modules/death-clips-overlay";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { ManagedRecorderService } from "~/main/modules/managed-recorder";
import { OverlayWindowsService } from "~/main/modules/overlay-windows";
import { GameOverlayCoordinator } from "~/main/modules/overlay-windows/GameOverlayCoordinator";
import { ReplayClipsChannel } from "~/main/modules/replay-clips/ReplayClips.channels";
import { ReplayClipCreationService } from "~/main/modules/replay-clips/ReplayClips.creation";
import type {
  ReplayClipDetail,
  ReplayClipPreviewProgress,
} from "~/main/modules/replay-clips/ReplayClips.dto";
import {
  type ReplayStatusOverlayActiveStatus,
  type ReplayStatusOverlayFinalStatus,
  ReplayStatusOverlayService,
} from "~/main/modules/replay-status-overlay";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { SettingsStoreChannel } from "~/main/modules/settings-store/SettingsStore.channels";
import { createSettingsStoreClipPreviewOverlaySnapshot } from "~/main/modules/settings-store/SettingsStore.dto";
import {
  getIpcWindowRole,
  registerGuardedIpcHandler,
} from "~/main/utils/ipc-window-roles";

import {
  createDefaultSettings,
  type ManagedRecorderStatus,
  type ReplayClip,
} from "~/types";
import type {
  NativeReplayStatusE2EHarness,
  NativeReplayStatusE2EState,
} from "./native-replay-status.types";

let releaseSave!: (result: ReplayStatusOverlayFinalStatus) => void;
const saveGate = new Promise<ReplayStatusOverlayFinalStatus>((resolve) => {
  releaseSave = resolve;
});
let releaseProcessing!: () => void;
const processingGate = new Promise<void>((resolve) => {
  releaseProcessing = resolve;
});

const replayDirectory = mkdtempSync(
  join(tmpdir(), "hinekora-replay-status-e2e-"),
);
const replayPath = join(replayDirectory, "manual-replay.mp4");
const state: NativeReplayStatusE2EState = {
  clipStatus: null,
  finalStatus: null,
  manualReplayShowPreview: false,
  previewRequested: false,
  previewAttempts: 0,
  previewFailures: 0,
  processingStarted: false,
  statusRequested: false,
};

const harness: NativeReplayStatusE2EHarness = {
  getState: () => ({ ...state }),
  releaseSave,
  releaseProcessing,
  requestPreview: () => {
    if (currentClip) {
      creationService?.showClipPreviewOverlay(currentClip);
    }
  },
  setCaptureProtection: (enabled) => {
    captureProtectionEnabled = enabled;
    deathClipsOverlay?.setContentProtectionEnabled(enabled);
  },
};
Object.assign(globalThis, { __HINEKORA_REPLAY_STATUS_E2E__: harness });

let replayStatusOverlay: ReplayStatusOverlayService | null = null;
let deathClipsOverlay: DeathClipsOverlayService | null = null;
let creationService: ReplayClipCreationService | null = null;
let currentClip: ReplayClip | null = null;
let captureProtectionEnabled = false;
let failFirstProtection =
  process.env.HINEKORA_E2E_FAIL_FIRST_PROTECTION === "1";

app.on("browser-window-created", (_event, window) => {
  if (!failFirstProtection) {
    return;
  }
  const setContentProtection = window.setContentProtection.bind(window);
  window.setContentProtection = (enabled) => {
    if (enabled && failFirstProtection) {
      failFirstProtection = false;
      throw new Error("Simulated capture protection failure");
    }
    setContentProtection(enabled);
  };
});

function getClipDetail(): ReplayClipDetail | null {
  if (!currentClip) {
    return null;
  }
  const { originalObsPath, processedClipPath, ...clip } = currentClip;
  const hasMediaFile = Boolean(originalObsPath || processedClipPath);
  return {
    clip: {
      ...clip,
      hasMediaFile,
      fileName: hasMediaFile ? "replay.mp4" : null,
    },
    durationSeconds: clip.durationSeconds,
    mediaUrl: null,
  };
}

function publishToPreview(
  channel:
    | ReplayClipsChannel.StatusChanged
    | ReplayClipsChannel.PreviewProgress,
  payload: ReplayClipDetail["clip"] | ReplayClipPreviewProgress,
): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (
      getIpcWindowRole({ sender: window.webContents }) ===
      WindowName.ClipPreviewOverlay
    ) {
      window.webContents.send(channel, payload);
    }
  }
}

async function runReplayStatusLifecycle(): Promise<void> {
  writeFileSync(replayPath, "native replay status e2e", "utf8");

  const coordinator = new GameOverlayCoordinator();
  coordinator.setGameRunningActive(true);
  coordinator.setPoeFocusActive(true);
  const deathPreview = process.env.HINEKORA_E2E_REPLAY_KIND === "death";
  replayStatusOverlay = new ReplayStatusOverlayService(
    coordinator,
    () => ({ height: 1, width: 1, x: 0, y: 0 }),
    () => false,
  );
  if (deathPreview) {
    deathClipsOverlay = new DeathClipsOverlayService(
      coordinator,
      () => ({ height: 1, width: 1, x: 0, y: 0 }),
      () => captureProtectionEnabled,
    );
  }

  const settings = {
    ...createDefaultSettings(),
    activeGame: "poe1" as const,
    activeLeague: "Standard",
    manualReplaySeconds: 5,
    manualReplayShowPreview: false,
    recordingStoragePath: replayDirectory,
  };
  state.manualReplayShowPreview = settings.manualReplayShowPreview;
  registerGuardedIpcHandler(
    ReplayClipsChannel.Get,
    [WindowName.ClipPreviewOverlay],
    (_event, id: unknown) => (id === currentClip?.id ? getClipDetail() : null),
  );
  registerGuardedIpcHandler(
    SettingsStoreChannel.GetClipPreviewOverlaySnapshot,
    [WindowName.ClipPreviewOverlay],
    () => createSettingsStoreClipPreviewOverlaySnapshot(settings),
  );

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
        saveReplay: async () => {
          const result = await saveGate;
          return result === "failed"
            ? { error: "Replay save failed", ok: false, path: null }
            : { error: null, ok: true, path: replayPath };
        },
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
        setReplaySaveActive: (clipId: string, active: boolean) => {
          deathClipsOverlay?.setReplaySaveActive(clipId, active);
        },
        finishReplayStatusOverlay: (
          clipId: string,
          finalStatus: ReplayStatusOverlayFinalStatus,
        ) => {
          state.finalStatus = finalStatus;
          replayStatusOverlay?.finish(clipId, finalStatus);
        },
        showClipPreviewOverlay: async (clip: ReplayClip) => {
          state.previewRequested = true;
          state.previewAttempts += 1;
          if (!deathClipsOverlay) {
            return true;
          }
          const rendererUrl = process.env.HINEKORA_E2E_RENDERER_URL;
          if (
            process.env.HINEKORA_E2E_FAIL_FIRST_PREVIEW_LOAD === "1" &&
            state.previewAttempts === 1
          ) {
            process.env.HINEKORA_E2E_RENDERER_URL = "http://127.0.0.1:1/";
          }
          try {
            await deathClipsOverlay.showClip(clip);
            return deathClipsOverlay.isRequested();
          } catch (error) {
            state.previewFailures += 1;
            throw error;
          } finally {
            if (rendererUrl === undefined) {
              delete process.env.HINEKORA_E2E_RENDERER_URL;
            } else {
              process.env.HINEKORA_E2E_RENDERER_URL = rendererUrl;
            }
          }
        },
        showReplayStatusOverlay: async (
          clipId: string,
          status: ReplayStatusOverlayActiveStatus,
        ) => {
          state.statusRequested = true;
          if (status === "saving") {
            await replayStatusOverlay?.showSaving(clipId);
          } else {
            await replayStatusOverlay?.showProcessing(clipId);
          }
        },
      }) as unknown as OverlayWindowsService,
  });

  creationService = new ReplayClipCreationService({
    persistAndPublish: (clip) => {
      currentClip = clip;
      state.clipStatus = clip.status;
    },
    preparePreview: async (clip) => {
      state.processingStarted = true;
      publishToPreview(ReplayClipsChannel.PreviewProgress, {
        clipId: clip.id,
        progress: 0.42,
      });
      await processingGate;
      publishToPreview(ReplayClipsChannel.PreviewProgress, {
        clipId: clip.id,
        progress: 1,
      });
    },
    readDuration: () => 1,
    repository: { getByTriggerLineHash: () => null },
    resolveStoredPath: (path) => (path === replayPath ? path : null),
    runClipOperation: (_clipId, operation) => operation(),
    updateClip: (clip, update) => {
      const updatedClip = {
        ...clip,
        ...update,
        updatedAt: new Date().toISOString(),
      };
      state.clipStatus = updatedClip.status;
      currentClip = updatedClip;
      const detail = getClipDetail();
      if (detail) {
        publishToPreview(ReplayClipsChannel.StatusChanged, detail.clip);
      }
      return updatedClip;
    },
  });
  const clip = await creationService.execute({
    detectedAt: new Date().toISOString(),
    game: "poe1",
    kind: deathPreview ? "death" : "manual",
    line: "native replay status e2e",
    lineHash: `native-replay-${Date.now()}`,
  });
  state.clipStatus = clip?.status ?? null;
}

app.whenReady().then(runReplayStatusLifecycle);

app.on("will-quit", () => {
  replayStatusOverlay?.destroy();
  deathClipsOverlay?.destroy();
  replayStatusOverlay = null;
  rmSync(replayDirectory, { force: true, recursive: true });
});
