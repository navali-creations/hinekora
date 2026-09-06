import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Profile, ProfileUpdateInput } from "~/types";

const profile: Profile = {
  id: "profile-1",
  name: "Default",
  game: "poe1",
  targetFps: 30,
  captureTarget: {
    height: 1080,
    id: "display-1",
    kind: "display",
    label: "Display 1",
    width: 1920,
  },
  cropRegions: [
    { id: "crop-1", label: "Aura 1", x: 0, y: 0, width: 40, height: 40 },
    { id: "crop-2", label: "Aura 2", x: 50, y: 0, width: 40, height: 40 },
  ],
  overlayPlacements: [
    {
      id: "placement-1",
      cropRegionId: "crop-1",
      x: 10,
      y: 10,
      scale: 1,
      opacity: 1,
    },
    {
      id: "placement-2",
      cropRegionId: "crop-2",
      x: 20,
      y: 20,
      scale: 2,
      opacity: 1,
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const storeMocks = vi.hoisted(() => ({
  activeGame: "poe1" as const,
  profileItems: [] as Profile[],
  recordAuraHistory: vi.fn(),
  selectPlacement: vi.fn(),
  selectedProfileId: null as string | null,
  updateProfileFromCurrent: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useAuraOverlayShallow: (selector: unknown) =>
    (selector as (auraOverlay: unknown) => unknown)({
      recordAuraHistory: storeMocks.recordAuraHistory,
      selectPlacement: storeMocks.selectPlacement,
    }),
  useProfilesShallow: (selector: unknown) =>
    (selector as (profiles: unknown) => unknown)({
      items: storeMocks.profileItems,
      selectedProfileId: storeMocks.selectedProfileId,
      updateFromCurrent: storeMocks.updateProfileFromCurrent,
    }),
  useSettingsSelector: (selector: unknown) =>
    (selector as (settings: unknown) => unknown)({
      value: { activeGame: storeMocks.activeGame },
    }),
}));

import { AuraOverlayBulkResize } from "./AuraOverlayBulkResize";

describe("AuraOverlayBulkResize", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.location.hash = "#/aura-overlay";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.profileItems = [profile];
    storeMocks.selectedProfileId = profile.id;
    storeMocks.updateProfileFromCurrent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("defaults to the anchor category and resizes matching auras", async () => {
    await act(async () => root.render(<AuraOverlayBulkResize />));
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Aura size anchor"]',
    );
    const resizeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Resize all auras to match the size anchor"]',
    );

    expect(select?.value).toBe("placement-1");
    expect(resizeButton?.disabled).toBe(false);
    expect(
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Default (2)")
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "All types (2)")
        ?.getAttribute("aria-pressed"),
    ).toBe("false");

    await act(async () => {
      if (select) {
        select.value = "placement-2";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(storeMocks.selectPlacement).toHaveBeenLastCalledWith("placement-2");
    await act(async () => resizeButton?.click());

    expect(storeMocks.updateProfileFromCurrent).toHaveBeenCalledWith(
      profile.id,
      expect.any(Function),
    );
    const createUpdate = storeMocks.updateProfileFromCurrent.mock
      .calls[0]?.[1] as (
      currentProfile: Profile,
    ) => Omit<ProfileUpdateInput, "id"> | null;
    const resizedPlacements = createUpdate(profile)?.overlayPlacements;
    expect(storeMocks.recordAuraHistory).toHaveBeenCalledWith(profile);
    expect(resizedPlacements?.map((placement) => placement.scale)).toEqual([
      1, 2,
    ]);
    expect(resizedPlacements?.[0]).toMatchObject({
      height: 80,
      scale: 1,
      width: 80,
    });
  });

  it("combines category filters and toggles all types", async () => {
    const categorizedProfile: Profile = {
      ...profile,
      cropRegions: [
        profile.cropRegions[0]!,
        { ...profile.cropRegions[1]!, shape: "arc" },
        {
          id: "crop-3",
          label: "Pointer 1",
          points: [{ x: 10, y: 10 }],
          shape: "points",
          x: 100,
          y: 0,
          width: 40,
          height: 40,
        },
      ],
      overlayPlacements: [
        profile.overlayPlacements[0]!,
        profile.overlayPlacements[1]!,
        {
          id: "placement-3",
          cropRegionId: "crop-3",
          x: 30,
          y: 30,
          scale: 3,
          opacity: 1,
        },
      ],
    };
    storeMocks.profileItems = [categorizedProfile];

    await act(async () => root.render(<AuraOverlayBulkResize />));
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Aura size anchor"]',
    );
    await act(async () => {
      if (select) {
        select.value = "placement-2";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const findButton = (text: string) =>
      [...container.querySelectorAll("button")].find(
        (button) => button.textContent === text,
      );
    expect(findButton("Arc (1)")?.getAttribute("aria-pressed")).toBe("true");
    expect(findButton("Default (1)")?.getAttribute("aria-pressed")).toBe(
      "false",
    );

    await act(async () => findButton("Arc (1)")?.click());
    expect(findButton("Arc (1)")?.getAttribute("aria-pressed")).toBe("true");
    await act(async () => findButton("Default (1)")?.click());
    expect(findButton("Default (1)")?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    await act(async () => findButton("All types (3)")?.click());
    expect(findButton("All types (3)")?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    await act(async () => findButton("All types (3)")?.click());
    expect(findButton("All types (3)")?.getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(findButton("Arc (1)")?.getAttribute("aria-pressed")).toBe("true");
    await act(async () => findButton("All types (3)")?.click());

    const resizeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Resize all auras to match the size anchor"]',
    );
    await act(async () => resizeButton?.click());
    const createUpdate = storeMocks.updateProfileFromCurrent.mock
      .calls[0]?.[1] as (
      currentProfile: Profile,
    ) => Omit<ProfileUpdateInput, "id"> | null;
    const resizedPlacements =
      createUpdate(categorizedProfile)?.overlayPlacements;
    expect(resizedPlacements?.map((placement) => placement.scale)).toEqual([
      1, 2, 1,
    ]);
    expect(resizedPlacements?.[0]).toMatchObject({ height: 80, width: 80 });
    expect(resizedPlacements?.[2]).toMatchObject({ height: 80, width: 80 });
  });

  it("resets the anchor filters when the active profile changes", async () => {
    const categorizedProfile: Profile = {
      ...profile,
      cropRegions: [
        ...profile.cropRegions,
        {
          id: "crop-3",
          label: "Pointer 1",
          points: [{ x: 10, y: 10 }],
          shape: "points",
          x: 100,
          y: 0,
          width: 40,
          height: 40,
        },
      ],
      overlayPlacements: [
        ...profile.overlayPlacements,
        {
          id: "placement-3",
          cropRegionId: "crop-3",
          x: 30,
          y: 30,
          scale: 3,
          opacity: 1,
        },
      ],
    };
    storeMocks.profileItems = [categorizedProfile];

    await act(async () => root.render(<AuraOverlayBulkResize />));
    const findButton = (text: string) =>
      [...container.querySelectorAll("button")].find(
        (button) => button.textContent === text,
      );
    await act(async () => findButton("Pointer (1)")?.click());
    expect(findButton("Pointer (1)")?.getAttribute("aria-pressed")).toBe(
      "true",
    );

    const nextProfile: Profile = {
      ...profile,
      id: "profile-2",
      cropRegions: profile.cropRegions.map((region) => ({
        ...region,
        shape: "arc",
      })),
    };
    storeMocks.profileItems = [nextProfile];
    storeMocks.selectedProfileId = nextProfile.id;
    await act(async () => root.render(<AuraOverlayBulkResize />));

    expect(findButton("Arc (2)")?.getAttribute("aria-pressed")).toBe("true");
    expect(findButton("Default (0)")?.getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(findButton("Pointer (0)")?.getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Resize all auras to match the size anchor"]',
      )?.disabled,
    ).toBe(false);
  });

  it("uses the routed profile and disables resizing without two auras", async () => {
    const routedProfile = {
      ...profile,
      id: "profile-2",
      overlayPlacements: profile.overlayPlacements.slice(0, 1),
    };
    storeMocks.profileItems = [profile, routedProfile];
    window.location.hash = "#/aura-overlay?profileId=profile-2";

    await act(async () => root.render(<AuraOverlayBulkResize />));

    expect(
      container.querySelector<HTMLSelectElement>(
        'select[aria-label="Aura size anchor"]',
      )?.value,
    ).toBe("placement-1");
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Resize all auras to match the size anchor"]',
      )?.disabled,
    ).toBe(true);
  });

  it("shows an empty disabled state when no profile is available", async () => {
    storeMocks.profileItems = [];
    storeMocks.selectedProfileId = null;

    await act(async () => root.render(<AuraOverlayBulkResize />));

    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Aura size anchor"]',
    );
    expect(select?.disabled).toBe(true);
    expect(select?.textContent).toContain("No auras available");
  });

  it("does not record history when matching would not change the profile", async () => {
    const alreadyMatchedProfile = {
      ...profile,
      overlayPlacements: profile.overlayPlacements.map((placement) => ({
        ...placement,
        height: 40,
        referenceHeight: 1080,
        referenceWidth: 1920,
        scale: 1,
        width: 40,
      })),
    };
    storeMocks.profileItems = [alreadyMatchedProfile];

    await act(async () => root.render(<AuraOverlayBulkResize />));
    const resizeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Resize all auras to match the size anchor"]',
    );
    await act(async () => resizeButton?.click());
    const createUpdate = storeMocks.updateProfileFromCurrent.mock
      .calls[0]?.[1] as (
      currentProfile: Profile,
    ) => Omit<ProfileUpdateInput, "id"> | null;

    expect(createUpdate(alreadyMatchedProfile)).toBeNull();
    expect(storeMocks.recordAuraHistory).not.toHaveBeenCalled();
  });
});
