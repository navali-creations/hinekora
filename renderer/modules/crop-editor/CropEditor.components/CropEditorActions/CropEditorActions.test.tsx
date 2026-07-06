import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  setAuraOverlayLocked: vi.fn(),
  selectAura: vi.fn(),
  useCropEditorShallow: vi.fn(),
  usePoeProcessSelector: vi.fn(),
  useProfilesShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
  updateProfile: vi.fn(),
}));

const electronMocks = vi.hoisted(() => ({
  minimize: vi.fn(),
  selectCropRegion: vi.fn(),
  setAuraLocked: vi.fn(),
  showAura: vi.fn(),
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

function createRunningPoe1ProcessState() {
  return {
    game: "poe1" as const,
    isRunning: true as const,
    pid: 4241,
    processName: "PathOfExile.exe",
    windowTitle: "Path of Exile",
  };
}

describe("CropEditorActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMocks.minimize.mockResolvedValue(undefined);
    electronMocks.selectCropRegion.mockResolvedValue({
      x: 100,
      y: 120,
      width: 50,
      height: 60,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });
    electronMocks.setAuraLocked.mockResolvedValue(undefined);
    electronMocks.showAura.mockResolvedValue(undefined);
    storeMocks.updateProfile.mockResolvedValue(undefined);
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
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        mainWindow: {
          minimize: electronMocks.minimize,
        },
        overlayWindows: {
          selectCropRegion: electronMocks.selectCropRegion,
          setAuraLocked: electronMocks.setAuraLocked,
          showAura: electronMocks.showAura,
        },
      },
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders the disabled add aura page action with its explanation", () => {
    const html = renderToStaticMarkup(<CropEditorActions />);

    expect(html).toContain("Add new aura");
    expect(html).toContain("Add arched aura");
    expect(html).toContain("Lock");
    expect(html).toContain("Unlock");
    expect(html).toContain("Start the selected Path of Exile game");
    expect(html).toContain("disabled");
  });

  it("unlocks the aura overlay before selecting a new aura region", async () => {
    storeMocks.usePoeProcessSelector.mockImplementation((selector) =>
      selector({
        state: createRunningPoe1ProcessState(),
      }),
    );
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CropEditorActions />);
      await Promise.resolve();
    });

    const addButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Add new aura"),
    );

    expect(addButton).toBeDefined();
    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const unlockCallOrder =
      electronMocks.setAuraLocked.mock.invocationCallOrder[0];
    const selectCallOrder =
      electronMocks.selectCropRegion.mock.invocationCallOrder[0];

    expect(storeMocks.setAuraOverlayLocked).toHaveBeenCalledWith(false);
    expect(electronMocks.setAuraLocked).toHaveBeenCalledWith(false);
    expect(unlockCallOrder).toBeDefined();
    expect(selectCallOrder).toBeDefined();
    expect(unlockCallOrder).toBeLessThan(selectCallOrder ?? 0);
    expect(electronMocks.minimize).toHaveBeenCalledTimes(1);
    expect(electronMocks.selectCropRegion).toHaveBeenCalledTimes(1);
    expect(electronMocks.selectCropRegion).toHaveBeenCalledWith({
      shape: "rect",
    });
    expect(storeMocks.updateProfile).toHaveBeenCalledWith({
      id: "profile-1",
      cropRegions: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          label: "Aura 1",
          x: 100,
          y: 120,
          width: 50,
          height: 60,
          referenceWidth: 1920,
          referenceHeight: 1080,
        },
      ],
      overlayPlacements: [
        expect.objectContaining({
          id: "00000000-0000-4000-8000-000000000002",
          cropRegionId: "00000000-0000-4000-8000-000000000001",
          x: 935,
          y: 510,
          scale: 1,
          opacity: 1,
          referenceWidth: 1920,
          referenceHeight: 1080,
        }),
      ],
    });
    expect(storeMocks.selectAura).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(electronMocks.showAura).toHaveBeenCalledTimes(1);
    expect(electronMocks.showAura).toHaveBeenCalledWith("profile-1");
  });

  it("keeps an already unlocked aura overlay unlocked without another lock call", async () => {
    storeMocks.useCropEditorShallow.mockImplementation((selector) =>
      selector({
        auraOverlayLocked: false,
        selectAura: storeMocks.selectAura,
        setAuraOverlayLocked: storeMocks.setAuraOverlayLocked,
      }),
    );
    storeMocks.usePoeProcessSelector.mockImplementation((selector) =>
      selector({
        state: createRunningPoe1ProcessState(),
      }),
    );
    electronMocks.selectCropRegion.mockResolvedValue(null);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CropEditorActions />);
      await Promise.resolve();
    });

    const addButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Add new aura"),
    );

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(storeMocks.setAuraOverlayLocked).not.toHaveBeenCalled();
    expect(electronMocks.setAuraLocked).not.toHaveBeenCalled();
    expect(electronMocks.selectCropRegion).toHaveBeenCalledTimes(1);
    expect(electronMocks.selectCropRegion).toHaveBeenCalledWith({
      shape: "rect",
    });
  });

  it("creates an arched aura from the arched aura action", async () => {
    storeMocks.usePoeProcessSelector.mockImplementation((selector) =>
      selector({
        state: createRunningPoe1ProcessState(),
      }),
    );
    electronMocks.selectCropRegion.mockResolvedValue({
      shape: "arc",
      x: 90,
      y: 90,
      width: 140,
      height: 80,
      arc: {
        startX: 10,
        startY: 70,
        endX: 130,
        endY: 70,
        controlX: 70,
        controlY: 10,
        thickness: 20,
      },
      viewportWidth: 1920,
      viewportHeight: 1080,
    });
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CropEditorActions />);
      await Promise.resolve();
    });

    const addButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Add arched aura"),
    );

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(electronMocks.selectCropRegion).toHaveBeenCalledWith({
      shape: "arc",
    });
    expect(storeMocks.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        cropRegions: [
          expect.objectContaining({
            label: "Arched aura 1",
            shape: "arc",
            arc: expect.objectContaining({
              controlX: 70,
              controlY: 10,
              thickness: 20,
            }),
          }),
        ],
      }),
    );
  });
});
