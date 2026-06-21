import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allOnboardingBeaconIds } from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";

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
    storeMocks.resetAll.mockImplementation(async () => {
      storeMocks.dismissedBeacons = [];
    });
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
      "onboarding-all-dismissed",
      {
        source: "settings",
      },
    );
    expect(container.textContent).toContain("All dismissed");
  });
});
