import type { AppSettings, AppSettingsUpdate } from "~/types";

type SettingsStoreOverlaySnapshot = Pick<
  AppSettings,
  | "activeGame"
  | "auraOverlayShowEditingFrame"
  | "manualReplaySeconds"
  | "replayClipPreviewResolution"
  | "selectedCaptureProfileId"
  | "selectedCaptureProfileIdsByGame"
  | "selectedProfileId"
  | "telemetryCrashReporting"
>;
type SettingsStoreRecorderOverlaySnapshot = SettingsStoreOverlaySnapshot &
  Pick<AppSettings, "manualReplayShowPreview">;
type SettingsStoreClipPreviewOverlaySnapshot = Pick<
  AppSettings,
  "clipPreviewInfoAlertDismissed" | "telemetryCrashReporting"
>;
export type SettingsUpdateInput = AppSettingsUpdate;
export type {
  SettingsStoreClipPreviewOverlaySnapshot,
  SettingsStoreOverlaySnapshot,
  SettingsStoreRecorderOverlaySnapshot,
};

export function createSettingsStoreOverlaySnapshot(
  settings: AppSettings,
): SettingsStoreOverlaySnapshot {
  return {
    activeGame: settings.activeGame,
    auraOverlayShowEditingFrame: settings.auraOverlayShowEditingFrame,
    manualReplaySeconds: settings.manualReplaySeconds,
    replayClipPreviewResolution: settings.replayClipPreviewResolution,
    selectedCaptureProfileId: settings.selectedCaptureProfileId,
    selectedCaptureProfileIdsByGame: settings.selectedCaptureProfileIdsByGame,
    selectedProfileId: settings.selectedProfileId,
    telemetryCrashReporting: settings.telemetryCrashReporting,
  };
}

export function createSettingsStoreRecorderOverlaySnapshot(
  settings: AppSettings,
): SettingsStoreRecorderOverlaySnapshot {
  return {
    ...createSettingsStoreOverlaySnapshot(settings),
    manualReplayShowPreview: settings.manualReplayShowPreview,
  };
}

export function createSettingsStoreClipPreviewOverlaySnapshot(
  settings: AppSettings,
): SettingsStoreClipPreviewOverlaySnapshot {
  return {
    clipPreviewInfoAlertDismissed: settings.clipPreviewInfoAlertDismissed,
    telemetryCrashReporting: settings.telemetryCrashReporting,
  };
}
