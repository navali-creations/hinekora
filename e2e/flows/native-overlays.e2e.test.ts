import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

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

test.beforeAll(() => {
  if (process.platform !== "win32") {
    return;
  }

  execFileSync(
    process.execPath,
    [
      resolve(projectRoot, "node_modules/vite/bin/vite.js"),
      "build",
      "--config",
      "e2e/helpers/vite.native-overlays-preload.config.mts",
    ],
    {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 60_000,
    },
  );
  execFileSync(
    process.execPath,
    [
      resolve(projectRoot, "node_modules/vite/bin/vite.js"),
      "build",
      "--config",
      "e2e/helpers/vite.native-replay-status-main.config.mts",
    ],
    {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 60_000,
    },
  );
  execFileSync(
    process.execPath,
    [
      resolve(projectRoot, "node_modules/vite/bin/vite.js"),
      "build",
      "--config",
      "e2e/helpers/vite.native-capture-main.config.mts",
    ],
    {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 60_000,
    },
  );
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
