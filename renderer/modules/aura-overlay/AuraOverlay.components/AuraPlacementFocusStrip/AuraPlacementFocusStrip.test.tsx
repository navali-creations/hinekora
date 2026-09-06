import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useBoundStore } from "~/renderer/store";

import { AuraPlacementFocusStrip } from "./AuraPlacementFocusStrip";

describe("AuraPlacementFocusStrip", () => {
  let root: Root | null = null;

  beforeEach(() => {
    useBoundStore.getState().auraOverlay.clearPlacementSelection();
  });

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.replaceChildren();
  });

  it("lists aura placements and focuses the clicked placement", async () => {
    useBoundStore.getState().auraOverlay.selectPlacement("placement-1");
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AuraPlacementFocusStrip
          cropRegions={[
            { id: "crop-1", label: "Life", x: 0, y: 0, width: 10, height: 10 },
            {
              id: "crop-2",
              label: "Shield",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
            },
          ]}
          placements={[
            {
              id: "placement-1",
              cropRegionId: "crop-1",
              x: 0,
              y: 0,
              scale: 1,
              opacity: 1,
            },
            {
              id: "placement-2",
              cropRegionId: "crop-2",
              x: 0,
              y: 0,
              scale: 1,
              opacity: 1,
            },
          ]}
        />,
      );
    });

    const shieldButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Shield",
    );
    expect(shieldButton?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      shieldButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useBoundStore.getState().auraOverlay.selectedPlacementId).toBe(
      "placement-2",
    );
  });

  it("does not render an empty focus strip", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AuraPlacementFocusStrip cropRegions={[]} placements={[]} />,
      );
    });

    expect(container.querySelector("nav")).toBeNull();
  });
});
