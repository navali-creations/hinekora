import type { AppSettings, AppSettingsUpdate } from "~/types";

const auraOverlaySettingsUpdateKeys = [
  "auraOverlayEnableSnapping",
  "auraOverlayHideLabels",
  "auraOverlayHidePropertiesPanel",
  "auraOverlayShowCenterGuides",
  "auraOverlayShowEditingFrame",
  "auraOverlayShowEditingGrid",
] as const satisfies readonly (keyof AppSettings)[];

type SettingsStoreAuraOverlayUpdate = Partial<
  Pick<AppSettings, (typeof auraOverlaySettingsUpdateKeys)[number]>
>;
type SettingsStoreCommonOverlaySnapshot = Pick<
  AppSettings,
  | "activeGame"
  | "manualReplaySeconds"
  | "replayClipPreviewResolution"
  | "selectedCaptureProfileId"
  | "selectedCaptureProfileIdsByGame"
  | "selectedProfileId"
  | "telemetryCrashReporting"
>;
type SettingsStoreAuraOverlaySnapshot = SettingsStoreCommonOverlaySnapshot &
  Pick<AppSettings, (typeof auraOverlaySettingsUpdateKeys)[number]>;
type SettingsStoreRecorderOverlaySnapshot = SettingsStoreCommonOverlaySnapshot &
  Pick<AppSettings, "manualReplayShowPreview">;
type SettingsStoreClipPreviewOverlaySnapshot = Pick<
  AppSettings,
  "clipPreviewInfoAlertDismissed" | "telemetryCrashReporting"
>;
export type SettingsUpdateInput = AppSettingsUpdate;
export type {
  SettingsStoreAuraOverlaySnapshot,
  SettingsStoreAuraOverlayUpdate,
  SettingsStoreClipPreviewOverlaySnapshot,
  SettingsStoreCommonOverlaySnapshot,
  SettingsStoreRecorderOverlaySnapshot,
};
export { auraOverlaySettingsUpdateKeys };

function createSettingsStoreCommonOverlaySnapshot(
  settings: AppSettings,
): SettingsStoreCommonOverlaySnapshot {
  return {
    activeGame: settings.activeGame,
    manualReplaySeconds: settings.manualReplaySeconds,
    replayClipPreviewResolution: settings.replayClipPreviewResolution,
    selectedCaptureProfileId: settings.selectedCaptureProfileId,
    selectedCaptureProfileIdsByGame: settings.selectedCaptureProfileIdsByGame,
    selectedProfileId: settings.selectedProfileId,
    telemetryCrashReporting: settings.telemetryCrashReporting,
  };
}

export function createSettingsStoreAuraOverlaySnapshot(
  settings: AppSettings,
): SettingsStoreAuraOverlaySnapshot {
  return {
    ...createSettingsStoreCommonOverlaySnapshot(settings),
    auraOverlayEnableSnapping: settings.auraOverlayEnableSnapping,
    auraOverlayHideLabels: settings.auraOverlayHideLabels,
    auraOverlayHidePropertiesPanel: settings.auraOverlayHidePropertiesPanel,
    auraOverlayShowCenterGuides: settings.auraOverlayShowCenterGuides,
    auraOverlayShowEditingFrame: settings.auraOverlayShowEditingFrame,
    auraOverlayShowEditingGrid: settings.auraOverlayShowEditingGrid,
  };
}

export function createSettingsStoreRecorderOverlaySnapshot(
  settings: AppSettings,
): SettingsStoreRecorderOverlaySnapshot {
  return {
    ...createSettingsStoreCommonOverlaySnapshot(settings),
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
