import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allOnboardingBeaconIds } from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";

import { BeaconManagementList } from "./BeaconManagementList";

let container: HTMLDivElement;
let root: Root;

async function renderList(
  onDismiss = vi.fn(),
  onReset = vi.fn(),
): Promise<void> {
  const beaconStates = allOnboardingBeaconIds.map((id, index) => ({
    id,
    dismissed: index % 2 === 0,
  }));

  await act(async () => {
    root.render(
      <BeaconManagementList
        beaconStates={beaconStates}
        onDismiss={onDismiss}
        onReset={onReset}
      />,
    );
  });
}

describe("BeaconManagementList", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("renders grouped beacon counts", async () => {
    await renderList();

    expect(container.textContent).toContain("All Pages");
    expect(container.textContent).toContain("Dashboard");
    expect(container.textContent).toContain("Aura Manager");
    expect(container.textContent).toContain("Editor");
    expect(container.textContent).toContain("1 / 2 dismissed");
    expect(container.textContent).toContain("2 / 4 dismissed");
    expect(container.textContent).toContain("3 / 5 dismissed");
  });

  it("routes toggle changes to dismiss or reset actions", async () => {
    const onDismiss = vi.fn();
    const onReset = vi.fn();
    await renderList(onDismiss, onReset);

    const hiddenGameSelector = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show Game selector beacon"]',
    );
    const visibleOverlay = container.querySelector<HTMLInputElement>(
      'input[aria-label="Dismiss Overlay icon beacon"]',
    );

    await act(async () => {
      if (!hiddenGameSelector || !visibleOverlay) {
        throw new Error("Expected beacon toggles to render");
      }

      hiddenGameSelector.click();
      visibleOverlay.click();
    });

    expect(onReset).toHaveBeenCalledWith("game-selector");
    expect(onDismiss).toHaveBeenCalledWith("overlay-icon");
  });
});
