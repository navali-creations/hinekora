import { expect, type Page, test } from "@playwright/test";

import {
  expectNoUnexpectedDashboardBridgeCalls,
  setupDashboardE2E,
} from "../helpers/dashboard-fixture";

async function expectTooltipInViewport(page: Page) {
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  const bounds = await tooltip.boundingBox();
  const viewport = page.viewportSize();
  if (!bounds || !viewport)
    throw new Error("Expected tooltip and viewport bounds");
  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(bounds.y).toBeGreaterThanOrEqual(8);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 8);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 8);
  expect(
    await tooltip.evaluate((element) => element.matches(":popover-open")),
  ).toBe(true);
}

test.afterEach(async ({ page }) => {
  await expectNoUnexpectedDashboardBridgeCalls(page);
});

test("keeps storage warnings inside the window beside the sidebar", async ({
  page,
}) => {
  await setupDashboardE2E(page, {
    recordingStorageUsage: {
      clipsSizeBytes: 5 * 1024 ** 3,
      recordingsSizeBytes: 40 * 1024 ** 3,
      exportVideosSizeBytes: 46 * 1024 ** 3,
    },
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  const warning = page.getByRole("status", {
    name: "Recording Storage is within 10% of its limit",
  });
  await warning.hover();
  await expectTooltipInViewport(page);
  await expect(page.getByRole("tooltip")).toHaveText(
    "Recording Storage is within 10% of its limit",
  );
});

test("keeps capture quality help outside the settings panel clipping", async ({
  page,
}) => {
  await setupDashboardE2E(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page
    .locator('[data-onboarding="capture-settings"]')
    .getByRole("button", { name: "Unlock capture profile" })
    .click();
  const help = page.getByRole("img", {
    name: "Controls the quality and file size of short clips.",
  });
  await help.hover();
  await expectTooltipInViewport(page);
  await expect(page.getByRole("tooltip")).toHaveText(
    "Controls the quality and file size of short clips.",
  );
  await page.mouse.move(0, 0);
  await help.focus();
  await expectTooltipInViewport(page);
  const beforeMove = await page.getByRole("tooltip").boundingBox();
  if (!beforeMove) throw new Error("Expected focused tooltip bounds");
  await help.evaluate((element) => {
    element.style.transform = "translateX(-160px)";
  });
  await expect
    .poll(
      async () =>
        (await page.getByRole("tooltip").boundingBox())?.x ?? beforeMove.x,
    )
    .toBeLessThan(beforeMove.x - 80);
  await expectTooltipInViewport(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});
