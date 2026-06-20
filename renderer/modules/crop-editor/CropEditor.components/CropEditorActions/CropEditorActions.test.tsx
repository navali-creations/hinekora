import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  setAuraOverlayLocked: vi.fn(),
  selectAura: vi.fn(),
  useCropEditorShallow: vi.fn(),
  usePoeProcessSelector: vi.fn(),
  useProfilesShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useCropEditorShallow: storeMocks.useCropEditorShallow,
  usePoeProcessSelector: storeMocks.usePoeProcessSelector,
  useProfilesShallow: storeMocks.useProfilesShallow,
  useSettingsSelector: storeMocks.useSettingsSelector,
}));

import { CropEditorActions } from "./CropEditorActions";

const profile = {
  id: "profile-1",
  name: "Default",
  game: "poe1",
  targetFps: 30,
  captureTarget: null,
  cropRegions: [],
  overlayPlacements: [],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

describe("CropEditorActions", () => {
  beforeEach(() => {
    storeMocks.useProfilesShallow.mockImplementation((selector) =>
      selector({
        items: [profile],
        selectedProfileId: "profile-1",
        select: vi.fn(),
        update: storeMocks.updateProfile,
      }),
    );
    storeMocks.useCropEditorShallow.mockImplementation((selector) =>
      selector({
        auraOverlayLocked: true,
        selectAura: storeMocks.selectAura,
        setAuraOverlayLocked: storeMocks.setAuraOverlayLocked,
      }),
    );
    storeMocks.usePoeProcessSelector.mockImplementation((selector) =>
      selector({
        state: {
          isRunning: false,
          processName: "",
        },
      }),
    );
    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector({
        value: {
          activeGame: "poe1",
        },
      }),
    );
  });

  it("renders the disabled add aura page action with its explanation", () => {
    const html = renderToStaticMarkup(<CropEditorActions />);

    expect(html).toContain("Add new aura");
    expect(html).toContain("Lock");
    expect(html).toContain("Unlock");
    expect(html).toContain("Start the selected Path of Exile game");
    expect(html).toContain("disabled");
  });
});
