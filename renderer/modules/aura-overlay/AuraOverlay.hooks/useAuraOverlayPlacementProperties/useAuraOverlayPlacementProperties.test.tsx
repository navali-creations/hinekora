import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBoundStore } from "~/renderer/store";
import type { ProfilesSlice } from "~/renderer/store/store.types";

import type { Profile } from "~/types";
import type { AuraPlacementPropertiesPatch } from "../../AuraOverlay.components/AuraPlacementPropertiesPanel/AuraPlacementPropertiesPanel";

const storeMocks = vi.hoisted(() => ({
  updateProfile: vi.fn<ProfilesSlice["profiles"]["update"]>(),
}));

vi.mock("~/renderer/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/renderer/store")>();

  return {
    ...actual,
    useProfilesShallow: (selector: unknown) =>
      (
        selector as (profiles: {
          update: ProfilesSlice["profiles"]["update"];
        }) => unknown
      )({ update: storeMocks.updateProfile }),
  };
});

import { useAuraOverlayPlacementProperties } from "./useAuraOverlayPlacementProperties";

const profile: Profile = {
  captureTarget: null,
  createdAt: new Date(0).toISOString(),
  cropRegions: [
    {
      height: 40,
      id: "crop-1",
      label: "Aura",
      width: 100,
      x: 10,
      y: 20,
    },
  ],
  game: "poe1",
  id: "profile-1",
  name: "Default",
  overlayPlacements: [
    {
      cropRegionId: "crop-1",
      id: "placement-1",
      opacity: 1,
      scale: 1,
      x: 30,
      y: 40,
    },
  ],
  targetFps: 30,
  updatedAt: new Date(0).toISOString(),
};

describe("useAuraOverlayPlacementProperties", () => {
  let root: Root | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.replaceChildren();
    useBoundStore.getState().auraOverlay.resetAuraHistory(null);
    vi.clearAllMocks();
  });

  it("consumes rejected fire-and-forget profile updates", async () => {
    storeMocks.updateProfile.mockRejectedValue(new Error("write failed"));
    let handleChange:
      | ((placementId: string, patch: AuraPlacementPropertiesPatch) => void)
      | null = null;

    function HookHarness() {
      ({ handlePlacementPropertiesChange: handleChange } =
        useAuraOverlayPlacementProperties({
          profile,
          referenceViewport: null,
          targetViewport: { height: 1080, width: 1920 },
        }));

      return null;
    }

    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<HookHarness />);
    });

    await act(async () => {
      handleChange?.("placement-1", { opacity: 0.5 });
      await Promise.resolve();
    });

    expect(storeMocks.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: profile.id,
        overlayPlacements: [expect.objectContaining({ opacity: 0.5 })],
      }),
    );
    expect(
      useBoundStore.getState().auraOverlay.editingHistory.undo,
    ).toHaveLength(1);
  });
});
