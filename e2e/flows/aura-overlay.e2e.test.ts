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
  await expect(
    page
      .getByRole("navigation", { name: "Aura placements" })
      .getByRole("button", { name: "Arched aura 1" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("toggles aura editing guides from the overlay toolbar", async ({
  page,
}) => {
  await setupAuraOverlayE2E(page);

  await page.getByLabel("Show aura display options").click();
  const options = page.getByRole("complementary", {
    name: "Aura display options",
  });
  await expect(options).toBeVisible();
  await expect(page.getByLabel("1 active options")).toHaveText("1");
  await options
    .getByRole("checkbox", { name: "Show aura editing frame" })
    .uncheck();
  await options
    .getByRole("checkbox", { name: "Show aura editing grid" })
    .check();
  await expect(
    page.getByRole("application", { name: "Aura overlay" }),
  ).toHaveClass(/auraSelectionGrid/);
  await options
    .getByRole("checkbox", { name: "Show aura center lines" })
    .check();
  await options
    .getByRole("checkbox", { name: "Enable aura item snapping" })
    .check();

  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);

      return calls.settingsUpdates;
    })
    .toEqual([
      { auraOverlayShowEditingFrame: false },
      { auraOverlayShowEditingGrid: true },
      { auraOverlayShowCenterGuides: true },
      { auraOverlayEnableSnapping: true },
    ]);
  await expect(
    page.getByRole("application", { name: "Aura overlay" }),
  ).toHaveClass(/auraSelectionGrid/);
  await expect(page.locator('[data-aura-center-guide="x"]')).toBeVisible();
  await expect(page.locator('[data-aura-center-guide="y"]')).toBeVisible();
  await expect(page.getByLabel("3 active options")).toHaveText("3");
});

test("resizes every aura to a selected anchor size with undo and redo", async ({
  page,
}) => {
  await setupAuraOverlayE2E(page, { withArchedAura: true });

  await page
    .getByRole("navigation", { name: "Aura placements" })
    .getByRole("button", { name: "Arched aura 1" })
    .click();
  const scaleInput = page.getByLabel("Scale");
  await scaleInput.fill("2");
  await scaleInput.press("Enter");
  await page.getByRole("button", { name: "Add new aura" }).click();

  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);

      return calls.profileUpdates
        .at(-1)
        ?.overlayPlacements?.map((placement) => placement.scale);
    })
    .toEqual([2, 1]);

  await page.getByLabel("Show aura display options").click();
  const options = page.getByRole("complementary", {
    name: "Aura display options",
  });
  const anchorSelect = options.getByLabel("Aura size anchor");
  await anchorSelect.selectOption({ label: "Aura 2" });
  await expect(
    page
      .getByRole("navigation", { name: "Aura placements" })
      .getByRole("button", { name: "Aura 2" }),
  ).toHaveAttribute("aria-pressed", "true");
  await anchorSelect.selectOption({
    label: "Arched aura 1",
  });
  await expect(
    page
      .getByRole("navigation", { name: "Aura placements" })
      .getByRole("button", { name: "Arched aura 1" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    options.getByRole("button", { name: "Arc (1)" }),
  ).toHaveAttribute("aria-pressed", "true");
  await options.getByRole("button", { name: "All types (2)" }).click();
  await options
    .getByRole("button", {
      name: "Resize all auras to match the size anchor",
    })
    .click();

  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);

      const placements = calls.profileUpdates.at(-1)?.overlayPlacements;

      return {
        anchorScale: placements?.[0]?.scale,
        targetHeight: placements?.[1]?.height,
        targetReferenceHeight: placements?.[1]?.referenceHeight,
        targetReferenceWidth: placements?.[1]?.referenceWidth,
        targetScale: placements?.[1]?.scale,
        targetWidth: placements?.[1]?.width,
      };
    })
    .toEqual({
      anchorScale: 2,
      targetHeight: 360,
      targetReferenceHeight: 1080,
      targetReferenceWidth: 1920,
      targetScale: 1,
      targetWidth: 440,
    });
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.keyboard.press("Control+z");
  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);
      const placements = calls.profileUpdates.at(-1)?.overlayPlacements;

      return {
        anchorScale: placements?.[0]?.scale,
        targetHeight: placements?.[1]?.height,
        targetScale: placements?.[1]?.scale,
        targetWidth: placements?.[1]?.width,
      };
    })
    .toEqual({
      anchorScale: 2,
      targetHeight: undefined,
      targetScale: 1,
      targetWidth: undefined,
    });

  await page.keyboard.press("Control+y");
  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);
      const placements = calls.profileUpdates.at(-1)?.overlayPlacements;

      return {
        anchorScale: placements?.[0]?.scale,
        targetHeight: placements?.[1]?.height,
        targetScale: placements?.[1]?.scale,
        targetWidth: placements?.[1]?.width,
      };
    })
    .toEqual({
      anchorScale: 2,
      targetHeight: 360,
      targetScale: 1,
      targetWidth: 440,
    });
});

test("hides aura labels and focused options from display preferences", async ({
  page,
}) => {
  await setupAuraOverlayE2E(page, { withArchedAura: true });
  await page
    .getByRole("navigation", { name: "Aura placements" })
    .getByRole("button", { name: "Arched aura 1" })
    .click();
  await expect(page.locator("[data-aura-label]")).toBeVisible();
  await expect(page.locator("[data-aura-properties-panel]")).toBeVisible();

  await page.getByLabel("Show aura display options").click();
  const options = page.getByRole("complementary", {
    name: "Aura display options",
  });
  await options.getByRole("checkbox", { name: "Hide all aura labels" }).check();
  await options
    .getByRole("checkbox", {
      name: "Hide per-aura options when focused",
    })
    .check();

  await expect(page.locator("[data-aura-label]")).toBeHidden();
  await expect(page.locator("[data-aura-properties-panel]")).toBeHidden();
  await expect(page.getByLabel("3 active options")).toHaveText("3");
  await expect
    .poll(async () => (await getAuraOverlayE2ECalls(page)).settingsUpdates)
    .toEqual([
      { auraOverlayHideLabels: true },
      { auraOverlayHidePropertiesPanel: true },
    ]);
});

test("keeps focused aura options inside the viewport near an edge", async ({
  page,
}) => {
  await setupAuraOverlayE2E(page, { withArchedAura: true });
  await page
    .getByRole("navigation", { name: "Aura placements" })
    .getByRole("button", { name: "Arched aura 1" })
    .click();
  const aura = page
    .locator('button[data-placement-id="placement-arc-1"]')
    .first();
  const auraBounds = await aura.boundingBox();
  expect(auraBounds).not.toBeNull();
  if (!auraBounds) {
    return;
  }

  await page.mouse.move(
    auraBounds.x + auraBounds.width / 2,
    auraBounds.y + auraBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(1260, 740);
  await page.mouse.up();

  const propertiesPanel = page.locator("[data-aura-properties-panel]");
  await expect(propertiesPanel).toBeVisible();
  await expect
    .poll(async () => {
      const bounds = await propertiesPanel.boundingBox();

      return bounds
        ? {
            bottom: bounds.y + bounds.height <= 752,
            left: bounds.x >= 8,
            right: bounds.x + bounds.width <= 1272,
            top: bounds.y >= 8,
          }
        : null;
    })
    .toEqual({ bottom: true, left: true, right: true, top: true });
});

test("adds a pointer aura through the overlay workflow", async ({ page }) => {
  await setupAuraOverlayE2E(page);

  await page.getByRole("button", { name: "Add pointer aura" }).click();

  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);

      return calls.selectCropRegionCalls;
    })
    .toEqual([{ shape: "points" }]);
  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);
      const update = calls.profileUpdates.at(-1);
      const crop = update?.cropRegions?.at(-1);
      const placement = update?.overlayPlacements?.at(-1);

      return {
        cropLabel: crop?.label,
        cropShape: crop?.shape,
        placementCount: update?.overlayPlacements?.length,
        pointCount: crop?.points?.length,
        pointGap: placement?.pointGap,
        pointSampleSize: placement?.pointSampleSize,
      };
    })
    .toEqual({
      cropLabel: "Pointer aura 1",
      cropShape: "points",
      placementCount: 1,
      pointCount: 3,
      pointGap: 20,
      pointSampleSize: 20,
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

  const auraFrame = page
    .locator('div[data-placement-id="placement-arc-1"]')
    .first();
  await expect(auraFrame).toHaveCSS("width", "220px");
  await expect(auraFrame).toHaveCSS("height", "180px");
  await page.getByRole("button", { name: "Rotate 0deg" }).click();
  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);

      return calls.profileUpdates.at(-1)?.overlayPlacements?.at(-1)
        ?.rotationDegrees;
    })
    .toBe(90);
  await expect(auraFrame).toHaveCSS("left", "870px");
  await expect(auraFrame).toHaveCSS("top", "430px");
  await expect(auraFrame).toHaveCSS("width", "180px");
  await expect(auraFrame).toHaveCSS("height", "220px");

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

  const propertiesPanel = page.getByRole("region", {
    name: "Aura placement properties",
  });
  const propertiesToggle = page.getByLabel(
    "Collapse or expand aura properties",
  );
  const toggleBox = await propertiesToggle.boundingBox();
  const chevronBox = await propertiesToggle.locator("svg").boundingBox();
  expect(toggleBox).not.toBeNull();
  expect(chevronBox).not.toBeNull();
  expect(
    Math.abs(
      (toggleBox?.x ?? 0) +
        (toggleBox?.width ?? 0) / 2 -
        ((chevronBox?.x ?? 0) + (chevronBox?.width ?? 0) / 2),
    ),
  ).toBeLessThan(1);
  expect(
    Math.abs(
      (toggleBox?.y ?? 0) +
        (toggleBox?.height ?? 0) / 2 -
        ((chevronBox?.y ?? 0) + (chevronBox?.height ?? 0) / 2),
    ),
  ).toBeLessThan(1);
  await propertiesToggle.click();
  await expect(propertiesPanel).not.toHaveAttribute("open", "");
  await expect
    .poll(async () =>
      propertiesPanel.evaluate((panel) => panel.getBoundingClientRect().width),
    )
    .toBe(28);
  const collapsedPanelBox = await propertiesPanel.boundingBox();
  const collapsedToggleBox = await propertiesToggle.boundingBox();
  expect(
    Math.abs(
      (collapsedPanelBox?.x ?? 0) +
        (collapsedPanelBox?.width ?? 0) / 2 -
        ((collapsedToggleBox?.x ?? 0) + (collapsedToggleBox?.width ?? 0) / 2),
    ),
  ).toBeLessThan(1);
  expect(
    Math.abs(
      (collapsedPanelBox?.y ?? 0) +
        (collapsedPanelBox?.height ?? 0) / 2 -
        ((collapsedToggleBox?.y ?? 0) + (collapsedToggleBox?.height ?? 0) / 2),
    ),
  ).toBeLessThan(1);
  await expect(page.getByLabel("Scale")).toBeHidden();
  await propertiesToggle.click();
  await expect(propertiesPanel).toHaveAttribute("open", "");
  await expect(page.getByLabel("Scale")).toBeVisible();

  const auraLabel = page
    .locator('[data-placement-id="placement-arc-1"] > span')
    .filter({ hasText: "Arched aura 1" });
  await expect
    .poll(async () =>
      auraLabel.evaluate((label) => getComputedStyle(label).whiteSpace),
    )
    .toBe("nowrap");
});

test("uses the persisted active game source for global aura profiles", async ({
  page,
}) => {
  await setupAuraOverlayE2E(page, {
    captureSources: [
      {
        available: true,
        displayId: null,
        game: "poe2",
        height: 1080,
        id: "window:poe2:game",
        kind: "window",
        name: "Path of Exile 2",
        thumbnailDataUrl: null,
        width: 1920,
      },
    ],
    noCaptureTarget: true,
    withArchedAura: true,
  });

  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);

      return calls.preparedDisplayMediaSourceIds.at(-1);
    })
    .toBe("window:poe2:game");
});

test("keeps the aura overlay document transparent", async ({ page }) => {
  await setupAuraOverlayE2E(page, { withArchedAura: true });

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const root = document.getElementById("root");
        const overlay = document.querySelector<HTMLElement>(
          '[aria-label="Aura overlay"]',
        );

        return {
          body: getComputedStyle(document.body).backgroundColor,
          html: getComputedStyle(document.documentElement).backgroundColor,
          overlay: overlay ? getComputedStyle(overlay).backgroundColor : null,
          root: root ? getComputedStyle(root).backgroundColor : null,
        };
      }),
    )
    .toEqual({
      body: "rgba(0, 0, 0, 0)",
      html: "rgba(0, 0, 0, 0)",
      overlay: "rgba(0, 0, 0, 0)",
      root: "rgba(0, 0, 0, 0)",
    });
});

test("shows aura controls help above selected aura controls", async ({
  page,
}) => {
  await setupAuraOverlayE2E(page, {
    overlapHelpWithArchedAura: true,
    withArchedAura: true,
  });

  await page
    .getByRole("navigation", { name: "Aura placements" })
    .getByRole("button", { name: "Arched aura 1" })
    .click();
  await page.getByLabel("Show aura controls help").click();

  const helpPanel = page.getByLabel("Aura overlay controls");
  await expect(helpPanel).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Aura placement properties" }),
  ).toBeVisible();

  await expect
    .poll(async () =>
      helpPanel.evaluate((panel) => {
        const bounds = panel.getBoundingClientRect();
        const elementAtPanelCenter = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        );

        return panel.contains(elementAtPanelCenter);
      }),
    )
    .toBe(true);
});
