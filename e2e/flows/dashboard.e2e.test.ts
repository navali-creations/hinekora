import { expect, type Locator, type Page, test } from "@playwright/test";

import type { PoeProcessState } from "../../main/modules/poe-process/PoeProcess.dto";
import type { CapturePreviewSource, GameId } from "../../types";
import {
  emitDashboardAuraLockChanged,
  emitDashboardPoeProcessStart,
  emitDashboardPoeProcessStop,
  emitDashboardRecorderOverlayVisibility,
  expectNoUnexpectedDashboardBridgeCalls,
  getDashboardE2ECalls,
  scheduleDashboardCaptureSources,
  setDashboardCaptureSources,
  setupDashboardE2E,
} from "../helpers/dashboard-fixture";

const dashboardScreenSource: CapturePreviewSource = {
  displayId: "1",
  height: 1440,
  id: "screen:1:0",
  kind: "screen",
  name: "Screen 1 (Display Model)",
  thumbnailDataUrl: null,
  width: 2560,
};

interface ProcessVariantCase {
  game: GameId;
  name: string;
  processName: string;
  source: CapturePreviewSource;
}

const processVariantCases: ProcessVariantCase[] = [
  {
    game: "poe1",
    name: "Path of Exile 1 Steam",
    processName: "PathOfExileSteam.exe",
    source: {
      displayId: null,
      height: 1440,
      id: "window:poe1-steam:1",
      kind: "window",
      game: "poe1",
      name: "Path of Exile 1",
      thumbnailDataUrl: null,
      width: 2560,
    },
  },
  {
    game: "poe1",
    name: "Path of Exile 1 standalone",
    processName: "PathOfExile.exe",
    source: {
      displayId: null,
      height: 1440,
      id: "window:poe1-standalone:1",
      kind: "window",
      game: "poe1",
      name: "Path of Exile 1",
      thumbnailDataUrl: null,
      width: 2560,
    },
  },
  {
    game: "poe2",
    name: "Path of Exile 2 Steam",
    processName: "PathOfExileSteam.exe",
    source: {
      displayId: null,
      height: 1440,
      id: "window:poe2-steam:1",
      kind: "window",
      game: "poe2",
      name: "Path of Exile 2",
      thumbnailDataUrl: null,
      width: 2560,
    },
  },
  {
    game: "poe2",
    name: "Path of Exile 2 standalone",
    processName: "PathOfExile.exe",
    source: {
      displayId: null,
      height: 1440,
      id: "window:poe2-standalone:1",
      kind: "window",
      game: "poe2",
      name: "Path of Exile 2",
      thumbnailDataUrl: null,
      width: 2560,
    },
  },
];

function createPoeProcessState(
  input: Pick<ProcessVariantCase, "game" | "processName">,
): PoeProcessState {
  return {
    game: input.game,
    isRunning: true,
    pid: input.game === "poe2" ? 4242 : 4241,
    processName: input.processName,
    windowTitle: input.game === "poe2" ? "Path of Exile 2" : "Path of Exile",
  };
}

async function openLivePreviewSourceSelect(sourceSelect: Locator) {
  await sourceSelect.click();

  return sourceSelect.locator("option").evaluateAll((options) =>
    options.map((option) => ({
      label: option.textContent?.trim() ?? "",
      value: (option as HTMLOptionElement).value,
    })),
  );
}

async function unlockCaptureProfile(page: Page): Promise<void> {
  const settingsPanel = page.locator('[data-onboarding="capture-settings"]');
  const unlockedChip = settingsPanel
    .getByRole("button", { name: "Lock capture profile" })
    .filter({ hasText: "Unlocked" });
  if (await unlockedChip.isVisible()) {
    return;
  }

  const unlockChip = settingsPanel
    .getByRole("button", { name: "Unlock capture profile" })
    .filter({ hasText: "Locked" });

  await expect(unlockChip).toBeVisible();
  await unlockChip.click();
  await expect(
    settingsPanel
      .getByRole("button", { name: "Lock capture profile" })
      .filter({ hasText: "Unlocked" }),
  ).toBeVisible();
}

test.afterEach(async ({ page }) => {
  await expectNoUnexpectedDashboardBridgeCalls(page);
});

test("prevents Live Preview refresh loops and covers source preview controls", async ({
  page,
}) => {
  await setupDashboardE2E(page);

  const sourceSelect = page.getByRole("combobox", {
    name: /^Capture source$/,
  });
  await expect(sourceSelect).toHaveValue("screen:1:0");
  await expect(sourceSelect).toBeDisabled();
  const sourceJoin = sourceSelect.locator("..");
  const sourceLockButton = sourceJoin.getByRole("button");
  await expect
    .poll(async () => {
      const [selectBorder, lockBorder] = await Promise.all([
        sourceSelect.evaluate(
          (element) => getComputedStyle(element).borderColor,
        ),
        sourceLockButton.evaluate(
          (element) => getComputedStyle(element).borderColor,
        ),
      ]);
      return selectBorder === lockBorder;
    })
    .toBe(true);
  await expect(page.getByText("Preview stopped")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByLabel("Capture preview")
        .locator("..")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(0, 0, 0)");

  const callsBeforeRefresh = await getDashboardE2ECalls(page);
  const sourceRequestCountBeforeRefresh =
    callsBeforeRefresh.captureSourceRequests.length;

  await page.getByRole("button", { exact: true, name: "Refresh" }).click();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return {
        duplicatePoeStateEmissions: calls.duplicatePoeStateEmissions,
        sourceRequestCount: calls.captureSourceRequests.length,
      };
    })
    .toEqual({
      duplicatePoeStateEmissions: 1,
      sourceRequestCount: sourceRequestCountBeforeRefresh + 1,
    });

  const callsAfterRefresh = await getDashboardE2ECalls(page);
  expect(callsAfterRefresh.captureSourceRequests).toHaveLength(
    sourceRequestCountBeforeRefresh + 1,
  );
  expect(callsAfterRefresh.captureSourceRequests.at(-1)).toBe(true);

  await unlockCaptureProfile(page);
  const updatesBeforeSourceChange = (await getDashboardE2ECalls(page))
    .captureProfileUpdates.length;
  await sourceSelect.selectOption("window:poe2:1");
  await expect(sourceSelect).toHaveValue("window:poe2:1");
  expect(
    (await getDashboardE2ECalls(page)).captureProfileUpdates.slice(
      updatesBeforeSourceChange,
    ),
  ).toEqual([
    expect.objectContaining({
      captureTarget: expect.objectContaining({
        game: "poe2",
        id: "window:poe2:1",
        kind: "window",
      }),
      id: "capture-profile-1",
    }),
  ]);

  await page.getByRole("button", { name: "Show Preview" }).click();
  await expect(
    page.getByRole("button", { name: "Stop Preview" }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.getUserMediaConstraints.length;
    })
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "Stop Preview" }).click();
  await expect(
    page.getByRole("button", { name: "Show Preview" }),
  ).toBeVisible();
});

test("covers unavailable PoE live preview sources and auto-start alerts", async ({
  page,
}) => {
  await setupDashboardE2E(page);

  await setDashboardCaptureSources(page, [dashboardScreenSource]);
  await page.getByRole("button", { exact: true, name: "Refresh" }).click();

  const sourceSelect = page.getByRole("combobox", {
    name: /^Capture source$/,
  });
  await unlockCaptureProfile(page);
  await expect
    .poll(async () => openLivePreviewSourceSelect(sourceSelect))
    .toContainEqual({
      label: "Path of Exile 2 (not running)",
      value: "missing-window:poe2",
    });

  await sourceSelect.selectOption("missing-window:poe2");
  await expect(
    page.getByText("Path of Exile 2 is currently unavailable."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show Preview" }),
  ).toBeDisabled();
  await expect(sourceSelect).toHaveValue("missing-window:poe2");
  expect(
    (await getDashboardE2ECalls(page)).captureProfileUpdates,
  ).toContainEqual(
    expect.objectContaining({
      captureTarget: expect.objectContaining({
        game: "poe2",
        id: "missing-window:poe2",
        kind: "window",
      }),
      id: "capture-profile-1",
    }),
  );

  const recordingSettingsTabs = page.getByRole("tablist", {
    name: "Recording settings",
  });
  await recordingSettingsTabs.getByRole("tab", { name: "Rewind" }).click();
  await page.getByRole("button", { name: "Use 1080p preview quality" }).click();
  await expect
    .poll(async () => (await getDashboardE2ECalls(page)).settingsUpdates)
    .toContainEqual({ replayClipPreviewResolution: "1080p" });
  await page.getByLabel("Start rewind automatically").check();
  await expect(
    page.getByText(
      "Automatic rewind will continue once Path of Exile 2 is running",
    ),
  ).toBeVisible();

  const poe2Variant = processVariantCases.find(
    (processVariant) => processVariant.game === "poe2",
  )!;
  await setDashboardCaptureSources(page, [
    dashboardScreenSource,
    poe2Variant.source,
  ]);
  await emitDashboardPoeProcessStart(page, createPoeProcessState(poe2Variant));

  await expect(sourceSelect).toHaveValue(poe2Variant.source.id);
  await expect(
    page.getByText(
      "Automatic rewind will continue once Path of Exile 2 is running",
    ),
  ).toBeHidden();
});

test("updates appbar and live preview sources for PoE process variants", async ({
  page,
}) => {
  await setupDashboardE2E(page);

  const sourceSelect = page.getByRole("combobox", {
    name: /^Capture source$/,
  });
  const poe1Button = page.getByRole("button", { name: /Path of Exile 1/ });
  const poe2Button = page.getByRole("button", { name: /Path of Exile 2/ });

  await unlockCaptureProfile(page);
  await setDashboardCaptureSources(page, [dashboardScreenSource]);
  await emitDashboardPoeProcessStop(page);
  await expect(poe1Button).toContainText("Offline");
  await expect(poe2Button).toContainText("Offline");

  for (const processVariant of processVariantCases) {
    await setDashboardCaptureSources(page, [
      dashboardScreenSource,
      processVariant.source,
    ]);
    const callsBeforeStart = await getDashboardE2ECalls(page);
    const requestCountBeforeStart =
      callsBeforeStart.captureSourceRequests.length;

    await emitDashboardPoeProcessStart(
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
    await expect
      .poll(async () => {
        const calls = await getDashboardE2ECalls(page);

        return {
          refreshed:
            calls.captureSourceRequests.length > requestCountBeforeStart,
          requestedForceRefresh: calls.captureSourceRequests.at(-1),
        };
      })
      .toEqual({
        refreshed: true,
        requestedForceRefresh: true,
      });
    const expectedSourceOptions = [
      {
        label: dashboardScreenSource.name,
        value: dashboardScreenSource.id,
      },
      {
        label: processVariant.source.name,
        value: processVariant.source.id,
      },
    ];
    expectedSourceOptions.push(
      processVariant.game === "poe1"
        ? {
            label: "Path of Exile 2 (not running)",
            value: "missing-window:poe2",
          }
        : {
            label: "Path of Exile 1 (not running)",
            value: "missing-window:poe1",
          },
    );

    await expect
      .poll(() => openLivePreviewSourceSelect(sourceSelect))
      .toEqual(expectedSourceOptions);
    await (processVariant.game === "poe1" ? poe1Button : poe2Button).click();
    await expect(
      sourceSelect.locator(`option[value="${processVariant.source.id}"]`),
    ).toBeEnabled();
    await sourceSelect.selectOption(processVariant.source.id);
    await expect(sourceSelect).toHaveValue(processVariant.source.id);

    await setDashboardCaptureSources(page, [dashboardScreenSource]);
    await emitDashboardPoeProcessStop(page);
    await expect(poe1Button).toContainText("Offline");
    await expect(poe2Button).toContainText("Offline");
  }
});

test("retries live preview source refresh when the game window appears after process start", async ({
  page,
}) => {
  await setupDashboardE2E(page);

  const sourceSelect = page.getByRole("combobox", {
    name: /^Capture source$/,
  });
  const poe2Button = page.getByRole("button", { name: /Path of Exile 2/ });
  const poe2Source = processVariantCases.find(
    (processVariant) => processVariant.name === "Path of Exile 2 Steam",
  )?.source;
  if (!poe2Source) {
    throw new Error("PoE2 source fixture missing");
  }

  await unlockCaptureProfile(page);
  await setDashboardCaptureSources(page, [dashboardScreenSource]);
  await emitDashboardPoeProcessStop(page);
  await expect(poe2Button).toContainText("Offline");
  const callsBeforeStart = await getDashboardE2ECalls(page);
  const requestCountBeforeStart = callsBeforeStart.captureSourceRequests.length;
  const responseCountBeforeStart =
    callsBeforeStart.captureSourceResponses.length;

  await scheduleDashboardCaptureSources(
    page,
    [dashboardScreenSource, poe2Source],
    1_000,
  );
  await emitDashboardPoeProcessStart(
    page,
    createPoeProcessState({
      game: "poe2",
      processName: "PathOfExileSteam.exe",
    }),
  );

  await expect(poe2Button).toContainText("Running");
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.captureSourceResponses.slice(responseCountBeforeStart);
    })
    .toEqual([
      [dashboardScreenSource.id],
      [dashboardScreenSource.id, poe2Source.id],
    ]);
  const callsAfterRetry = await getDashboardE2ECalls(page);
  expect(callsAfterRetry.captureSourceRequests).toHaveLength(
    requestCountBeforeStart + 2,
  );
  await expect
    .poll(() => openLivePreviewSourceSelect(sourceSelect))
    .toEqual([
      {
        label: dashboardScreenSource.name,
        value: dashboardScreenSource.id,
      },
      {
        label: poe2Source.name,
        value: poe2Source.id,
      },
      {
        label: "Path of Exile 1 (not running)",
        value: "missing-window:poe1",
      },
    ]);
});

test("covers recorder mode, capture settings, and audio settings interactions", async ({
  page,
}) => {
  await setupDashboardE2E(page);

  await expect(
    page.getByRole("heading", { exact: true, name: "Settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Capture Settings" }),
  ).toBeVisible();
  await expect(
    page.getByText("Settings are saved locally; set them once."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Audio Settings" }),
  ).toBeHidden();

  const captureModeGroup = page.getByRole("radiogroup", {
    name: "Capture mode",
  });
  const recordingSettingsTabs = page.getByRole("tablist", {
    name: "Recording settings",
  });
  const captureProfileSelect = page.getByRole("combobox", {
    name: "Capture profile",
  });
  const sourceSelect = page.getByRole("combobox", {
    name: /^Capture source$/,
  });
  const settingsPanel = page.locator('[data-onboarding="capture-settings"]');
  const inactiveGameButton = page.getByRole("button", {
    name: /Path of Exile 1/,
  });

  const sessionOption = captureModeGroup.getByRole("radio", {
    name: "Session Recording",
  });
  const rewindOption = captureModeGroup.getByRole("radio", { name: "Rewind" });
  await expect
    .poll(async () => {
      const [containerBox, sessionBox, rewindBox] = await Promise.all([
        captureModeGroup.boundingBox(),
        sessionOption.boundingBox(),
        rewindOption.boundingBox(),
      ]);
      if (!containerBox || !sessionBox || !rewindBox) {
        return false;
      }
      return containerBox.width <= sessionBox.width + rewindBox.width + 10;
    })
    .toBe(true);
  await expect
    .poll(async () => {
      const active = await rewindOption.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      const inactive = await sessionOption.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      return active !== inactive;
    })
    .toBe(true);
  await expect
    .poll(async () => {
      const box = await page
        .getByRole("button", { exact: true, name: "Start" })
        .boundingBox();
      return box?.height ?? Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(36);

  await unlockCaptureProfile(page);
  await sessionOption.click();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.captureModeChanges.at(-1);
    })
    .toBe("session");
  await expect(page.getByText("Session Recording selected.")).toBeVisible();

  await page.getByRole("button", { exact: true, name: "Start" }).click();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.startRunRecordingCount;
    })
    .toBe(1);
  await expect(captureProfileSelect).toBeDisabled();
  await expect(sourceSelect).toBeDisabled();
  await expect(
    settingsPanel
      .getByRole("button", { name: "Unlock capture profile" })
      .filter({ hasText: "Locked" }),
  ).toBeDisabled();
  await expect(inactiveGameButton).toBeDisabled();
  await page.getByRole("button", { name: "Stop & Save Recording" }).click();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.stopRunRecordingCount;
    })
    .toBe(1);

  await rewindOption.click();
  await page.getByRole("button", { exact: true, name: "Start" }).click();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.startBufferCount;
    })
    .toBe(1);
  await expect(captureProfileSelect).toBeDisabled();
  await expect(sourceSelect).toBeDisabled();
  await expect(inactiveGameButton).toBeDisabled();
  await page.getByRole("button", { name: "Disable Rewind" }).click();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.stopBufferCount;
    })
    .toBe(1);

  await unlockCaptureProfile(page);
  await page
    .getByRole("combobox", { name: /^Resolution/ })
    .selectOption("1920x1080");
  await page.getByRole("button", { name: "30 FPS" }).click();
  await page
    .getByRole("combobox", { name: /^Video encoder/ })
    .selectOption("hardware_h265");
  await page
    .getByRole("combobox", { name: /^Recording quality/ })
    .selectOption("ultra");
  await page
    .getByRole("combobox", { name: /^Clip quality/ })
    .selectOption("low");
  await recordingSettingsTabs.getByRole("tab", { name: "Recording" }).click();
  await expect(
    page.getByRole("heading", { name: "Recording Settings" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Hide Hinekora overlays from recording"),
  ).toBeChecked();
  await expect(
    page.getByLabel("Start recording automatically"),
  ).not.toBeChecked();
  await page.getByLabel("Start recording automatically").check();
  await page.getByLabel("Hide Hinekora overlays from recording").uncheck();
  await recordingSettingsTabs.getByRole("tab", { name: "Rewind" }).click();
  await expect(
    page.getByRole("heading", { name: "Rewind Settings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "45" }).click();
  await expect(page.getByLabel("Start rewind automatically")).not.toBeChecked();
  await page.getByLabel("Start rewind automatically").check();
  await expect(
    page.getByLabel("Hide Hinekora overlays from rewind"),
  ).toBeChecked();
  await page.getByLabel("Hide Hinekora overlays from rewind").uncheck();
  await recordingSettingsTabs.getByRole("tab", { name: "Audio" }).click();
  await expect(
    page.getByRole("heading", { name: "Audio Settings" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: /^Audio input/ })
    .selectOption("device:0");
  await page
    .getByRole("combobox", { name: /^Audio output/ })
    .selectOption("device:0");
  await page.getByRole("button", { name: "Refresh audio devices" }).click();

  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.settingsUpdates;
    })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recordingOutputResolution: "1920x1080" }),
        expect.objectContaining({ recordingFps: 30 }),
        expect.objectContaining({ recordingEncoder: "hardware_h265" }),
        expect.objectContaining({ recordingRunQuality: "ultra" }),
        expect.objectContaining({ recordingClipQuality: "low" }),
        expect.objectContaining({ recordingAutoStartMode: "recording" }),
        expect.objectContaining({ recordingAutoStartMode: "rewind" }),
        expect.objectContaining({ deathClipSeconds: 45 }),
        expect.objectContaining({ recordingHideOverlaysFromRecording: false }),
        expect.objectContaining({ recordingHideOverlaysFromRewind: false }),
        expect.objectContaining({ recordingAudioInputDeviceId: "{mic-1}" }),
        expect.objectContaining({
          recordingAudioOutputDeviceId: "{speakers-1}",
        }),
      ]),
    );
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.audioDeviceRequests.at(-1);
    })
    .toEqual({ forceRefresh: true });
});

test("covers keybind settings keyboard recording", async ({ page }) => {
  await setupDashboardE2E(page);
  await page.goto("/#/settings?tab=keybinds");

  await expect(
    page.getByRole("heading", { exact: true, name: "Settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { exact: true, name: "Keybinds" }),
  ).toBeVisible();
  await expect(page.getByText("ALT + B")).toBeVisible();
  await expect(page.getByText("ALT + C")).toBeVisible();

  await page.getByRole("button", { name: "Edit Keybind" }).first().click();
  await page.keyboard.press("Alt+M");
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.settingsUpdates;
    })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keybindManualBookmark: "Alt+M" }),
      ]),
    );

  await page.getByRole("button", { name: "Edit Keybind" }).first().click();
  const recordingPrompt = page.getByText("Press key");
  await expect(recordingPrompt).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        button: 3,
      }),
    );
  });
  await expect(recordingPrompt).toBeVisible();
  expect((await getDashboardE2ECalls(page)).settingsUpdates).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ keybindManualBookmark: "Mouse4" }),
    ]),
  );
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(recordingPrompt).not.toBeVisible();
});

test("keeps content-width tabs on one horizontally scrollable row", async ({
  page,
}) => {
  await setupDashboardE2E(page, {
    initialHash: "/#/settings?tab=keybinds",
    skipDashboardShellChecks: true,
  });

  const settingsTabs = page.getByRole("tablist", {
    name: "Settings sections",
  });
  await expect(settingsTabs).toBeVisible();

  const layout = await settingsTabs.evaluate((element) => {
    element.style.maxWidth = "320px";
    element.style.width = "320px";
    const tabs = Array.from(
      element.querySelectorAll<HTMLElement>('[role="tab"]'),
    );

    return {
      clientWidth: element.clientWidth,
      rowOffsets: [...new Set(tabs.map((tab) => tab.offsetTop))],
      scrollWidth: element.scrollWidth,
    };
  });

  expect(layout.rowOffsets).toHaveLength(1);
  expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth);
});

test("shows and copies the pseudonymous user ID from privacy settings", async ({
  page,
}) => {
  await setupDashboardE2E(page, {
    initialHash: "/#/settings?tab=privacy",
    skipDashboardShellChecks: true,
  });

  const userIdInput = page.getByRole("textbox", {
    name: "Pseudonymous user ID",
  });
  await expect(userIdInput).toHaveAttribute("type", "password");
  await expect(userIdInput).toHaveValue("3f886c8b-18cf-4a48-8cdd-6a51cd44c6d5");

  await page.getByRole("button", { name: "Copy pseudonymous user ID" }).click();
  await expect(page.getByRole("status")).toHaveText("User ID copied.");
  await expect
    .poll(async () => (await getDashboardE2ECalls(page)).clipboardWrites)
    .toEqual(["3f886c8b-18cf-4a48-8cdd-6a51cd44c6d5"]);
});

test("restores clips view and media league across library routes", async ({
  page,
}) => {
  await setupDashboardE2E(page);

  await page.getByRole("link", { name: "Clips" }).click();
  await page.getByRole("tab", { name: "Manual Replays" }).click();
  await page.getByLabel("Library league").selectOption("Standard");

  for (const route of ["Recordings", "Rewinds", "Bookmarks", "Saved Edits"]) {
    await page.getByRole("link", { name: route, exact: true }).click();
    await expect(page.getByLabel("Library league")).toHaveValue("Standard");
  }

  await page.getByRole("link", { name: "Clips" }).click();
  await expect(
    page.getByRole("tab", { name: "Manual Replays" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Library league")).toHaveValue("Standard");

  await page.getByLabel("Library league").selectOption("__all__");
  await page.getByRole("button", { name: /Path of Exile 1/ }).click();
  await expect(page.getByLabel("Library league")).toHaveValue("Mirage");
  await page.getByLabel("Library league").selectOption("Standard");
  await page.getByRole("button", { name: /Path of Exile 2/ }).click();
  await expect(page.getByLabel("Library league")).toHaveValue("__all__");

  await expect
    .poll(async () => (await getDashboardE2ECalls(page)).settingsUpdates)
    .toEqual(
      expect.arrayContaining([
        { clipsLibraryView: "manual" },
        { poe1MediaLibraryLeague: "Standard" },
        { poe2MediaLibraryLeague: "__all__" },
        { poe2MediaLibraryLeague: "Standard" },
      ]),
    );
});

test("covers dashboard app shell game, overlay, and window controls", async ({
  page,
}) => {
  await setupDashboardE2E(page);

  await page.getByRole("button", { name: /Path of Exile 1/ }).click();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.clientLogActiveGames.at(-1);
    })
    .toEqual({ game: "poe1" });
  await expect(page.getByLabel("poe1 league")).toHaveValue("Mirage");
  await page.getByLabel("poe1 league").selectOption("Standard");
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

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
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.recorderOverlayToggles;
    })
    .toBe(1);
  await expect(page.getByTitle("Hide Overlay")).toBeVisible();

  await page.getByTitle("Minimize").click();
  await page.getByTitle("Maximize").click();
  await page.getByTitle("Restore").click();
  await page.getByTitle("Close").click();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.mainWindowActions;
    })
    .toEqual(["minimize", "maximize", "unmaximize", "close"]);
});

test("reflects startup and focus-gate recorder overlay visibility from main", async ({
  page,
}) => {
  await setupDashboardE2E(page, { recorderOverlayVisible: true });

  await expect(page.getByTitle("Hide Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await emitDashboardRecorderOverlayVisibility(page, false);
  await expect(page.getByTitle("Show Overlay")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await emitDashboardRecorderOverlayVisibility(page, true);
  await expect(page.getByTitle("Hide Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.recorderVisibilityEvents;
    })
    .toEqual([false, true]);
});

test("keeps recorder overlay control stable during aura lock bridge events", async ({
  page,
}) => {
  await setupDashboardE2E(page, {
    auraLocked: true,
    recorderOverlayVisible: true,
  });

  await expect(page.getByTitle("Hide Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await emitDashboardAuraLockChanged(page, false);
  await expect(page.getByTitle("Hide Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

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
