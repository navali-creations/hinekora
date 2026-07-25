import { expect, type Page, test } from "@playwright/test";

import {
  emitAppBarAuraLockChanged,
  emitAppBarPoeProcessStart,
  emitAppBarPoeProcessStop,
  emitAppBarRecorderOverlayVisibility,
  emitAppBarRecorderStatus,
  emitAppBarRecordingStorageUsageChanged,
  emitAppBarRecordingStorageUsageRefreshFailed,
  expectNoUnexpectedAppBarBridgeCalls,
  getAppBarE2ECalls,
  getAppBarGameButton,
  selectAppBarGame,
  setupAppBarE2E,
} from "../helpers/appbar-fixture";
import {
  createPoeProcessState,
  poeProcessVariants,
} from "../helpers/poe-process-fixture";

const GIGABYTE = 1024 ** 3;
test.afterEach(async ({ page }) => {
  await expectNoUnexpectedAppBarBridgeCalls(page);
});

test("shows separate sidebar storage budgets and opens storage settings", async ({
  page,
}) => {
  await setupAppBarE2E(page);

  const storageMeter = page.getByRole("link", {
    name: "Open data and storage settings",
  });
  await expect(storageMeter).toBeVisible();
  await expect(storageMeter).toHaveCSS("cursor", "pointer");
  await expect(
    storageMeter.getByRole("progressbar", {
      name: "Recording Storage: 0 GB of 50 GB",
    }),
  ).toHaveAttribute("aria-valuenow", "0");
  await expect(
    storageMeter.getByRole("progressbar", {
      name: "Export Storage: 0 GB of 50 GB",
    }),
  ).toHaveAttribute("aria-valuenow", "0");
  await expect(storageMeter).toContainText("Recording Storage");
  await expect(storageMeter).toContainText("Export Storage");

  await storageMeter.click();
  await expectDataStorageSettings(page);
});

test("keeps sidebar storage anchored while recording status expands", async ({
  page,
}) => {
  await setupAppBarE2E(page);

  await expect.poll(() => getStorageFooterBottomGap(page)).toBe(12);
  await emitAppBarRecorderStatus(page, {
    recording: true,
    recordingStartedAt: "2026-07-22T10:00:00.000Z",
    runRecordingActive: true,
    runRecordingStartedAt: "2026-07-22T10:00:00.000Z",
  });
  await expect(page.getByText("Run active", { exact: true })).toBeVisible();
  await expect.poll(() => getStorageFooterBottomGap(page)).toBe(12);
});

test("updates both deferred storage meters without blocking startup", async ({
  page,
}) => {
  await setupAppBarE2E(page, { recordingStorageUsageDeferred: true });
  const storageMeter = page.getByRole("link", {
    name: "Open data and storage settings",
  });
  await expect(
    storageMeter.getByRole("progressbar", {
      name: "Recording Storage: -- of 50 GB",
    }),
  ).not.toHaveAttribute("aria-valuenow");

  await emitAppBarRecordingStorageUsageChanged(page, {
    clipsSizeBytes: 1 * GIGABYTE,
    diskFreeBytes: 89 * GIGABYTE,
    lowDiskSpace: false,
    recordingsSizeBytes: 10 * GIGABYTE,
    exportVideosSizeBytes: 2 * GIGABYTE,
    exportVideosUsageTruncated: false,
  });

  await expect(
    storageMeter.getByRole("progressbar", {
      name: "Recording Storage: 11 GB of 50 GB",
    }),
  ).toHaveAttribute("aria-valuenow", "22");
  await expect(
    storageMeter.getByRole("progressbar", {
      name: "Export Storage: 2 GB of 50 GB",
    }),
  ).toHaveAttribute("aria-valuenow", "4");
});

test("marks bounded export usage as partial", async ({ page }) => {
  await setupAppBarE2E(page, { recordingStorageUsageDeferred: true });

  await emitAppBarRecordingStorageUsageChanged(page, {
    clipsSizeBytes: 0,
    diskFreeBytes: 89 * GIGABYTE,
    lowDiskSpace: false,
    recordingsSizeBytes: 0,
    exportVideosSizeBytes: 2 * GIGABYTE,
    exportVideosUsageTruncated: true,
  });

  const storageMeter = page.getByRole("link", {
    name: "Open data and storage settings",
  });
  await expect(storageMeter).toContainText("≥2 / 50 GB");
  await expect(
    storageMeter.getByRole("status", {
      name: "Export usage is partial because the library is very large",
    }),
  ).toBeVisible();
});

test("confirms a recording budget that would trigger automatic cleanup", async ({
  page,
}) => {
  await setupAppBarE2E(page, {
    recordingMaxStorageGb: 50,
    recordingStorageUsage: {
      clipsSizeBytes: 4 * GIGABYTE,
      recordingsSizeBytes: 10 * GIGABYTE,
    },
  });
  await page
    .getByRole("link", { name: "Open data and storage settings" })
    .click();
  await expectDataStorageSettings(page);

  const recordingBudget = page
    .getByLabel("Data & Storage")
    .getByRole("spinbutton", { name: /^Max storage GB/ })
    .first();
  await recordingBudget.fill("10");
  await recordingBudget.press("Tab");

  const confirmation = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Reduce recording storage?" }),
  });
  await expect(confirmation).toContainText(
    "Your recordings and clips currently use 14 GB",
  );
  await expect(confirmation).toContainText("about 9.5 GB");
  expect(
    (await getAppBarE2ECalls(page)).settingsUpdates.filter(
      (update) => update.recordingMaxStorageGb !== undefined,
    ),
  ).toEqual([]);

  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(recordingBudget).toHaveValue("50");

  await recordingBudget.fill("10");
  await recordingBudget.press("Tab");
  await page.getByRole("button", { name: "Set 10 GB limit" }).click();
  await expect
    .poll(async () =>
      (await getAppBarE2ECalls(page)).settingsUpdates.filter(
        (update) => update.recordingMaxStorageGb !== undefined,
      ),
    )
    .toEqual([{ recordingMaxStorageGb: 10 }]);
});

test("confirms an export budget below current saved video usage", async ({
  page,
}) => {
  await setupAppBarE2E(page, {
    editorExportMaxStorageGb: 50,
    recordingStorageUsage: {
      exportVideosSizeBytes: 14 * GIGABYTE,
    },
  });
  await page
    .getByRole("link", { name: "Open data and storage settings" })
    .click();
  await expectDataStorageSettings(page);

  const exportBudget = page
    .getByLabel("Data & Storage")
    .getByRole("spinbutton", { name: /^Max storage GB/ })
    .nth(1);
  await exportBudget.fill("10");
  await exportBudget.press("Tab");

  const confirmation = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Reduce export storage?" }),
  });
  await expect(confirmation).toContainText(
    "Your saved edit videos currently use 14 GB",
  );
  await expect(confirmation).toContainText(
    "will delete the oldest saved edit videos",
  );
  await expect(confirmation).toContainText("about 9.5 GB");
  await expect(confirmation).toContainText(
    "Deleted saved edit videos cannot be recovered",
  );
  expect(
    (await getAppBarE2ECalls(page)).settingsUpdates.filter(
      (update) => update.editorExportMaxStorageGb !== undefined,
    ),
  ).toEqual([]);

  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(exportBudget).toHaveValue("50");

  await exportBudget.fill("10");
  await exportBudget.press("Tab");
  await page.getByRole("button", { name: "Set 10 GB limit" }).click();
  await expect
    .poll(async () =>
      (await getAppBarE2ECalls(page)).settingsUpdates.filter(
        (update) => update.editorExportMaxStorageGb !== undefined,
      ),
    )
    .toEqual([{ editorExportMaxStorageGb: 10 }]);
});

test("keeps storage settings reachable after a deferred refresh failure", async ({
  page,
}) => {
  await setupAppBarE2E(page, { recordingStorageUsageDeferred: true });
  await emitAppBarRecordingStorageUsageRefreshFailed(
    page,
    "Recording storage usage could not be refreshed",
  );
  const storageMeter = page.getByRole("link", {
    name: "Open data and storage settings",
  });
  await expect(storageMeter).toContainText("-- / 50 GB");
  await storageMeter.click();
  await expectDataStorageSettings(page);
});

test("warns independently when recording or export budgets are near", async ({
  page,
}) => {
  await setupAppBarE2E(page, {
    recordingStorageUsage: {
      clipsSizeBytes: 5 * GIGABYTE,
      recordingsSizeBytes: 40 * GIGABYTE,
      exportVideosSizeBytes: 46 * GIGABYTE,
    },
  });
  await expect(
    page.getByRole("status", {
      name: "Recording Storage is within 10% of its limit",
    }),
  ).toBeVisible();
  const exportWarning = page.getByRole("status", {
    name: "Export Storage is within 10% of its limit",
  });
  await expect(exportWarning).toBeVisible();
  await expect(exportWarning).toHaveClass(/tooltip/);
  await expect(exportWarning).toHaveClass(/tooltip-left/);
  await expect(exportWarning).toHaveAttribute(
    "data-tip",
    "Export Storage is within 10% of its limit",
  );
  const storageMeter = page.getByRole("link", {
    name: "Open data and storage settings",
  });
  await storageMeter.focus();
  await expect(storageMeter).toBeFocused();
  await page.keyboard.press("Enter");
  await expectDataStorageSettings(page);
});

test("shows unlimited budgets without deriving a misleading percentage", async ({
  page,
}) => {
  await setupAppBarE2E(page, {
    editorExportMaxStorageGb: 0,
    recordingMaxStorageGb: 0,
    recordingStorageUsage: {
      clipsSizeBytes: 1 * GIGABYTE,
      recordingsSizeBytes: 10 * GIGABYTE,
      exportVideosSizeBytes: 2 * GIGABYTE,
    },
  });
  const storageMeter = page.getByRole("link", {
    name: "Open data and storage settings",
  });
  const recordingProgress = storageMeter.getByRole("progressbar", {
    name: "Recording Storage: 11 GB",
  });
  const exportProgress = storageMeter.getByRole("progressbar", {
    name: "Export Storage: 2 GB",
  });
  await expect(recordingProgress).not.toHaveAttribute("aria-valuenow");
  await expect(exportProgress).not.toHaveAttribute("aria-valuenow");
  await expect(recordingProgress.locator("span")).toHaveCount(0);
  await expect(exportProgress.locator("span")).toHaveCount(0);
});

test("shows a critical recording-drive warning independently of budgets", async ({
  page,
}) => {
  await setupAppBarE2E(page, {
    recordingMaxStorageGb: 0,
    recordingStorageUsage: {
      clipsSizeBytes: 1 * GIGABYTE,
      diskFreeBytes: 0,
      lowDiskSpace: true,
      recordingsSizeBytes: 10 * GIGABYTE,
    },
  });
  await expect(
    page.getByRole("status", {
      name: "Recording drive space is critically low",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", {
      name: /Export Storage/,
    }),
  ).toHaveCount(0);
});

test("updates game status for PoE process variants", async ({ page }) => {
  await setupAppBarE2E(page);

  const poe1Button = getAppBarGameButton(page, "poe1");
  const poe2Button = getAppBarGameButton(page, "poe2");
  await emitAppBarPoeProcessStop(page);
  await expect(poe1Button).toContainText("Offline");
  await expect(poe2Button).toContainText("Offline");

  for (const processVariant of poeProcessVariants) {
    await emitAppBarPoeProcessStart(
      page,
      createPoeProcessState(processVariant),
    );

    await expect(
      processVariant.game === "poe1" ? poe1Button : poe2Button,
      `${processVariant.name} should mark the owning game as running`,
    ).toContainText("Running");
    await expect(
      processVariant.game === "poe1" ? poe2Button : poe1Button,
      `${processVariant.name} should not mark the other game as running`,
    ).toContainText("Offline");

    await emitAppBarPoeProcessStop(page);
    await expect(poe1Button).toContainText("Offline");
    await expect(poe2Button).toContainText("Offline");
  }
});

test("switches game and controls the recorder overlay and window", async ({
  page,
}) => {
  await setupAppBarE2E(page);

  await selectAppBarGame(page, "poe1");
  await expect
    .poll(async () => {
      const calls = await getAppBarE2ECalls(page);

      return calls.clientLogActiveGames.at(-1);
    })
    .toEqual({ game: "poe1" });
  await expect(page.getByLabel("poe1 league")).toHaveValue("Mirage");
  await page.getByLabel("poe1 league").selectOption("Standard");
  await expect
    .poll(async () => {
      const calls = await getAppBarE2ECalls(page);

      return calls.settingsUpdates;
    })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activeGame: "poe1",
          activeLeague: "Mirage",
          selectedCaptureProfileId: "default-capture-poe1",
        }),
        expect.objectContaining({
          poe1SelectedLeague: "Standard",
        }),
      ]),
    );

  await page.getByTitle("Show Overlay").click();
  await expect
    .poll(async () => (await getAppBarE2ECalls(page)).recorderOverlayToggles)
    .toBe(1);
  await expect(page.getByTitle("Hide Overlay")).toBeVisible();

  await page.getByTitle("Minimize").click();
  await page.getByTitle("Maximize").click();
  await page.getByTitle("Restore").click();
  await page.getByTitle("Close").click();
  await expect
    .poll(async () => (await getAppBarE2ECalls(page)).mainWindowActions)
    .toEqual(["minimize", "maximize", "unmaximize", "close"]);
});

test("allows the persistent recorder overlay while another game is running", async ({
  page,
}) => {
  await setupAppBarE2E(page, {
    activeGame: "poe1",
    activeGameFocused: false,
    poeProcessState: createPoeProcessState({
      game: "poe2",
      processName: "PathOfExileSteam.exe",
    }),
    recorderGameRunning: false,
    recorderOverlayIgnoreGameFocus: true,
    recorderOverlayRequested: true,
    recorderOverlayVisible: false,
  });

  const overlayButton = page.getByTitle("Show Overlay");
  await expect(overlayButton).toBeEnabled();
  await overlayButton.click();
  await expect
    .poll(async () => (await getAppBarE2ECalls(page)).recorderOverlayToggles)
    .toBe(1);
});

test("reflects recorder overlay visibility events", async ({ page }) => {
  await setupAppBarE2E(page, { recorderOverlayVisible: true });

  await expect(page.getByTitle("Hide Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await emitAppBarRecorderOverlayVisibility(page, false);
  await expect(page.getByTitle("Show Overlay")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await emitAppBarRecorderOverlayVisibility(page, true);
  await expect(page.getByTitle("Hide Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect
    .poll(async () => (await getAppBarE2ECalls(page)).recorderVisibilityEvents)
    .toEqual([false, true]);
});

test("keeps the recorder overlay control stable during aura lock events", async ({
  page,
}) => {
  await setupAppBarE2E(page, {
    auraLocked: true,
    recorderOverlayVisible: true,
  });

  await expect(page.getByTitle("Hide Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await emitAppBarAuraLockChanged(page, false);
  await expect(page.getByTitle("Hide Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect
    .poll(async () => {
      const calls = await getAppBarE2ECalls(page);

      return {
        auraLockEvents: calls.auraLockEvents,
        recorderVisibilityEvents: calls.recorderVisibilityEvents,
      };
    })
    .toEqual({
      auraLockEvents: [false],
      recorderVisibilityEvents: [],
    });
});

async function expectDataStorageSettings(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/settings\?tab=data-storage$/);
  await expect(
    page.getByRole("tab", { name: "Data & Storage" }),
  ).toHaveAttribute("aria-selected", "true");
  const settingsPanel = page.getByLabel("Data & Storage");
  await expect(
    settingsPanel.getByText("Recording Storage", { exact: true }),
  ).toBeVisible();
  await expect(
    settingsPanel.getByRole("textbox", { name: /^Recording folder/ }),
  ).toBeVisible();
  await expect(
    settingsPanel.getByRole("textbox", { name: /^Exports folder/ }),
  ).toBeVisible();
  await expect(
    settingsPanel.getByText(
      "Finished videos saved from the editor. These are separate from your recordings and clips.",
      { exact: true },
    ),
  ).toBeVisible();
}

async function getStorageFooterBottomGap(page: Page): Promise<number> {
  const sidebar = page.locator("aside").first();
  const storageMeter = page.getByRole("link", {
    name: "Open data and storage settings",
  });
  const [sidebarBox, storageMeterBox] = await Promise.all([
    sidebar.boundingBox(),
    storageMeter.boundingBox(),
  ]);

  if (!sidebarBox || !storageMeterBox) {
    return -1;
  }

  return Math.round(
    sidebarBox.y +
      sidebarBox.height -
      (storageMeterBox.y + storageMeterBox.height),
  );
}
