import type { Locator, Page } from "@playwright/test";

import type { RecordingStorageUsage } from "../../main/modules/recording-storage/RecordingStorage.dto";
import type { GameId } from "../../types";
import {
  emitDashboardAuraLockChanged,
  emitDashboardPoeProcessStart,
  emitDashboardPoeProcessStop,
  emitDashboardRecorderOverlayVisibility,
  expectNoUnexpectedDashboardBridgeCalls,
  getDashboardE2ECalls,
  setupDashboardE2E,
} from "./dashboard-fixture";

interface AppBarE2EOptions {
  activeGame?: GameId;
  auraLocked?: boolean;
  recordingMaxStorageGb?: number;
  recordingStorageUsage?: Partial<RecordingStorageUsage>;
  recorderOverlayVisible?: boolean;
}

const appBarGameLabels: Record<GameId, string> = {
  poe1: "Path of Exile 1",
  poe2: "Path of Exile 2",
};

function getAppBarGameButton(page: Page, game: GameId): Locator {
  const label = appBarGameLabels[game];

  return page
    .getByRole("tab")
    .filter({ hasText: label })
    .getByRole("button", { name: new RegExp(label) });
}

async function selectAppBarGame(page: Page, game: GameId): Promise<void> {
  await getAppBarGameButton(page, game).click();
}

async function setupAppBarE2E(
  page: Page,
  options: AppBarE2EOptions = {},
): Promise<void> {
  await setupDashboardE2E(page, options);
}

export {
  emitDashboardAuraLockChanged as emitAppBarAuraLockChanged,
  emitDashboardPoeProcessStart as emitAppBarPoeProcessStart,
  emitDashboardPoeProcessStop as emitAppBarPoeProcessStop,
  emitDashboardRecorderOverlayVisibility as emitAppBarRecorderOverlayVisibility,
  expectNoUnexpectedDashboardBridgeCalls as expectNoUnexpectedAppBarBridgeCalls,
  getAppBarGameButton,
  getDashboardE2ECalls as getAppBarE2ECalls,
  selectAppBarGame,
  setupAppBarE2E,
};
