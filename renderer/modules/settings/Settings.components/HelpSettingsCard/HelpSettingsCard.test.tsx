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

  it("toggles dismissed dashboard alerts from help settings", async () => {
    await renderHelpSettings();
    const showGroupPlayDeathAlert = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show Group play death clip alert"]',
    );

    expect(container.textContent).toContain("Dismissible alerts");
    expect(container.textContent).toContain("1 / 4 dismissed");
    expect(container.textContent).toContain("Clip preview info alert");
    expect(container.textContent).toContain("Dismissed");
    expect(showGroupPlayDeathAlert?.checked).toBe(false);

    await act(async () => {
      showGroupPlayDeathAlert?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      groupPlayDeathAlertDismissed: false,
    });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "dismissible-alert-visibility-toggled",
      {
        alertId: "group-play-death",
        visible: true,
      },
    );
  });

  it("dismisses the recorder settings info alert from help settings", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      recorderSettingsInfoAlertDismissed: false,
    };

    await renderHelpSettings();
    const dismissRecorderSettingsAlert =
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Dismiss Recorder settings info alert"]',
      );

    expect(container.textContent).toContain("Recorder settings info alert");
    expect(dismissRecorderSettingsAlert?.checked).toBe(true);

    await act(async () => {
      dismissRecorderSettingsAlert?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      recorderSettingsInfoAlertDismissed: true,
    });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "dismissible-alert-visibility-toggled",
      {
        alertId: "recorder-settings-info",
        visible: false,
      },
    );
  });

  it("restores the capture mode info alert from help settings", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      captureModeInfoAlertDismissed: true,
    };

    await renderHelpSettings();
    const showCaptureModeInfoAlert = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show Capture mode info alert"]',
    );

    expect(container.textContent).toContain("Capture mode info alert");
    expect(showCaptureModeInfoAlert?.checked).toBe(false);

    await act(async () => {
      showCaptureModeInfoAlert?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      captureModeInfoAlertDismissed: false,
    });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "dismissible-alert-visibility-toggled",
      {
        alertId: "capture-mode-info",
        visible: true,
      },
    );
  });

  it("dismisses the clip preview info alert from help settings", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      clipPreviewInfoAlertDismissed: false,
    };

    await renderHelpSettings();
    const dismissClipPreviewInfoAlert =
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Dismiss Clip preview info alert"]',
      );

    expect(container.textContent).toContain("Clip preview info alert");
    expect(container.textContent).toContain(
      "Manual Replays and Death Clips are available on the Clips page.",
    );
    expect(dismissClipPreviewInfoAlert?.checked).toBe(true);

    await act(async () => {
      dismissClipPreviewInfoAlert?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      clipPreviewInfoAlertDismissed: true,
    });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "dismissible-alert-visibility-toggled",
      {
        alertId: "clip-preview-info",
        visible: false,
      },
    );
  });
});
