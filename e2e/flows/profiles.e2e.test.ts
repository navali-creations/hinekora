import { expect, type Locator, type Page, test } from "@playwright/test";

import type { CapturePreviewSource, GameId } from "../../types";
import {
  expectNoUnexpectedDashboardBridgeCalls,
  getDashboardE2ECalls,
  setDashboardCaptureSources,
  setupDashboardE2E,
} from "../helpers/dashboard-fixture";

const profileScreenSource: CapturePreviewSource = {
  displayId: "1",
  height: 1440,
  id: "screen:1:0",
  kind: "screen",
  name: "Screen 1 (Display Model)",
  thumbnailDataUrl: null,
  width: 2560,
};
const poe1WindowSource: CapturePreviewSource = {
  displayId: null,
  game: "poe1",
  height: 1440,
  id: "window:poe1:profiles",
  kind: "window",
  name: "Path of Exile 1",
  thumbnailDataUrl: null,
  width: 2560,
};
const poe2WindowSource: CapturePreviewSource = {
  displayId: null,
  game: "poe2",
  height: 1440,
  id: "window:poe2:profiles",
  kind: "window",
  name: "Path of Exile 2",
  thumbnailDataUrl: null,
  width: 2560,
};

interface SettingsProfileCase {
  activeCaptureRowName: string;
  captureName: string;
  existingAuraId: string;
  existingAuraName: string;
  existingCaptureId: string;
  existingCaptureName: string;
  auraName: string;
  game: GameId;
  label: string;
}

const settingsProfileCases: SettingsProfileCase[] = [
  {
    activeCaptureRowName: "PoE 2 Capture",
    auraName: "Boss PoE 2 Aura",
    captureName: "Boss PoE 2 Capture",
    existingAuraId: "profile-1",
    existingAuraName: "PoE 2",
    existingCaptureId: "capture-profile-1",
    existingCaptureName: "PoE 2 Capture",
    game: "poe2",
    label: "PoE 2",
  },
  {
    activeCaptureRowName: "Default PoE 1 Profile",
    auraName: "Boss PoE 1 Aura",
    captureName: "Boss PoE 1 Capture",
    existingAuraId: "profile-poe1",
    existingAuraName: "PoE 1",
    existingCaptureId: "capture-profile-poe1",
    existingCaptureName: "PoE 1 Capture",
    game: "poe1",
    label: "PoE 1",
  },
];

function getProfilePanel(pageOrLocator: Page | Locator, name: string): Locator {
  return pageOrLocator
    .getByRole("heading", { exact: true, name })
    .locator("xpath=ancestor::section[1]");
}

function getProfileRow(panel: Locator, name: string): Locator {
  return panel
    .getByRole("button", { exact: true, name })
    .locator("xpath=ancestor::div[1]");
}

async function getCreatedCaptureProfileId(
  page: Page,
  name: string,
): Promise<string> {
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return (
        calls.captureProfileCreates.find((profile) => profile.name === name)
          ?.id ?? null
      );
    })
    .not.toBeNull();

  const calls = await getDashboardE2ECalls(page);
  const createdProfile = calls.captureProfileCreates.find(
    (profile) => profile.name === name,
  );
  if (!createdProfile) {
    throw new Error(`Expected capture profile "${name}" to be created`);
  }

  return createdProfile.id;
}

async function getCreatedAuraProfileId(
  page: Page,
  name: string,
): Promise<string> {
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return (
        calls.profileCreates.find((profile) => profile.name === name)?.id ??
        null
      );
    })
    .not.toBeNull();

  const calls = await getDashboardE2ECalls(page);
  const createdProfile = calls.profileCreates.find(
    (profile) => profile.name === name,
  );
  if (!createdProfile) {
    throw new Error(`Expected aura profile "${name}" to be created`);
  }

  return createdProfile.id;
}

async function unlockCaptureProfile(page: Page): Promise<void> {
  const settingsPanel = page.locator('[data-onboarding="capture-settings"]');
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

async function lockCaptureProfile(page: Page): Promise<void> {
  const settingsPanel = page.locator('[data-onboarding="capture-settings"]');
  const lockChip = settingsPanel
    .getByRole("button", { name: "Lock capture profile" })
    .filter({ hasText: "Unlocked" });

  await expect(lockChip).toBeVisible();
  await lockChip.click();
  await expect(
    settingsPanel
      .getByRole("button", { name: "Unlock capture profile" })
      .filter({ hasText: "Locked" }),
  ).toBeVisible();
}

async function expectSourceOptionDisabled(
  sourceSelect: Locator,
  value: string,
  disabled: boolean,
): Promise<void> {
  await expect(
    sourceSelect.locator(`option[value="${value}"]`),
  ).toHaveJSProperty("disabled", disabled);
}

async function selectAppbarGame(page: Page, label: string): Promise<void> {
  await page
    .getByRole("tab")
    .filter({ hasText: label })
    .getByRole("button", { name: new RegExp(label) })
    .click();
}

async function openCaptureSettingsTab(page: Page, name: string): Promise<void> {
  await page
    .getByRole("tablist", { name: "Recording settings" })
    .getByRole("tab", { name })
    .click();
}

async function flushDashboardAsyncWork(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        queueMicrotask(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test.afterEach(async ({ page }) => {
  await expectNoUnexpectedDashboardBridgeCalls(page);
});

test("covers capture profile game switching, source sync, field persistence, and locking", async ({
  page,
}) => {
  await setupDashboardE2E(page);
  await setDashboardCaptureSources(page, [
    profileScreenSource,
    poe1WindowSource,
    poe2WindowSource,
  ]);
  await page.getByRole("button", { exact: true, name: "Refresh" }).click();

  const captureProfileSelect = page.getByRole("combobox", {
    name: "Capture profile",
  });
  const sourceSelect = page.getByRole("combobox", {
    name: /^Capture source$/,
  });

  await expect(captureProfileSelect).toHaveValue("capture-profile-1");
  await expect(captureProfileSelect.locator("option")).toHaveText([
    "Default PoE 1 Profile",
    "PoE 1 Capture",
    "Default PoE 2 Profile",
    "PoE 2 Capture",
  ]);
  await expect(sourceSelect.locator("option")).toHaveText([
    profileScreenSource.name,
    poe1WindowSource.name,
    poe2WindowSource.name,
  ]);
  await expectSourceOptionDisabled(sourceSelect, profileScreenSource.id, false);
  await expectSourceOptionDisabled(sourceSelect, poe1WindowSource.id, true);
  await expectSourceOptionDisabled(sourceSelect, poe2WindowSource.id, false);

  await selectAppbarGame(page, "Path of Exile 1");
  await expect(captureProfileSelect).toHaveValue("default-capture-poe1");
  await expect(sourceSelect).toHaveValue(poe1WindowSource.id);
  await expectSourceOptionDisabled(sourceSelect, profileScreenSource.id, false);
  await expectSourceOptionDisabled(sourceSelect, poe1WindowSource.id, false);
  await expectSourceOptionDisabled(sourceSelect, poe2WindowSource.id, true);
  await captureProfileSelect.selectOption("capture-profile-poe1");
  await expect(captureProfileSelect).toHaveValue("capture-profile-poe1");
  await expect(sourceSelect).toHaveValue(poe1WindowSource.id);

  await unlockCaptureProfile(page);
  await sourceSelect.selectOption(poe1WindowSource.id);
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.captureProfileUpdates;
    })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "capture-profile-poe1",
          captureTarget: expect.objectContaining({
            game: "poe1",
            id: poe1WindowSource.id,
            kind: "window",
            label: "Path of Exile 1",
          }),
        }),
      ]),
    );

  await page
    .getByRole("combobox", { name: /^Resolution/ })
    .selectOption("2560x1440");
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

  await openCaptureSettingsTab(page, "Recording");
  await page.getByLabel("Start recording automatically").check();
  await page.getByLabel("Hide Hinekora overlays from recording").uncheck();

  await openCaptureSettingsTab(page, "Rewind");
  await page.getByRole("button", { name: "45" }).click();
  await page.getByLabel("Start rewind automatically").check();
  await page.getByLabel("Hide Hinekora overlays from rewind").uncheck();

  await openCaptureSettingsTab(page, "Audio");
  await page
    .getByRole("combobox", { name: /^Audio input/ })
    .selectOption("device:0");
  await page
    .getByRole("combobox", { name: /^Audio output/ })
    .selectOption("device:0");

  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.captureProfileUpdates;
    })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingOutputResolution: "2560x1440",
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingFps: 30,
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingEncoder: "hardware_h265",
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingRunQuality: "ultra",
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingClipQuality: "low",
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingAutoStartMode: "recording",
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingAutoStartMode: "rewind",
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          deathClipSeconds: 45,
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingHideOverlaysFromRecording: false,
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingHideOverlaysFromRewind: false,
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingAudioInputDeviceId: "{mic-1}",
        }),
        expect.objectContaining({
          id: "capture-profile-poe1",
          recordingAudioOutputDeviceId: "{speakers-1}",
        }),
      ]),
    );

  await selectAppbarGame(page, "Path of Exile 2");
  await expect(captureProfileSelect).toHaveValue("capture-profile-1");
  await expect(sourceSelect).toHaveValue(profileScreenSource.id);
  await expectSourceOptionDisabled(sourceSelect, poe1WindowSource.id, true);
  await expectSourceOptionDisabled(sourceSelect, poe2WindowSource.id, false);
  await openCaptureSettingsTab(page, "Capture");
  await sourceSelect.selectOption(poe2WindowSource.id);
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.captureProfileUpdates;
    })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "capture-profile-1",
          captureTarget: expect.objectContaining({
            game: "poe2",
            id: poe2WindowSource.id,
            kind: "window",
            label: "Path of Exile 2",
          }),
        }),
      ]),
    );

  await lockCaptureProfile(page);
  const updateCountAfterLock = (await getDashboardE2ECalls(page))
    .captureProfileUpdates.length;
  await page.getByRole("button", { name: "60 FPS" }).click();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.settingsUpdates;
    })
    .toEqual(
      expect.arrayContaining([expect.objectContaining({ recordingFps: 60 })]),
    );
  await flushDashboardAsyncWork(page);
  const callsAfterLockedSettingsUpdate = await getDashboardE2ECalls(page);
  expect(callsAfterLockedSettingsUpdate.captureProfileUpdates).toHaveLength(
    updateCountAfterLock,
  );
});

for (const profileCase of settingsProfileCases) {
  test(`covers ${profileCase.label} settings capture and aura profile management`, async ({
    page,
  }) => {
    await setupDashboardE2E(page, { activeGame: profileCase.game });
    await page.goto("/#/settings?tab=profiles");
    await expect(
      page.getByRole("heading", { exact: true, name: "Settings" }),
    ).toBeVisible();

    const captureProfilesPanel = getProfilePanel(page, "Capture Profiles");
    await expect(
      captureProfilesPanel.getByText("Default PoE 1 Profile"),
    ).toBeVisible();
    await expect(captureProfilesPanel.getByText("PoE 1 Capture")).toBeVisible();
    await expect(
      captureProfilesPanel.getByText("Default PoE 2 Profile"),
    ).toBeVisible();
    await expect(captureProfilesPanel.getByText("PoE 2 Capture")).toBeVisible();
    await expect(
      captureProfilesPanel.getByRole("button", {
        name: "Delete Default PoE 1 Profile",
      }),
    ).toBeDisabled();
    await expect(
      captureProfilesPanel.getByRole("button", {
        name: "Delete Default PoE 2 Profile",
      }),
    ).toBeDisabled();
    await expect(
      getProfileRow(captureProfilesPanel, profileCase.activeCaptureRowName),
    ).toHaveClass(/border-primary/);

    await captureProfilesPanel
      .getByRole("textbox", { name: "Capture profile name" })
      .fill(profileCase.captureName);
    await expect(
      captureProfilesPanel.getByRole("textbox", {
        name: "Capture profile name",
      }),
    ).toHaveValue(profileCase.captureName);
    await captureProfilesPanel.getByRole("button", { name: "Add" }).click();
    const createdCaptureProfileId = await getCreatedCaptureProfileId(
      page,
      profileCase.captureName,
    );
    await expect(
      getProfileRow(captureProfilesPanel, profileCase.captureName),
    ).toHaveClass(/border-primary/);
    await expect
      .poll(async () => {
        const calls = await getDashboardE2ECalls(page);

        return calls.captureProfileCreates;
      })
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            game: profileCase.game,
            name: profileCase.captureName,
          }),
        ]),
      );

    await captureProfilesPanel
      .getByRole("button", {
        exact: true,
        name: profileCase.existingCaptureName,
      })
      .click();
    await captureProfilesPanel
      .getByRole("button", { exact: true, name: profileCase.captureName })
      .click();
    await expect
      .poll(async () => {
        const calls = await getDashboardE2ECalls(page);

        return calls.settingsUpdates;
      })
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            selectedCaptureProfileId: profileCase.existingCaptureId,
          }),
          expect.objectContaining({
            selectedCaptureProfileId: createdCaptureProfileId,
          }),
        ]),
      );

    const auraProfilesPanel = getProfilePanel(page, "Aura Profiles");
    await expect(
      auraProfilesPanel.getByRole("button", { name: /^PoE [12]$/ }),
    ).toHaveText(["PoE 1", "PoE 2"]);
    await expect(
      getProfileRow(auraProfilesPanel, profileCase.existingAuraName),
    ).toHaveClass(/border-primary/);

    await auraProfilesPanel
      .getByRole("textbox", { name: "Aura profile name" })
      .fill(profileCase.auraName);
    await expect(
      auraProfilesPanel.getByRole("textbox", { name: "Aura profile name" }),
    ).toHaveValue(profileCase.auraName);
    await auraProfilesPanel.getByRole("button", { name: "Add" }).click();
    const createdAuraProfileId = await getCreatedAuraProfileId(
      page,
      profileCase.auraName,
    );
    await expect
      .poll(async () => {
        const calls = await getDashboardE2ECalls(page);

        return calls.profileCreates;
      })
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            game: profileCase.game,
            name: profileCase.auraName,
          }),
        ]),
      );

    await auraProfilesPanel
      .getByRole("button", {
        exact: true,
        name: profileCase.existingAuraName,
      })
      .click();
    await auraProfilesPanel
      .getByRole("button", { exact: true, name: profileCase.auraName })
      .click();
    await expect
      .poll(async () => {
        const calls = await getDashboardE2ECalls(page);

        return calls.settingsUpdates;
      })
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            selectedProfileId: profileCase.existingAuraId,
          }),
          expect.objectContaining({ selectedProfileId: createdAuraProfileId }),
        ]),
      );

    await captureProfilesPanel
      .getByRole("button", { name: `Delete ${profileCase.captureName}` })
      .click();
    await auraProfilesPanel
      .getByRole("button", { name: `Delete ${profileCase.auraName}` })
      .click();
    await expect
      .poll(async () => {
        const calls = await getDashboardE2ECalls(page);

        return {
          captureProfileDeletes: calls.captureProfileDeletes,
          profileDeletes: calls.profileDeletes,
        };
      })
      .toEqual({
        captureProfileDeletes: expect.arrayContaining([
          createdCaptureProfileId,
        ]),
        profileDeletes: expect.arrayContaining([createdAuraProfileId]),
      });
  });
}
