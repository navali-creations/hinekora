import { expect, test } from "@playwright/test";

import {
  expectNoUnexpectedAuraOverlayBridgeCalls,
  getAuraOverlayE2ECalls,
  setupAuraOverlayE2E,
} from "../helpers/aura-overlay-fixture";

test.afterEach(async ({ page }) => {
  await expectNoUnexpectedAuraOverlayBridgeCalls(page);
});

test("adds an arched aura through the overlay workflow", async ({ page }) => {
  await setupAuraOverlayE2E(page);

  await page.getByRole("button", { name: "Add arched aura" }).click();

  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);

      return calls.selectCropRegionCalls;
    })
    .toEqual([{ shape: "arc" }]);
  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);
      const update = calls.profileUpdates.at(-1);

      return {
        cropLabel: update?.cropRegions?.at(-1)?.label,
        cropShape: update?.cropRegions?.at(-1)?.shape,
        placementCount: update?.overlayPlacements?.length,
      };
    })
    .toEqual({
      cropLabel: "Arched aura 1",
      cropShape: "arc",
      placementCount: 1,
    });
});

test("edits an arched aura through the overlay workflow", async ({ page }) => {
  await setupAuraOverlayE2E(page, { withArchedAura: true });

  await page
    .getByRole("navigation", { name: "Aura placements" })
    .getByRole("button", { name: "Arched aura 1" })
    .click();
  await expect(
    page.getByRole("region", { name: "Aura placement properties" }),
  ).toBeVisible();

  await page.getByLabel("Straighten").check();
  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);

      return calls.profileUpdates.at(-1)?.overlayPlacements?.at(-1)
        ?.arcStraightened;
    })
    .toBe(true);

  const thicknessInput = page.getByLabel("Thickness");
  await thicknessInput.fill("32");
  await thicknessInput.press("Enter");
  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);

      return calls.profileUpdates.at(-1)?.overlayPlacements?.at(-1)
        ?.arcVisibleThickness;
    })
    .toBe(32);
});
