const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const rendererUrl = process.env.HINEKORA_E2E_RENDERER_URL;
const preloadPath = process.env.HINEKORA_E2E_PRELOAD_PATH;
const overlayKind = process.env.HINEKORA_E2E_OVERLAY_KIND ?? "recorder";

if (!rendererUrl || !preloadPath) {
  throw new Error("Native overlay Electron smoke environment is incomplete");
}

const recorderStatus = {
  activeSessionDirectory: null,
  available: true,
  bufferActive: false,
  encoder: "hardware_h264",
  error: null,
  fps: 60,
  gameRunning: true,
  initialized: true,
  isStartingRecording: false,
  isStoppingRecording: false,
  lastRecordingPath: null,
  outputDirectory: null,
  outputResolution: "native",
  recording: false,
  recordingStartedAt: null,
  runRecordingActive: false,
  runRecordingSession: null,
  runtime: "packaged_obs",
  runtimePath: null,
};
const overlaySettings = {
  activeGame: "poe1",
  auraOverlayEnableSnapping: false,
  auraOverlayHideLabels: false,
  auraOverlayHidePropertiesPanel: false,
  auraOverlayShowCenterGuides: false,
  auraOverlayShowEditingFrame: true,
  auraOverlayShowEditingGrid: false,
  manualReplayShowPreview: true,
  manualReplaySeconds: 30,
  replayClipPreviewResolution: "720p",
  selectedCaptureProfileId: null,
  selectedCaptureProfileIdsByGame: {},
  selectedProfileId: null,
  telemetryCrashReporting: false,
};

ipcMain.handle("settings-store:get-overlay-snapshot", () => overlaySettings);
ipcMain.handle("managed-recorder:get-capture-mode", () => "rewind");
ipcMain.handle("managed-recorder:get-status", () => recorderStatus);
ipcMain.handle("profiles:list", () => []);
ipcMain.handle("overlay-windows:get-recorder-mode", () => "expanded");

const clipPreviewSettings = {
  clipPreviewInfoAlertDismissed: true,
  telemetryCrashReporting: false,
};
const clip = {
  createdAt: "2026-07-29T00:00:00.000Z",
  deathTimestamp: "2026-07-29T00:00:00.000Z",
  durationSeconds: 10,
  error: null,
  fileName: "Native fullscreen clip.mp4",
  framesPerSecond: 60,
  hasMediaFile: true,
  id: "native-clip",
  kind: "manual",
  sizeBytes: 1,
  sourceGame: "poe1",
  sourceLeague: "Standard",
  status: "ready",
  targetDurationSeconds: 10,
  triggerLineHash: "native-clip",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

ipcMain.handle(
  "settings-store:get-clip-preview-overlay-snapshot",
  () => clipPreviewSettings,
);
ipcMain.handle("replay-clips:get", () => ({
  clip,
  durationSeconds: 10,
  mediaUrl: null,
}));

async function createRecorderOverlayWindow() {
  const window = new BrowserWindow({
    width: 216,
    height: 200,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.resolve(preloadPath),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  await window.loadURL(`${rendererUrl}/#/recorder-overlay`);
}

async function createClipPreviewOverlayWindow() {
  const windowedBounds = { x: 120, y: 120, width: 560, height: 520 };
  let clipFullscreen = false;
  let boundsRestoreTimer = null;
  const window = new BrowserWindow({
    ...windowedBounds,
    minWidth: 320,
    minHeight: 220,
    frame: false,
    transparent: true,
    resizable: false,
    show: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.resolve(preloadPath),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  ipcMain.handle("overlay-windows:hide-clip-preview", () => window.close());
  const scheduleBoundsRestore = () => {
    if (boundsRestoreTimer) {
      clearTimeout(boundsRestoreTimer);
    }
    boundsRestoreTimer = setTimeout(() => {
      if (!window.isDestroyed() && !clipFullscreen) {
        window.setBounds(windowedBounds, false);
      }
    }, 100);
  };
  ipcMain.handle("overlay-windows:toggle-clip-preview-fullscreen", () => {
    clipFullscreen = !clipFullscreen;
    window.setFullScreenable(clipFullscreen);
    window.setFullScreen(clipFullscreen);
    if (!clipFullscreen) {
      scheduleBoundsRestore();
    }
    return clipFullscreen;
  });
  window.on("enter-full-screen", () => {
    clipFullscreen = true;
    window.webContents.send(
      "overlay-windows:clip-preview-fullscreen-changed",
      true,
    );
  });
  window.on("leave-full-screen", () => {
    clipFullscreen = false;
    window.setFullScreenable(false);
    scheduleBoundsRestore();
    window.webContents.send(
      "overlay-windows:clip-preview-fullscreen-changed",
      false,
    );
  });
  window.webContents.on("did-finish-load", () => {
    window.setFullScreenable(true);
    window.setFullScreen(true);
    setTimeout(() => {
      if (!window.isDestroyed()) {
        window.webContents.send(
          "overlay-windows:clip-preview-fullscreen-changed",
          true,
        );
      }
    }, 500);
  });

  await window.loadURL(
    `${rendererUrl}/#/clip-preview-overlay?clipId=${clip.id}`,
  );
}

const createOverlayWindow =
  overlayKind === "clip-preview"
    ? createClipPreviewOverlayWindow
    : createRecorderOverlayWindow;

app.whenReady().then(createOverlayWindow);

app.on("window-all-closed", () => {
  app.quit();
});
