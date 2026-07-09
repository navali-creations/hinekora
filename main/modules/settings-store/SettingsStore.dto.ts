import type { AppSettings } from "~/types";

type SettingsStoreOverlaySnapshot = Partial<AppSettings> &
  Pick<
    AppSettings,
    | "activeGame"
    | "auraOverlayShowEditingFrame"
    | "deathClipSeconds"
    | "selectedCaptureProfileId"
    | "selectedCaptureProfileIdsByGame"
    | "selectedProfileId"
    | "telemetryCrashReporting"
    | "telemetryUsageAnalytics"
  >;
type SettingsStoreClipPreviewOverlaySnapshot = Partial<AppSettings> &
  Pick<
    AppSettings,
    | "clipPreviewInfoAlertDismissed"
    | "telemetryCrashReporting"
    | "telemetryUsageAnalytics"
  >;
type SettingsStoreScopedSnapshot =
  | SettingsStoreClipPreviewOverlaySnapshot
  | SettingsStoreOverlaySnapshot;

export type SettingsUpdateInput = Partial<AppSettings>;
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
    deathClipSeconds: settings.deathClipSeconds,
    selectedCaptureProfileId: settings.selectedCaptureProfileId,
    selectedCaptureProfileIdsByGame: settings.selectedCaptureProfileIdsByGame,
    selectedProfileId: settings.selectedProfileId,
    telemetryCrashReporting: settings.telemetryCrashReporting,
    telemetryUsageAnalytics: settings.telemetryUsageAnalytics,
  };
}

export function createSettingsStoreClipPreviewOverlaySnapshot(
  settings: AppSettings,
): SettingsStoreClipPreviewOverlaySnapshot {
  return {
    clipPreviewInfoAlertDismissed: settings.clipPreviewInfoAlertDismissed,
    telemetryCrashReporting: settings.telemetryCrashReporting,
    telemetryUsageAnalytics: settings.telemetryUsageAnalytics,
  };
}
