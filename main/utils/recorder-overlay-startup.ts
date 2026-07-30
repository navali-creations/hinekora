import type { AppSettings } from "~/types";
import * as appLog from "./app-log";

interface RecorderOverlayStartupService {
  setRecorderOverlayMode: (mode: "expanded" | "minimized") => unknown;
  showRecorderOverlay: () => Promise<void>;
}

async function requestRecorderOverlayOnStartup(
  settings: Pick<
    AppSettings,
    "recorderOverlayShowOnStartup" | "recorderOverlayStartMinimized"
  >,
  overlayWindows: RecorderOverlayStartupService,
): Promise<boolean> {
  if (!settings.recorderOverlayShowOnStartup) {
    appLog.logInfo("startup", "Recorder overlay startup request skipped");

    return false;
  }

  overlayWindows.setRecorderOverlayMode(
    settings.recorderOverlayStartMinimized ? "minimized" : "expanded",
  );
  await overlayWindows.showRecorderOverlay();
  appLog.logInfo("startup", "Recorder overlay requested");

  return true;
}

export { requestRecorderOverlayOnStartup };
