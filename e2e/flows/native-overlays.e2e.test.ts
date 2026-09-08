import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

import {
  createWindowRoleArgument,
  WindowName,
} from "~/main/modules/main-window/MainWindow.types";

import type { NativeOverlayDevToolsGlobal } from "~/e2e/helpers/native-overlay-devtools.types";

const projectRoot = resolve(__dirname, "../..");
const preloadPath = resolve(
  projectRoot,
  ".vite/e2e-native-overlays/preload.js",
);
const nativeCaptureMainPath = resolve(
  projectRoot,
  ".vite/e2e-native-overlays/native-capture-main.js",
);
const nativeReplayStatusMainPath = resolve(
  projectRoot,
  ".vite/e2e-native-overlays/native-replay-status-main.js",
);
const nativeOverlayDevToolsMainPath = resolve(
  projectRoot,
  ".vite/e2e-native-overlays/native-overlay-devtools-main.js",
);
const nativeOverlayWindowRoleEnvironment = {
  HINEKORA_E2E_CLIP_PREVIEW_WINDOW_ROLE_ARGUMENT: createWindowRoleArgument(
    WindowName.ClipPreviewOverlay,
  ),
  HINEKORA_E2E_RECORDER_WINDOW_ROLE_ARGUMENT: createWindowRoleArgument(
    WindowName.RecorderOverlay,
  ),
};

test.beforeAll(() => {
  if (process.platform !== "win32") {
    return;
  }

  const vitePath = resolve(projectRoot, "node_modules/vite/bin/vite.js");
  const fixtureConfigs = [
    "e2e/helpers/vite.native-overlays-preload.config.mts",
    "e2e/helpers/vite.native-replay-status-main.config.mts",
    "e2e/helpers/vite.native-capture-main.config.mts",
    "e2e/helpers/vite.native-overlay-devtools-main.config.mts",
  ];
  for (const config of fixtureConfigs) {
    execFileSync(process.execPath, [vitePath, "build", "--config", config], {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 60_000,
    });
  }
});

test("persists overlay DevTools across native Electron launches", async () => {
  test.skip(process.platform !== "win32", "Hinekora targets Windows capture");

  const settingsDirectory = mkdtempSync(
    join(tmpdir(), "hinekora-e2e-settings-"),
  );
  const settingsPath = join(settingsDirectory, "settings.sqlite");
  const launchApp = () =>
    electron.launch({
      args: [nativeOverlayDevToolsMainPath],
      env: {
        ...process.env,
        HINEKORA_E2E_SETTINGS_DB_PATH: settingsPath,
      },
    });
  let electronApp: Awaited<ReturnType<typeof launchApp>> | null = null;

  try {
    electronApp = await launchApp();
    const firstApp = electronApp;
    await expect
      .poll(() => firstApp.windows().map((window) => window.url()))
      .toEqual(
        expect.arrayContaining([
          expect.stringContaining("#/main"),
          expect.stringContaining("#/recorder-overlay"),
        ]),
      );
    const overlayWindow = firstApp
      .windows()
      .find((window) => window.url().endsWith("#/recorder-overlay"));
    const controllerWindow = firstApp
      .windows()
      .find((window) => window.url().endsWith("#/main"));
    if (!overlayWindow || !controllerWindow) {
      throw new Error("Native controller and overlay windows were not created");
    }
    await controllerWindow.evaluate(async () => {
      await window.electron.settings.update({ overlayDevToolsEnabled: true });
    });

    await expect
      .poll(() =>
        firstApp.evaluate(() => {
          const harness = (globalThis as NativeOverlayDevToolsGlobal)
            .__HINEKORA_OVERLAY_DEVTOOLS_E2E__;
          return harness.getState();
        }),
      )
      .toMatchObject({
        overlays: [
          {
            devToolsOpened: true,
            focused: true,
          },
        ],
      });

    await firstApp.evaluate(async () => {
      const harness = (globalThis as NativeOverlayDevToolsGlobal)
        .__HINEKORA_OVERLAY_DEVTOOLS_E2E__;
      await harness.createOverlay();
    });

    await expect
      .poll(() =>
        firstApp.evaluate(() => {
          const harness = (globalThis as NativeOverlayDevToolsGlobal)
            .__HINEKORA_OVERLAY_DEVTOOLS_E2E__;
          return harness
            .getState()
            .overlays.map((overlay) => overlay.devToolsOpened);
        }),
      )
      .toEqual([true, true]);

    await firstApp.close();
    electronApp = null;

    const relaunchedApp = await launchApp();
    try {
      await expect
        .poll(() =>
          relaunchedApp.evaluate(() => {
            const harness = (globalThis as NativeOverlayDevToolsGlobal)
              .__HINEKORA_OVERLAY_DEVTOOLS_E2E__;
            return harness
              .getState()
              .overlays.map((overlay) => overlay.devToolsOpened);
          }),
        )
        .toEqual([true]);

      const relaunchedController = relaunchedApp
        .windows()
        .find((window) => window.url().endsWith("#/main"));
      expect(relaunchedController).toBeDefined();
      await relaunchedController!.evaluate(async () => {
        await window.electron.settings.update({
          overlayDevToolsEnabled: false,
        });
      });

      await expect
        .poll(() =>
          relaunchedApp.evaluate(() => {
            const harness = (globalThis as NativeOverlayDevToolsGlobal)
              .__HINEKORA_OVERLAY_DEVTOOLS_E2E__;
            return harness
              .getState()
              .overlays.map((overlay) => overlay.devToolsOpened);
          }),
        )
        .toEqual([false]);
    } finally {
      await relaunchedApp.close();
    }
  } finally {
    if (electronApp) {
      await electronApp.close();
    }
    rmSync(settingsDirectory, { force: true, recursive: true });
  }
});

test("loads the recorder overlay through a native sandboxed window", async ({
  baseURL,
}) => {
  test.skip(process.platform !== "win32", "Hinekora targets Windows capture");

  const electronApp = await electron.launch({
    args: [
      resolve(projectRoot, "e2e/helpers/native-overlays-electron-main.cjs"),
    ],
    env: {
      ...process.env,
      ...nativeOverlayWindowRoleEnvironment,
      HINEKORA_E2E_PRELOAD_PATH: preloadPath,
      HINEKORA_E2E_RENDERER_URL: baseURL ?? "http://127.0.0.1:5173",
    },
  });

  try {
    const overlayWindow = await electronApp.firstWindow();
    await expect(overlayWindow.getByLabel("Recording timer")).toHaveText(
      "00:00",
    );
    await expect(
      overlayWindow.getByText("Aura controls", { exact: true }),
    ).toBeVisible();
    expect(
      await overlayWindow.evaluate(
        () => typeof window.electron.replayClips.onDeleted,
      ),
    ).toBe("function");

    const nativeWindowState = await electronApp.evaluate(
      ({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        const preferences = (
          window?.webContents as unknown as
            | {
                getLastWebPreferences(): {
                  contextIsolation?: boolean;
                  nodeIntegration?: boolean;
                  sandbox?: boolean;
                };
              }
            | undefined
        )?.getLastWebPreferences();

        return {
          contextIsolation: preferences?.contextIsolation,
          nodeIntegration: preferences?.nodeIntegration,
          sandbox: preferences?.sandbox,
          size: window?.getSize(),
        };
      },
    );
    expect(nativeWindowState).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      size: [216, 200],
    });
  } finally {
    await electronApp.close();
  }
});

test("leaves clip-preview fullscreen and restores its native window bounds", async ({
  baseURL,
}) => {
  test.skip(process.platform !== "win32", "Hinekora targets Windows capture");

  const electronApp = await electron.launch({
    args: [
      resolve(projectRoot, "e2e/helpers/native-overlays-electron-main.cjs"),
    ],
    env: {
      ...process.env,
      ...nativeOverlayWindowRoleEnvironment,
      HINEKORA_E2E_OVERLAY_KIND: "clip-preview",
      HINEKORA_E2E_PRELOAD_PATH: preloadPath,
      HINEKORA_E2E_RENDERER_URL: baseURL ?? "http://127.0.0.1:5173",
    },
  });

  try {
    const overlayWindow = await electronApp.firstWindow();
    const closeFullscreenButton = overlayWindow
      .getByLabel("Close fullscreen")
      .first();
    await expect(closeFullscreenButton).toBeVisible();
    await closeFullscreenButton.click();
    await expect(closeFullscreenButton).toHaveCount(0);

    await expect
      .poll(() =>
        electronApp.evaluate(({ BrowserWindow }) => {
          const window = BrowserWindow.getAllWindows()[0];
          return {
            bounds: window?.getBounds(),
            isFullScreen: window?.isFullScreen(),
            isMaximized: window?.isMaximized(),
          };
        }),
      )
      .toEqual({
        bounds: { height: 520, width: 560, x: 120, y: 120 },
        isFullScreen: false,
        isMaximized: false,
      });
  } finally {
    await electronApp.close();
  }
});

test("runs the replay-status lifecycle in a native sandboxed window", async ({
  baseURL,
}) => {
  test.skip(process.platform !== "win32", "Hinekora targets Windows capture");

  const electronApp = await electron.launch({
    args: [nativeReplayStatusMainPath],
    env: {
      ...process.env,
      HINEKORA_E2E_RENDERER_URL: baseURL ?? "http://127.0.0.1:5173",
    },
  });

  try {
    const overlayWindow = await electronApp.firstWindow();
    const notification = overlayWindow.getByRole("status");

    await expect(notification).toContainText("Processing replay");
    await expect(notification).toHaveAttribute("data-status", "processing");
    await expect(notification).toContainText("Replay saved");
    await expect(notification).toHaveAttribute("data-status", "saved");
    await expect(notification).toHaveAttribute("data-dismissing", "true", {
      timeout: 5_000,
    });

    await expect
      .poll(() =>
        electronApp.evaluate(() => {
          return (
            globalThis as typeof globalThis & {
              __HINEKORA_REPLAY_STATUS_E2E__?: unknown;
            }
          ).__HINEKORA_REPLAY_STATUS_E2E__;
        }),
      )
      .toEqual({
        clipStatus: "ready",
        finalStatus: "saved",
        manualReplayShowPreview: false,
        previewRequested: false,
        statusRequested: true,
      });

    const nativeWindowState = await electronApp.evaluate(
      ({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        const preferences = (
          window?.webContents as unknown as
            | {
                getLastWebPreferences(): {
                  contextIsolation?: boolean;
                  nodeIntegration?: boolean;
                  sandbox?: boolean;
                };
              }
            | undefined
        )?.getLastWebPreferences();

        return {
          contextIsolation: preferences?.contextIsolation,
          focusable: window?.isFocusable(),
          nodeIntegration: preferences?.nodeIntegration,
          sandbox: preferences?.sandbox,
          size: window?.getSize(),
        };
      },
    );
    expect(nativeWindowState).toEqual({
      contextIsolation: true,
      focusable: false,
      nodeIntegration: false,
      sandbox: true,
      size: [420, 260],
    });

    await expect
      .poll(() =>
        electronApp.evaluate(({ BrowserWindow }) => {
          return BrowserWindow.getAllWindows()[0]?.isVisible();
        }),
      )
      .toBe(false);
  } finally {
    await electronApp.close();
  }
});

test("authorizes native display capture once for the prepared source", async () => {
  test.skip(process.platform !== "win32", "Hinekora targets Windows capture");

  const electronApp = await electron.launch({
    args: [nativeCaptureMainPath],
    env: {
      ...process.env,
      HINEKORA_E2E_PRELOAD_PATH: preloadPath,
    },
  });

  try {
    await expect
      .poll(async () =>
        Promise.all(electronApp.windows().map((window) => window.title())),
      )
      .toEqual(
        expect.arrayContaining([
          "Hinekora Native Capture Target",
          "Hinekora Native Capture Probe",
        ]),
      );
    const probeWindow = electronApp
      .windows()
      .find(
        (window) => new URL(window.url()).hash === "#/native-capture-probe",
      );
    expect(probeWindow).toBeDefined();

    const result = await probeWindow!.evaluate(async () => {
      const [source] = await window.electron.capturePreview.listSources(true);
      if (!source) {
        throw new Error("Native capture target was not listed");
      }

      const missingPrepared =
        await window.electron.capturePreview.prepareDisplayMediaSource(
          "window:missing",
        );
      const prepared =
        await window.electron.capturePreview.prepareDisplayMediaSource(
          source.id,
        );
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: true,
      });
      const videoTrackCount = stream.getVideoTracks().length;
      stream.getTracks().forEach((track) => {
        track.stop();
      });

      let unpreparedVideoTrackCount = 0;
      try {
        const unpreparedStream = await navigator.mediaDevices.getDisplayMedia({
          audio: false,
          video: true,
        });
        unpreparedVideoTrackCount = unpreparedStream.getVideoTracks().length;
        unpreparedStream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch {
        unpreparedVideoTrackCount = 0;
      }

      return {
        missingPrepared,
        prepared,
        unpreparedVideoTrackCount,
        videoTrackCount,
      };
    });

    expect(result).toEqual({
      missingPrepared: false,
      prepared: true,
      unpreparedVideoTrackCount: 0,
      videoTrackCount: 1,
    });
  } finally {
    await electronApp.close();
  }
});
