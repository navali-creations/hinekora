import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  selectAura: vi.fn(),
  useCropEditorShallow: vi.fn(),
  useProfilesShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useCropEditorShallow: storeMocks.useCropEditorShallow,
  useProfilesShallow: storeMocks.useProfilesShallow,
  useSettingsSelector: storeMocks.useSettingsSelector,
}));

import { AuraTabs } from "./AuraTabs";

const profile = {
  id: "profile-1",
  name: "Default",
  game: "poe1",
  targetFps: 30,
  captureTarget: null,
  cropRegions: [
    {
      id: "crop-1",
      label: "Flasks",
      x: 10,
      y: 20,
      width: 300,
      height: 120,
    },
    {
      id: "crop-2",
      label: "Buffs",
      x: 30,
      y: 40,
      width: 220,
      height: 80,
    },
  ],
  overlayPlacements: [],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

describe("AuraTabs", () => {
  beforeEach(() => {
    storeMocks.useProfilesShallow.mockImplementation((selector) =>
      selector({
        items: [profile],
        selectedProfileId: "profile-1",
        update: storeMocks.updateProfile,
      }),
    );
    storeMocks.useCropEditorShallow.mockImplementation((selector) =>
      selector({
        selectedAuraCropRegionId: "crop-2",
        selectAura: storeMocks.selectAura,
      }),
    );
    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector({ value: { activeGame: "poe1" } }),
    );
  });

  it("renders aura tabs from crop region labels and marks the selected aura", () => {
    const html = renderToStaticMarkup(<AuraTabs />);

    expect(html).toContain("Flasks");
    expect(html).toContain("Buffs");
    expect(html).toContain('aria-selected="true"');
  });

  it("marks the only aura selected when no aura is stored yet", () => {
    storeMocks.useProfilesShallow.mockImplementation((selector) =>
      selector({
        items: [{ ...profile, cropRegions: [profile.cropRegions[0]!] }],
        selectedProfileId: "profile-1",
        update: storeMocks.updateProfile,
      }),
    );
    storeMocks.useCropEditorShallow.mockImplementation((selector) =>
      selector({
        selectedAuraCropRegionId: null,
        selectAura: storeMocks.selectAura,
      }),
    );

    const html = renderToStaticMarkup(<AuraTabs />);

    expect(html).toContain("Flasks");
    expect(html).toContain('aria-selected="true"');
  });

  it("does not render tabs without auras", () => {
    storeMocks.useProfilesShallow.mockImplementation((selector) =>
      selector({
        items: [],
        selectedProfileId: null,
        update: storeMocks.updateProfile,
      }),
    );

    const html = renderToStaticMarkup(<AuraTabs />);

    expect(html).toBe("");
  });
});
