import http from "node:http";
import { resolve } from "node:path";

import { app, BrowserWindow, desktopCapturer, ipcMain } from "electron";

import { CapturePreviewChannel } from "~/main/modules/capture-preview/CapturePreview.channels";
import {
  CapturePreviewDisplayMediaAuthorizer,
  registerCapturePreviewDisplayMediaHandler,
} from "~/main/modules/capture-preview/CapturePreview.display-media";
import {
  createWindowRoleArgument,
  WindowName,
} from "~/main/modules/main-window/MainWindow.types";

const preloadPath = process.env.HINEKORA_E2E_PRELOAD_PATH;

if (!preloadPath) {
  throw new Error("Native capture Electron smoke environment is incomplete");
}
const resolvedPreloadPath = resolve(preloadPath);

const displayMediaAuthorizer = new CapturePreviewDisplayMediaAuthorizer();

ipcMain.handle(CapturePreviewChannel.ListSources, async () => {
  const sources = await desktopCapturer.getSources({
    fetchWindowIcons: false,
    thumbnailSize: { width: 1, height: 1 },
    types: ["window"],
  });
  const targetSources = sources.filter(
    (source) => source.name === "Hinekora Native Capture Target",
  );
  displayMediaAuthorizer.replaceAvailableSources(
    targetSources.map((source) => ({ id: source.id, name: source.name })),
  );

  return targetSources.map((source) => ({
    displayId: null,
    game: "poe2" as const,
    height: null,
    id: source.id,
    kind: "window" as const,
    name: "Path of Exile 2",
    thumbnailDataUrl: null,
    width: null,
  }));
});
ipcMain.handle(
  CapturePreviewChannel.PrepareDisplayMediaSource,
  (event, sourceId: string) => {
    const processId = event.senderFrame?.processId ?? event.processId;
    const frameId = event.senderFrame?.routingId ?? event.frameId;

    return displayMediaAuthorizer.prepare(processId, frameId, sourceId);
  },
);

async function createCaptureHandshakeWindows(): Promise<void> {
  registerCapturePreviewDisplayMediaHandler(displayMediaAuthorizer);

  const targetWindow = new BrowserWindow({
    height: 240,
    show: true,
    title: "Hinekora Native Capture Target",
    width: 320,
  });
  await targetWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      '<!doctype html><title>Hinekora Native Capture Target</title><body style="background:#0a8;color:white">Capture target</body>',
    )}`,
  );

  const probeWindow = new BrowserWindow({
    height: 180,
    show: true,
    title: "Hinekora Native Capture Probe",
    width: 280,
    webPreferences: {
      additionalArguments: [createWindowRoleArgument(WindowName.AuraOverlay)],
      preload: resolvedPreloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  const probeServer = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      "<!doctype html><title>Hinekora Native Capture Probe</title><body>Capture probe</body>",
    );
  });
  await new Promise<void>((resolveServer, reject) => {
    probeServer.once("error", reject);
    probeServer.listen(0, "127.0.0.1", resolveServer);
  });
  const address = probeServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Native capture probe server did not bind a TCP port");
  }
  probeWindow.once("closed", () => probeServer.close());
  await probeWindow.loadURL(
    `http://127.0.0.1:${address.port}/#/native-capture-probe`,
  );
}

app.whenReady().then(createCaptureHandshakeWindows);

app.on("window-all-closed", () => {
  app.quit();
});
