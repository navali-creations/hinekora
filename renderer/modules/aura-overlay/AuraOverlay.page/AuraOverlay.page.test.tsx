import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  useCapturePreviewShallow: vi.fn(),
  useProfilesShallow: vi.fn(),
}));

const electronMocks = vi.hoisted(() => ({
  isAuraLocked: vi.fn(),
  onAuraLockChanged: vi.fn(),
  previewAuraPlacement: vi.fn(),
  selectCropRegion: vi.fn(),
  setAuraLocked: vi.fn(),
  showAura: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useCapturePreviewShallow: storeMocks.useCapturePreviewShallow,
  useProfilesShallow: storeMocks.useProfilesShallow,
}));

vi.mock(
  "~/renderer/modules/capture-preview/CapturePreview.hooks/useDesktopCaptureStream/useDesktopCaptureStream",
  () => ({
    useDesktopCaptureStream: () => ({
      error: null,
      isStarting: false,
      stop: vi.fn(),
      stream: null,
    }),
  }),
);

import { AuraOverlayPage } from "./AuraOverlay.page";

const profile = {
  id: "profile-1",
  name: "Default",
  game: "poe1",
  targetFps: 30,
  captureTarget: null,
  cropRegions: [
    {
      id: "crop-1",
      label: "Life",
      x: 10,
      y: 20,
      width: 100,
      height: 40,
    },
  ],
  overlayPlacements: [
    {
      id: "placement-1",
      cropRegionId: "crop-1",
      x: 30,
      y: 40,
      scale: 1,
      opacity: 1,
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

async function flushPromises(count = 5): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

describe("AuraOverlayPage", () => {
  let roots: Root[] = [];

  const createTestRoot = (container: HTMLElement): Root => {
    const root = createRoot(container);
    roots.push(root);

    return root;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "#/aura-overlay?profileId=profile-1";
    electronMocks.isAuraLocked.mockResolvedValue(true);
    electronMocks.onAuraLockChanged.mockReturnValue(vi.fn());
    electronMocks.previewAuraPlacement.mockResolvedValue(undefined);
    electronMocks.selectCropRegion.mockResolvedValue(null);
    electronMocks.setAuraLocked.mockResolvedValue(undefined);
    electronMocks.showAura.mockResolvedValue(undefined);
    storeMocks.updateProfile.mockResolvedValue(undefined);
    storeMocks.useProfilesShallow.mockImplementation((selector) =>
      selector({
        items: [profile],
        selectedProfileId: "profile-1",
        update: storeMocks.updateProfile,
      }),
    );
    storeMocks.useCapturePreviewShallow.mockImplementation((selector) =>
      selector({
        selectedSourceId: "screen:1",
        sources: [{ id: "screen:1", width: 1920, height: 1080 }],
      }),
    );
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        overlayWindows: {
          isAuraLocked: electronMocks.isAuraLocked,
          onAuraLockChanged: electronMocks.onAuraLockChanged,
          previewAuraPlacement: electronMocks.previewAuraPlacement,
          selectCropRegion: electronMocks.selectCropRegion,
          setAuraLocked: electronMocks.setAuraLocked,
          showAura: electronMocks.showAura,
        },
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount();
      }
    });
    roots = [];
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("defaults to locked mode without resize handles", () => {
    const html = renderToStaticMarkup(<AuraOverlayPage />);

    expect(html).toContain('data-placement-id="placement-1"');
    expect(html).not.toContain("Life");
    expect(html).not.toContain("data-corner");
  });

  it("adds a new aura from the unlocked overlay banner", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    electronMocks.selectCropRegion.mockResolvedValue({
      x: 100,
      y: 120,
      width: 50,
      height: 60,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const addButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add new aura",
    );

    expect(addButton).toBeDefined();
    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(electronMocks.selectCropRegion).toHaveBeenCalledTimes(1);
    expect(storeMocks.updateProfile).toHaveBeenCalledWith({
      id: "profile-1",
      cropRegions: [
        profile.cropRegions[0],
        {
          id: "00000000-0000-4000-8000-000000000001",
          label: "Aura 2",
          x: 100,
          y: 120,
          width: 50,
          height: 60,
        },
      ],
      overlayPlacements: [
        profile.overlayPlacements[0],
        expect.objectContaining({
          id: "00000000-0000-4000-8000-000000000002",
          cropRegionId: "00000000-0000-4000-8000-000000000001",
          x: 953,
          y: 528,
          scale: 1,
          opacity: 1,
        }),
      ],
    });
    expect(electronMocks.showAura).toHaveBeenCalledWith("profile-1");
  });

  it("starts add aura selection from the route request", async () => {
    window.location.hash =
      "#/aura-overlay?profileId=profile-1&startAddingAura=1&addAuraRequestId=1";
    electronMocks.isAuraLocked.mockResolvedValue(false);
    electronMocks.selectCropRegion.mockResolvedValue({
      x: 100,
      y: 120,
      width: 50,
      height: 60,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    expect(electronMocks.selectCropRegion).toHaveBeenCalledTimes(1);
    expect(storeMocks.updateProfile).toHaveBeenCalledWith({
      id: "profile-1",
      cropRegions: [
        profile.cropRegions[0],
        {
          id: "00000000-0000-4000-8000-000000000001",
          label: "Aura 2",
          x: 100,
          y: 120,
          width: 50,
          height: 60,
        },
      ],
      overlayPlacements: [
        profile.overlayPlacements[0],
        expect.objectContaining({
          id: "00000000-0000-4000-8000-000000000002",
          cropRegionId: "00000000-0000-4000-8000-000000000001",
          x: 953,
          y: 528,
          scale: 1,
          opacity: 1,
        }),
      ],
    });
    expect(electronMocks.showAura).toHaveBeenCalledWith("profile-1");
  });
});
