import type { AppSettings } from "~/types";

type SettingsStoreOverlaySnapshot = Partial<AppSettings> &
  Pick<
    AppSettings,
    | "activeGame"
    | "auraOverlayShowEditingFrame"
    | "clipPreviewInfoAlertDismissed"
    | "deathClipSeconds"
    | "selectedCaptureProfileId"
    | "selectedCaptureProfileIdsByGame"
    | "selectedProfileId"
    | "telemetryCrashReporting"
    | "telemetryUsageAnalytics"
  >;

export type SettingsUpdateInput = Partial<AppSettings>;
export type { SettingsStoreOverlaySnapshot };

export function createSettingsStoreOverlaySnapshot(
  settings: AppSettings,
): SettingsStoreOverlaySnapshot {
  return {
    activeGame: settings.activeGame,
    auraOverlayShowEditingFrame: settings.auraOverlayShowEditingFrame,
    clipPreviewInfoAlertDismissed: settings.clipPreviewInfoAlertDismissed,
    deathClipSeconds: settings.deathClipSeconds,
    selectedCaptureProfileId: settings.selectedCaptureProfileId,
    selectedCaptureProfileIdsByGame: settings.selectedCaptureProfileIdsByGame,
    selectedProfileId: settings.selectedProfileId,
    telemetryCrashReporting: settings.telemetryCrashReporting,
    telemetryUsageAnalytics: settings.telemetryUsageAnalytics,
  };
}
