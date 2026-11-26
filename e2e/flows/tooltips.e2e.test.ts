import { expect, type Page, test } from "@playwright/test";

import {
  expectNoUnexpectedDashboardBridgeCalls,
  setupDashboardE2E,
} from "../helpers/dashboard-fixture";

async function expectTooltipInViewport(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const tooltip = document.querySelector('[role="tooltip"]');
        if (!tooltip) return null;
        const bounds = tooltip.getBoundingClientRect();
        return {
          open: tooltip.matches(":popover-open"),
          visible: bounds.width > 0 && bounds.height > 0,
          withinViewport:
            bounds.left >= 8 &&
            bounds.top >= 8 &&
            bounds.right <= window.innerWidth - 8 &&
            bounds.bottom <= window.innerHeight - 8,
        };
      }),
    )
    .toEqual({ open: true, visible: true, withinViewport: true });
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
  const settingsPanel = page.locator('[data-onboarding="capture-settings"]');
  await settingsPanel
    .getByRole("button", { name: "Unlock capture profile" })
    .click();
  await expect(
    settingsPanel.getByRole("button", { name: "Lock capture profile" }),
  ).toBeVisible();
  // The dashboard entrance animation starts after a staggered delay.
  // Wait for it to finish so it cannot move the help icon away from the pointer.
  const dashboardContent = page
    .locator(".grid-cols-12")
    .filter({ has: settingsPanel });
  await expect(dashboardContent).toHaveCSS("opacity", "1");
  await expect(dashboardContent).toHaveCSS("transform", "none");
  const help = page.getByRole("img", {
    name: "Controls the quality and file size of short clips.",
  });
  await help.scrollIntoViewIfNeeded();
  // Flush the queued scroll event before hovering: scrolling dismisses tooltips.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
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
