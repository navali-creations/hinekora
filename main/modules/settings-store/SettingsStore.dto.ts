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
type SettingsStoreClipPreviewOverlaySnapshot = Pick<
  AppSettings,
  "clipPreviewInfoAlertDismissed" | "telemetryCrashReporting"
>;
type SettingsStoreScopedSnapshot =
  | SettingsStoreClipPreviewOverlaySnapshot
  | SettingsStoreOverlaySnapshot;

export type SettingsUpdateInput = AppSettingsUpdate;
export type {
  SettingsStoreClipPreviewOverlaySnapshot,
  SettingsStoreOverlaySnapshot,
  SettingsStoreScopedSnapshot,
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

export function createSettingsStoreClipPreviewOverlaySnapshot(
  settings: AppSettings,
): SettingsStoreClipPreviewOverlaySnapshot {
  return {
    clipPreviewInfoAlertDismissed: settings.clipPreviewInfoAlertDismissed,
    telemetryCrashReporting: settings.telemetryCrashReporting,
  };
}
