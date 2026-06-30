import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allOnboardingBeaconIds } from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";

import { type AppSettings, createDefaultSettings } from "~/types";

const analyticsMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

const storeMocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  dismissedBeacons: ["game-selector"] as string[],
  dismissAll: vi.fn(),
  refreshBeaconHost: vi.fn(),
  resetAll: vi.fn(),
  resetOne: vi.fn(),
  settingsValue: null as AppSettings | null,
  updateSettings: vi.fn(),
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: analyticsMocks.trackEvent,
}));

vi.mock("~/renderer/store", () => ({
  useBoundStore: {
    getState: () => ({
      onboarding: {
        dismissedBeacons: storeMocks.dismissedBeacons,
      },
    }),
  },
  useOnboardingActions: () => ({
    dismiss: storeMocks.dismiss,
    dismissAll: storeMocks.dismissAll,
    refreshBeaconHost: storeMocks.refreshBeaconHost,
    resetAll: storeMocks.resetAll,
    resetOne: storeMocks.resetOne,
  }),
  useOnboardingState: () => ({
    dismissedBeacons: storeMocks.dismissedBeacons,
  }),
  useSettingsShallow: (selector: unknown) =>
    (selector as (settings: unknown) => unknown)({
      value: storeMocks.settingsValue,
      update: storeMocks.updateSettings,
    }),
}));

import { HelpSettingsCard } from "./HelpSettingsCard";

let container: HTMLDivElement;
let root: Root;

async function renderHelpSettings() {
  await act(async () => {
    root.render(<HelpSettingsCard />);
  });
}

describe("HelpSettingsCard", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.dismissedBeacons = ["game-selector"];
    storeMocks.dismissAll.mockImplementation(async () => {
      storeMocks.dismissedBeacons = [...allOnboardingBeaconIds];
    });
    storeMocks.dismiss.mockImplementation(async (key: string) => {
      storeMocks.dismissedBeacons = [
        ...new Set([...storeMocks.dismissedBeacons, key]),
      ];
    });
    storeMocks.resetOne.mockImplementation(async (key: string) => {
      storeMocks.dismissedBeacons = storeMocks.dismissedBeacons.filter(
        (beaconId) => beaconId !== key,
      );
    });
    storeMocks.resetAll.mockImplementation(async () => {
      storeMocks.dismissedBeacons = [];
    });
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      groupPlayDeathAlertDismissed: true,
    };
    storeMocks.updateSettings.mockResolvedValue(undefined);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("dismisses all beacons from settings and refreshes the beacon host", async () => {
    await renderHelpSettings();
    const dismissAllButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Dismiss All Beacons"));

    await act(async () => {
      dismissAllButton?.click();
    });

    expect(storeMocks.dismissAll).toHaveBeenCalledTimes(1);
    expect(storeMocks.refreshBeaconHost).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "onboarding-dismiss-all-clicked",
      {
        source: "settings",
      },
    );
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "onboarding-all-dismissed",
      {
        source: "settings",
      },
    );
    expect(container.textContent).toContain("All dismissed");
  });

  it("tracks individual beacon visibility toggles from settings", async () => {
    await renderHelpSettings();
    const showGameSelector = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show Game selector beacon"]',
    );
    const dismissOverlay = container.querySelector<HTMLInputElement>(
      'input[aria-label="Dismiss Overlay icon beacon"]',
    );

    await act(async () => {
      if (!showGameSelector || !dismissOverlay) {
        throw new Error("Expected onboarding beacon toggles to render");
      }

      showGameSelector.click();
      dismissOverlay.click();
    });

    expect(storeMocks.resetOne).toHaveBeenCalledWith("game-selector");
    expect(storeMocks.dismiss).toHaveBeenCalledWith("overlay-icon");
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "onboarding-beacon-visibility-toggled",
      {
        beaconId: "game-selector",
        visible: true,
        didDismiss: false,
        didReset: true,
      },
    );
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "onboarding-beacon-visibility-toggled",
      {
        beaconId: "overlay-icon",
        visible: false,
        didDismiss: true,
        didReset: false,
      },
    );
  });

  it("restores dismissed dashboard alerts from help settings", async () => {
    await renderHelpSettings();
    const showAgainButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Show Again"));

    expect(container.textContent).toContain("Dismissible alerts");
    expect(container.textContent).toContain("Dismissed");

    await act(async () => {
      showAgainButton?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      groupPlayDeathAlertDismissed: false,
    });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "dismissible-alert-restored",
      {
        alertId: "group-play-death",
      },
    );
  });

  it("restores the recorder settings info alert from help settings", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      recorderSettingsInfoAlertDismissed: true,
    };

    await renderHelpSettings();
    const showAgainButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find(
      (button) =>
        button.textContent?.includes("Show Again") && !button.disabled,
    );

    expect(container.textContent).toContain("Recorder settings info alert");

    await act(async () => {
      showAgainButton?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      recorderSettingsInfoAlertDismissed: false,
    });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "dismissible-alert-restored",
      {
        alertId: "recorder-settings-info",
      },
    );
  });

  it("restores the capture mode info alert from help settings", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      captureModeInfoAlertDismissed: true,
    };

    await renderHelpSettings();
    const showAgainButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find(
      (button) =>
        button.textContent?.includes("Show Again") && !button.disabled,
    );

    expect(container.textContent).toContain("Capture mode info alert");

    await act(async () => {
      showAgainButton?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      captureModeInfoAlertDismissed: false,
    });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "dismissible-alert-restored",
      {
        alertId: "capture-mode-info",
      },
    );
  });
});
