import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  dismissedBeacons: ["game-selector"] as string[],
  refreshBeaconHost: vi.fn(),
  resetAll: vi.fn(),
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
    refreshBeaconHost: storeMocks.refreshBeaconHost,
    resetAll: storeMocks.resetAll,
  }),
}));

import { OnboardingButton } from "./OnboardingButton";

let container: HTMLDivElement;
let root: Root;

async function renderButton() {
  await act(async () => {
    root.render(<OnboardingButton />);
  });
}

describe("OnboardingButton", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.dismissedBeacons = ["game-selector"];
    storeMocks.resetAll.mockImplementation(async () => {
      storeMocks.dismissedBeacons = [];
    });
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("resets onboarding and refreshes the beacon host", async () => {
    await renderButton();

    const button = container.querySelector("button");

    await act(async () => {
      button?.click();
    });

    expect(storeMocks.resetAll).toHaveBeenCalledTimes(1);
    expect(storeMocks.refreshBeaconHost).toHaveBeenCalledTimes(1);
  });
});
