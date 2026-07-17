import { expect, type Locator, type Page, test } from "@playwright/test";

import {
  emitAppBarAuraLockChanged,
  emitAppBarPoeProcessStart,
  emitAppBarPoeProcessStop,
  emitAppBarRecorderOverlayVisibility,
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
const lowDiskSpaceTooltip =
  "Recording drive space is critically low. New recordings and clips may fail unless space is freed.";
const storageSettingsTooltip = "Open data and storage settings";
const storageWarningTooltip =
  "Storage is within 10% of its limit. Once full, the oldest recordings and clips will be deleted and replaced by new recordings and clips.";
test.afterEach(async ({ page }) => {
  await expectNoUnexpectedAppBarBridgeCalls(page);
});

test("shows storage usage and opens data storage settings on click", async ({
  page,
}) => {
  await setupAppBarE2E(page);

  const storageMeter = page.getByRole("button", {
    name: "0 GB used of 50 GB. Open data and storage settings",
  });
  await expect(storageMeter).toBeVisible();
  await expect(storageMeter).toHaveCSS("cursor", "pointer");

  const storageProgress = storageMeter.getByRole("progressbar");
  await expect(storageProgress).toHaveAttribute("aria-valuenow", "0");
  const [storageLabelBounds, storageProgressBounds] = await Promise.all([
    storageMeter.getByText("0 GB / 50 GB", { exact: true }).boundingBox(),
    storageProgress.boundingBox(),
  ]);
  expect(storageLabelBounds).not.toBeNull();
  expect(storageProgressBounds).not.toBeNull();
  expect(storageProgressBounds?.width).toBeCloseTo(
    storageLabelBounds?.width ?? 0,
    0,
  );

  const storageTooltip = page
    .locator(".tooltip.tooltip-left")
    .filter({ has: storageMeter });
  await storageMeter.hover();
  await expectDaisyTooltipVisible(storageTooltip, storageSettingsTooltip);

  await storageMeter.click();

  await expectDataStorageSettings(page);
});

test("shows the near-limit warning and supports keyboard navigation", async ({
  page,
}) => {
  await setupAppBarE2E(page, {
    recordingStorageUsage: {
      clipsSizeBytes: 5 * GIGABYTE,
      recordingsSizeBytes: 40 * GIGABYTE,
    },
  });

  const storageMeter = page.getByRole("button", {
    name: "45 GB used of 50 GB. Open data and storage settings",
  });
  const storageProgress = storageMeter.getByRole("progressbar");
  await expect(storageProgress).toHaveAttribute("aria-valuenow", "90");
  await expect(storageProgress.locator("span")).toHaveClass(/bg-warning/);

  const warning = page.getByRole("status", {
    name: storageWarningTooltip,
  });
  const warningTooltip = warning.locator("..");
  await expect(warning).toBeVisible();
  await expect(warning).toHaveAttribute("tabindex", "0");
  await expect(warningTooltip).toHaveClass(/tooltip-bottom/);
  await warning.hover();
  await expectDaisyTooltipVisible(warningTooltip, storageWarningTooltip);
  await page.mouse.move(0, 0);
  await warning.focus();
  await expect(warning).toBeFocused();
  await expectDaisyTooltipVisible(warningTooltip, storageWarningTooltip);

  await storageMeter.focus();
  await expect(storageMeter).toBeFocused();
  const storageTooltip = page
    .locator(".tooltip.tooltip-left")
    .filter({ has: storageMeter });
  await expectDaisyTooltipVisible(storageTooltip, storageSettingsTooltip);
  await page.keyboard.press("Enter");

  await expectDataStorageSettings(page);
});

test("shows recording disk free space when the configured limit is disabled", async ({
  page,
}) => {
  await setupAppBarE2E(page, {
    recordingMaxStorageGb: 0,
    recordingStorageUsage: {
      clipsSizeBytes: 1 * GIGABYTE,
      diskFreeBytes: 89 * GIGABYTE,
      recordingsSizeBytes: 10 * GIGABYTE,
    },
  });

  const storageMeter = page.getByRole("button", {
    name: "11 GB used; 89 GB free on the recording drive. Open data and storage settings",
  });
  await expect(storageMeter).toHaveText("11 GB / 89 GB");
  await expect(storageMeter).toHaveCSS("cursor", "pointer");

  const storageProgress = storageMeter.getByRole("progressbar");
  await expect(storageProgress).toHaveAttribute("aria-valuenow", "11");
  await expect(storageProgress.locator("span")).toHaveClass(/bg-primary/);
  await expect(
    page.getByRole("status", { name: storageWarningTooltip }),
  ).toHaveCount(0);

  await storageMeter.click();
  await expectDataStorageSettings(page);
});

test("shows a critical warning when the recording disk is full", async ({
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

  const storageMeter = page.getByRole("button", {
    name: "11 GB used; 0 GB free on the recording drive. Open data and storage settings",
  });
  await expect(storageMeter).toHaveText("11 GB / 0 GB");
  const storageProgress = storageMeter.getByRole("progressbar");
  await expect(storageProgress).toHaveAttribute("aria-valuenow", "100");
  await expect(storageProgress.locator("span")).toHaveClass(/bg-error/);

  const warning = page.getByRole("status", { name: lowDiskSpaceTooltip });
  const warningTooltip = warning.locator("..");
  await expect(warningTooltip).toHaveClass(/tooltip-error/);
  await warning.hover();
  await expectDaisyTooltipVisible(warningTooltip, lowDiskSpaceTooltip);
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

async function expectDaisyTooltipVisible(
  tooltip: Locator,
  expectedText: string,
): Promise<void> {
  await expect(tooltip).toHaveAttribute("data-tip", expectedText);
  await expect
    .poll(() =>
      tooltip.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element, "::before").opacity),
      ),
    )
    .toBeGreaterThan(0.99);
}

async function expectDataStorageSettings(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/settings\?tab=data-storage$/);
  await expect(
    page.getByRole("tab", { name: "Data & Storage" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByText("Recording Storage", { exact: true }),
  ).toBeVisible();
}
