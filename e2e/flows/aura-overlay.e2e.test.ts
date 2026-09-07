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
  const overlay = page.getByRole("application", { name: "Aura overlay" });
  await expect(overlay).toHaveClass(/auraSelectionGrid/);
  await expect(overlay).toHaveCSS("background-image", /linear-gradient/);
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
  await expect(overlay).toHaveClass(/auraSelectionGrid/);
  await expect(overlay).toHaveCSS("background-image", /linear-gradient/);
  await expect(page.locator('[data-aura-center-guide="x"]')).toBeVisible();
  await expect(page.locator('[data-aura-center-guide="y"]')).toBeVisible();
  await expect(page.getByLabel("3 active options")).toHaveText("3");
});

test("area-selects and moves multiple auras together", async ({ page }) => {
  await setupAuraOverlayE2E(page, { withArchedAura: true });
  await page.getByRole("button", { name: "Add new aura" }).click();
  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);
      return calls.profileUpdates.at(-1)?.overlayPlacements?.length;
    })
    .toBe(2);

  const beforeMove = await getAuraOverlayE2ECalls(page).then(
    (calls) => calls.profileUpdates.at(-1)?.overlayPlacements ?? [],
  );
  await page.mouse.move(40, 100);
  await page.mouse.down();
  await page.mouse.move(1_160, 700);
  await page.mouse.up();

  const selection = page.getByRole("button", { name: "2 auras selected" });
  await expect(selection).toBeVisible();
  const selectionBounds = await selection.boundingBox();
  expect(selectionBounds).not.toBeNull();
  await page.mouse.move(
    (selectionBounds?.x ?? 0) + 20,
    (selectionBounds?.y ?? 0) + 20,
  );
  await page.mouse.down();
  await page.mouse.move(
    (selectionBounds?.x ?? 0) + 60,
    (selectionBounds?.y ?? 0) + 45,
  );
  await page.mouse.up();

  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);
      return calls.profileUpdates
        .at(-1)
        ?.overlayPlacements?.map((placement, index) => ({
          deltaX: placement.x - (beforeMove[index]?.x ?? 0),
          deltaY: placement.y - (beforeMove[index]?.y ?? 0),
        }));
    })
    .toEqual([
      { deltaX: 40, deltaY: 25 },
      { deltaX: 40, deltaY: 25 },
    ]);
  await expect(selection).toBeVisible();

  await selection.click({ button: "right" });
  await expect(selection).toBeHidden();
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
  await expect(page.getByRole("tab", { name: "Aura" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Icon" })).toHaveCount(0);
});

test("applies visual shapes only to default auras", async ({ page }) => {
  await setupAuraOverlayE2E(page, { withArchedAura: true });

  await page
    .getByRole("navigation", { name: "Aura placements" })
    .getByRole("button", { name: "Arched aura 1" })
    .click();
  await expect(page.getByRole("tab", { name: "Aura" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Icon" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Aura shape" })).toHaveCount(0);

  await page.getByRole("button", { name: "Add new aura" }).click();
  const focusedAura = page
    .getByRole("navigation", { name: "Aura placements" })
    .getByRole("button", { name: "Aura 2" });
  await expect(focusedAura).toHaveAttribute("aria-pressed", "true");
  const placementId = await focusedAura.getAttribute("data-placement-id");
  expect(placementId).not.toBeNull();
  if (!placementId) {
    return;
  }

  const auraFrame = page
    .locator(`div[data-placement-id="${placementId}"]`)
    .first();
  const videoClip = auraFrame.locator('[class*="videoClip"]');
  await expect(page.getByRole("tab", { name: "Icon" })).toBeVisible();
  await page.getByRole("tab", { name: "Aura" }).click();
  await page.getByLabel("Aura outline").check();
  await page.getByRole("tab", { name: "Icon" }).click();
  const shapeControls = page.getByRole("group", { name: "Aura shape" });
  await expect(shapeControls).toBeVisible();
  await expect(
    shapeControls.getByRole("button", { name: "Use default aura shape" }),
  ).toHaveAttribute("aria-pressed", "true");
  await shapeControls
    .getByRole("button", { name: "Use shield aura shape" })
    .click();
  await expect(videoClip).toHaveCSS("clip-path", /polygon/);
  await expect(
    auraFrame.locator('[data-aura-shape-focus="shield"]'),
  ).toBeVisible();
  const effects = auraFrame.locator("[data-aura-effects]");
  await expect(effects).toHaveAttribute("data-effect-shape", "shield");
  await expect(effects.locator("polygon")).toHaveCount(1);
  await page.getByRole("tab", { name: "Aura" }).click();
  await expect(page.getByLabel("Round corners")).toHaveCount(0);
  await page.getByRole("tab", { name: "Icon" }).click();

  await shapeControls
    .getByRole("button", { name: "Use circle aura shape" })
    .click();
  await expect(videoClip).toHaveCSS("clip-path", /ellipse/);
  await expect(videoClip).toHaveCSS("border-radius", "50%");
  await expect(videoClip).toHaveCSS("overflow", "hidden");
  await expect(effects).toHaveAttribute("data-effect-shape", "circle");
  await expect(effects.locator("ellipse")).toHaveCount(1);
  await expect(
    auraFrame.locator('[data-aura-shape-focus="circle"]'),
  ).toBeVisible();
  const auraFrameBoundsBeforeZoom = await auraFrame.boundingBox();
  await expect(page.getByLabel("Icon zoom (%)")).toHaveAttribute("max", "200");
  const iconXInput = page.getByRole("spinbutton", {
    exact: true,
    name: "Offset X",
  });
  const iconYInput = page.getByRole("spinbutton", {
    exact: true,
    name: "Offset Y",
  });
  await iconXInput.fill("12");
  await iconXInput.press("Enter");
  await iconYInput.fill("-8");
  await iconYInput.press("Enter");
  await page.getByLabel("Icon zoom (%)").fill("160");
  await page.getByLabel("Icon zoom (%)").press("Enter");
  const auraFrameBoundsAfterZoom = await auraFrame.boundingBox();
  expect(auraFrameBoundsAfterZoom).toEqual(auraFrameBoundsBeforeZoom);
  await expect(auraFrame.locator("video")).toHaveCSS("width", "1920px");
  const videoContent = auraFrame.locator('[data-aura-content-zoom="160"]');
  await expect(videoContent).toHaveAttribute("data-aura-icon-x", "12");
  await expect(videoContent).toHaveAttribute("data-aura-icon-y", "-8");
  await expect(videoContent).toHaveCSS(
    "transform",
    "matrix(1.6, 0, 0, 1.6, 12, -8)",
  );
  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);

      const placement = calls.profileUpdates.at(-1)?.overlayPlacements?.at(-1);

      return {
        clipShape: placement?.clipShape,
        contentZoomPercent: placement?.contentZoomPercent,
        iconOffsetX: placement?.iconOffsetX,
        iconOffsetY: placement?.iconOffsetY,
      };
    })
    .toEqual({
      clipShape: "circle",
      contentZoomPercent: 160,
      iconOffsetX: 12,
      iconOffsetY: -8,
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
  await expect(page.getByRole("tab", { name: "Aura" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Icon" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Aura" }).click();
  const xInput = page.getByLabel("X", { exact: true });
  const yInput = page.getByLabel("Y", { exact: true });
  await expect(xInput).toHaveValue("0");
  await expect(yInput).toHaveValue("0");
  await xInput.fill("-10");
  await xInput.press("Enter");
  await yInput.fill("-10");
  await yInput.press("Enter");
  await expect(auraFrame).toHaveCSS("left", "840px");
  await expect(auraFrame).toHaveCSS("top", "460px");
  await xInput.fill("0");
  await xInput.press("Enter");
  await yInput.fill("0");
  await yInput.press("Enter");
  await page.getByRole("tab", { name: "General" }).click();
  await page.getByLabel("Width").fill("300");
  await page.getByLabel("Width").press("Enter");
  await expect(auraFrame).toHaveCSS("left", "850px");
  await page.getByLabel("Height").fill("220");
  await page.getByLabel("Height").press("Enter");
  await expect(auraFrame).toHaveCSS("top", "450px");
  await page.getByLabel("Width").fill("220");
  await page.getByLabel("Width").press("Enter");
  await expect(auraFrame).toHaveCSS("left", "850px");
  await page.getByLabel("Height").fill("180");
  await page.getByLabel("Height").press("Enter");
  await expect(auraFrame).toHaveCSS("top", "450px");
  await expect(page.getByRole("button", { name: "Rotate aura" })).toHaveText(
    "0 deg",
  );
  await page.getByRole("button", { name: "Rotate aura" }).click();
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

  await page.getByLabel("Width").fill("240");
  await page.getByLabel("Width").press("Enter");
  await expect(auraFrame).toHaveCSS("left", "870px");
  await expect(auraFrame).toHaveCSS("width", "240px");
  await page.getByLabel("Height").fill("260");
  await page.getByLabel("Height").press("Enter");
  await expect(auraFrame).toHaveCSS("top", "430px");
  await expect(auraFrame).toHaveCSS("height", "260px");
  await page.getByLabel("Width").fill("180");
  await page.getByLabel("Width").press("Enter");
  await expect(auraFrame).toHaveCSS("left", "870px");
  await page.getByLabel("Height").fill("220");
  await page.getByLabel("Height").press("Enter");
  await expect(auraFrame).toHaveCSS("top", "430px");

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

test("customizes and resets one aura's resize controls and effects", async ({
  page,
}) => {
  await setupAuraOverlayE2E(page, { withArchedAura: true });

  await page.getByRole("button", { name: "Add new aura" }).click();
  const focusedAura = page
    .getByRole("navigation", { name: "Aura placements" })
    .getByRole("button", { name: "Aura 2" });
  await expect(focusedAura).toHaveAttribute("aria-pressed", "true");
  const placementId = await focusedAura.getAttribute("data-placement-id");
  expect(placementId).not.toBeNull();
  if (!placementId) {
    return;
  }

  const auraFrame = page
    .locator(`div[data-placement-id="${placementId}"]`)
    .first();
  const auraButton = auraFrame.locator(
    `button[data-placement-id="${placementId}"]`,
  );
  await expect(auraButton.locator("[data-corner]")).toHaveCount(4);

  await page.getByLabel("Hide resize controls").check();
  await expect(auraButton.locator("[data-corner]")).toHaveCount(0);

  await page.getByRole("tab", { name: "Aura" }).click();
  const boundsBeforeCoordinateEdit = await auraFrame.boundingBox();
  expect(boundsBeforeCoordinateEdit).not.toBeNull();
  const xInput = page.getByLabel("X", { exact: true });
  const yInput = page.getByLabel("Y", { exact: true });
  const targetX = Number(await xInput.inputValue()) + 12;
  const targetY = Number(await yInput.inputValue()) - 8;
  await xInput.fill(String(targetX));
  await page.getByLabel("X", { exact: true }).press("Enter");
  await yInput.fill(String(targetY));
  await yInput.press("Enter");
  await expect
    .poll(async () => {
      const bounds = await auraFrame.boundingBox();
      return {
        x: Math.round(bounds?.x ?? Number.NaN),
        y: Math.round(bounds?.y ?? Number.NaN),
      };
    })
    .toEqual({
      x: Math.round(boundsBeforeCoordinateEdit?.x ?? 0) + 12,
      y: Math.round(boundsBeforeCoordinateEdit?.y ?? 0) + 8,
    });

  await page.getByLabel("Aura outline").check();
  await expect(page.getByLabel("Outline px")).toHaveValue("1");
  await page.getByLabel("Outline px").fill("3");
  await page.getByLabel("Outline px").press("Enter");
  const outlineColorInput = page.getByLabel("Outline color");
  await outlineColorInput.focus();
  await expect(auraFrame).toHaveCSS("z-index", "10");
  await expect(auraButton).toHaveCSS("box-shadow", "none");
  await outlineColorInput.fill("#123456");
  const effects = auraFrame.locator("[data-aura-effects]");
  await expect(effects).toHaveAttribute("data-effect-shape", "rect");
  await expect(effects.locator("rect")).toHaveCount(1);
  await expect(
    effects.locator('feFlood[data-effect="outline"]'),
  ).toHaveAttribute("flood-color", "#123456");

  await page.getByLabel("Aura shadow").check();
  await expect(page.getByLabel("Shadow spread")).toHaveValue("4");
  await page.getByLabel("Shadow spread").fill("6");
  await page.getByLabel("Shadow spread").press("Enter");
  await page.getByLabel("Shadow color").fill("#654321");
  await expect(
    effects.locator('feFlood[data-effect="shadow"]'),
  ).toHaveAttribute("flood-color", "#654321");

  await page.getByLabel("Round corners").check();
  await expect(page.getByLabel("Corner radius")).toHaveValue("4");
  await page.getByLabel("Corner radius").fill("5");
  await page.getByLabel("Corner radius").press("Enter");
  await expect(auraButton).toHaveCSS("border-radius", "5px");

  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);
      const placement = calls.profileUpdates.at(-1)?.overlayPlacements?.at(-1);

      return {
        cornerRadius: placement?.cornerRadius,
        hideResizeControls: placement?.hideResizeControls,
        outlineColor: placement?.outlineColor,
        outlineThickness: placement?.outlineThickness,
        shadowColor: placement?.shadowColor,
        shadowSpread: placement?.shadowSpread,
      };
    })
    .toEqual({
      cornerRadius: 5,
      hideResizeControls: true,
      outlineColor: "#123456",
      outlineThickness: 3,
      shadowColor: "#654321",
      shadowSpread: 6,
    });

  const boundsBeforeReset = await auraFrame.boundingBox();
  await page.getByRole("tab", { name: "General" }).click();
  const resetButton = page.getByRole("button", { name: "Reset to default" });
  await expect(resetButton).toHaveCSS("cursor", "pointer");
  const idleResetBorder = await resetButton.evaluate(
    (button) => getComputedStyle(button).borderColor,
  );
  await resetButton.hover();
  await expect
    .poll(() =>
      resetButton.evaluate((button) => getComputedStyle(button).borderColor),
    )
    .not.toBe(idleResetBorder);
  await resetButton.click();
  await expect(auraButton.locator("[data-corner]")).toHaveCount(4);
  await expect(effects).toHaveCount(0);
  const boundsAfterReset = await auraFrame.boundingBox();
  expect(boundsBeforeReset).not.toBeNull();
  expect(boundsAfterReset).not.toBeNull();
  expect(
    (boundsAfterReset?.x ?? 0) + (boundsAfterReset?.width ?? 0) / 2,
  ).toBeCloseTo(
    (boundsBeforeReset?.x ?? 0) + (boundsBeforeReset?.width ?? 0) / 2,
  );
  expect(
    (boundsAfterReset?.y ?? 0) + (boundsAfterReset?.height ?? 0) / 2,
  ).toBeCloseTo(
    (boundsBeforeReset?.y ?? 0) + (boundsBeforeReset?.height ?? 0) / 2,
  );
  await expect
    .poll(async () => {
      const calls = await getAuraOverlayE2ECalls(page);
      const placement = calls.profileUpdates.at(-1)?.overlayPlacements?.at(-1);

      return {
        cornerRadius: placement?.cornerRadius,
        hideResizeControls: placement?.hideResizeControls,
        opacity: placement?.opacity,
        outlineThickness: placement?.outlineThickness,
        scale: placement?.scale,
        shadowSpread: placement?.shadowSpread,
      };
    })
    .toEqual({
      cornerRadius: undefined,
      hideResizeControls: undefined,
      opacity: 1,
      outlineThickness: undefined,
      scale: 1,
      shadowSpread: undefined,
    });
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
