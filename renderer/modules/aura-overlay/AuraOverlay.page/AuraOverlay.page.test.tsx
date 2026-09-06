import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Profile } from "~/types";

const storeMocks = vi.hoisted(() => ({
  preferenceErrors: {},
  settingsValue: { activeGame: "poe1" } as Record<string, unknown>,
  useSettingsShallow: vi.fn(),
  updatePreference: vi.fn(),
  updateProfile: vi.fn(),
  useCapturePreviewShallow: vi.fn(),
  usePoeProcessSelector: vi.fn(),
  useProfilesShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
}));

const electronMocks = vi.hoisted(() => ({
  isAuraLocked: vi.fn(),
  onAuraAddRequested: vi.fn(),
  onAuraLockChanged: vi.fn(),
  reportCaptureFailure: vi.fn(),
  selectCropRegion: vi.fn(),
  setAuraLocked: vi.fn(),
  showAura: vi.fn(),
}));

const captureStreamMocks = vi.hoisted(() => ({
  useDesktopCaptureStream: vi.fn(() => ({
    error: null as string | null,
    isStarting: false,
    stop: vi.fn(),
    stream: null as MediaStream | null,
  })),
}));

vi.mock("~/renderer/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/renderer/store")>();

  return {
    ...actual,
    useCapturePreviewShallow: storeMocks.useCapturePreviewShallow,
    usePoeProcessSelector: storeMocks.usePoeProcessSelector,
    useProfilesShallow: storeMocks.useProfilesShallow,
    useSettingsShallow: storeMocks.useSettingsShallow,
    useSettingsSelector: storeMocks.useSettingsSelector,
  };
});

vi.mock(
  "~/renderer/modules/capture-preview/CapturePreview.hooks/useDesktopCaptureStream/useDesktopCaptureStream",
  () => ({
    useDesktopCaptureStream: captureStreamMocks.useDesktopCaptureStream,
  }),
);

import { useBoundStore } from "~/renderer/store";

import { AuraOverlayPage } from "./AuraOverlay.page";

const profile: Profile = {
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

function createPointerLikeEvent(
  type: string,
  options: MouseEventInit & { pointerId?: number } = {},
): PointerEvent {
  const eventInit: MouseEventInit = {
    bubbles: true,
    button: options.button ?? 0,
  };

  if (options.clientX !== undefined) {
    eventInit.clientX = options.clientX;
  }
  if (options.clientY !== undefined) {
    eventInit.clientY = options.clientY;
  }

  const event = new MouseEvent(type, eventInit) as PointerEvent;
  Object.defineProperty(event, "pointerId", {
    configurable: true,
    value: options.pointerId ?? 1,
  });

  return event;
}

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
    useBoundStore.getState().auraOverlay.setAddAuraRequest(null);
    useBoundStore.getState().auraOverlay.setAddAuraSelectionError(null);
    useBoundStore.getState().auraOverlay.setAddingAuraShape(null);
    useBoundStore.getState().auraOverlay.resetAuraHistory(profile.id);
    storeMocks.preferenceErrors = {};
    storeMocks.settingsValue = { activeGame: "poe1" };
    captureStreamMocks.useDesktopCaptureStream.mockClear();
    captureStreamMocks.useDesktopCaptureStream.mockReturnValue({
      error: null,
      isStarting: false,
      stop: vi.fn(),
      stream: null,
    });
    storeMocks.updatePreference.mockResolvedValue(true);
    window.location.hash = "#/aura-overlay?profileId=profile-1";
    electronMocks.isAuraLocked.mockResolvedValue(true);
    electronMocks.onAuraLockChanged.mockReturnValue(vi.fn());
    electronMocks.onAuraAddRequested.mockReturnValue(vi.fn());
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
    storeMocks.useSettingsSelector.mockImplementation((selector) =>
      selector({ value: storeMocks.settingsValue }),
    );
    storeMocks.useSettingsShallow.mockImplementation((selector) =>
      selector({
        preferenceErrors: storeMocks.preferenceErrors,
        updatePreference: storeMocks.updatePreference,
        value: storeMocks.settingsValue,
      }),
    );
    storeMocks.usePoeProcessSelector.mockImplementation((selector) =>
      selector({ state: { isRunning: false, processName: "" } }),
    );
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        capturePreview: {
          reportFailure: electronMocks.reportCaptureFailure,
        },
        overlayWindows: {
          isAuraLocked: electronMocks.isAuraLocked,
          onAuraAddRequested: electronMocks.onAuraAddRequested,
          onAuraLockChanged: electronMocks.onAuraLockChanged,
          selectCropRegion: electronMocks.selectCropRegion,
          setAuraLocked: electronMocks.setAuraLocked,
          showAura: electronMocks.showAura,
        },
      },
    });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  it("shows profile persistence failures in the overlay", () => {
    storeMocks.useProfilesShallow.mockImplementation((selector) =>
      selector({
        error: "Profile update failed",
        items: [profile],
        selectedProfileId: "profile-1",
        update: storeMocks.updateProfile,
      }),
    );

    const html = renderToStaticMarkup(<AuraOverlayPage />);

    expect(html).toContain('role="alert"');
    expect(html).toContain("Profile update failed");
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount();
      }
    });
    roots = [];
    document.body.replaceChildren();
    delete (
      HTMLElement.prototype as Partial<{
        setPointerCapture: unknown;
      }>
    ).setPointerCapture;
    delete (
      HTMLElement.prototype as Partial<{
        releasePointerCapture: unknown;
      }>
    ).releasePointerCapture;
    delete (
      HTMLElement.prototype as Partial<{
        hasPointerCapture: unknown;
      }>
    ).hasPointerCapture;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("defaults to locked mode without resize handles", () => {
    const html = renderToStaticMarkup(<AuraOverlayPage />);

    expect(html).toContain('data-placement-id="placement-1"');
    expect(html).not.toContain("Life");
    expect(html).not.toContain("data-corner");
    expect(html).not.toContain("Aura controls");
  });

  it("starts bounded recovery for an unavailable game window", () => {
    storeMocks.useCapturePreviewShallow.mockImplementation((selector) =>
      selector({
        selectedSourceId: "missing-window:poe1",
        sources: [
          {
            available: false,
            displayId: null,
            game: "poe1",
            height: null,
            id: "missing-window:poe1",
            kind: "window",
            name: "Path of Exile 1 (not running)",
            thumbnailDataUrl: null,
            width: null,
          },
        ],
      }),
    );

    renderToStaticMarkup(<AuraOverlayPage />);

    expect(captureStreamMocks.useDesktopCaptureStream).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        sourceId: "missing-window:poe1",
      }),
    );
  });

  it("captures the detected running game when the selected app tab differs", () => {
    storeMocks.usePoeProcessSelector.mockImplementation((selector) =>
      selector({
        state: { isRunning: false, processName: "" },
        states: {
          poe1: { game: "poe1", isRunning: false, processName: "" },
          poe2: {
            game: "poe2",
            isRunning: true,
            pid: 42,
            processName: "PathOfExileSteam.exe",
            windowTitle: "Path of Exile 2",
          },
        },
      }),
    );
    storeMocks.useCapturePreviewShallow.mockImplementation((selector) =>
      selector({
        recoverSources: vi.fn(),
        selectedSourceId: "window:poe1",
        sources: [
          {
            game: "poe1",
            id: "window:poe1",
            kind: "window",
            name: "Path of Exile",
          },
          {
            game: "poe2",
            id: "window:poe2",
            kind: "window",
            name: "Path of Exile 2",
          },
        ],
      }),
    );

    renderToStaticMarkup(<AuraOverlayPage />);

    expect(captureStreamMocks.useDesktopCaptureStream).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        sourceId: "window:poe2",
      }),
    );
  });

  it("reports a terminal aura capture failure once", async () => {
    captureStreamMocks.useDesktopCaptureStream.mockReturnValue({
      error: "Could not start video source",
      isStarting: false,
      stop: vi.fn(),
      stream: null,
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    expect(electronMocks.reportCaptureFailure).toHaveBeenCalledOnce();
    expect(electronMocks.reportCaptureFailure).toHaveBeenCalledWith(
      "screen:1",
      "Could not start video source",
    );
  });

  it("shows the aura controls reference while editing", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    expect(container.textContent).toContain("Aura controls");
    expect(container.textContent).toContain("Press");
    expect(container.textContent).toContain("Esc");
    expect(container.textContent).toContain("aura overlay");
    expect(container.textContent).toContain("Ctrl");
    expect(container.textContent).toContain("Default aura");
    expect(container.textContent).toContain("Pointer aura");
  });

  it("hides the full-screen editing frame when disabled in settings", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    storeMocks.settingsValue = {
      activeGame: "poe1",
      auraOverlayShowEditingFrame: false,
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    expect(container.textContent).toContain("Aura controls");
    expect(
      container.querySelector('main[aria-label="Aura overlay"]')?.className,
    ).not.toContain("overlayEditing");
  });

  it("applies the aura label and focused-options visibility preferences", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    storeMocks.settingsValue = {
      activeGame: "poe1",
      auraOverlayHideLabels: true,
      auraOverlayHidePropertiesPanel: true,
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const overlay = container.querySelector('main[aria-label="Aura overlay"]');
    expect(overlay?.className).toContain("overlayHideLabels");
    expect(overlay?.className).toContain("overlayHideProperties");
    expect(container.querySelector("[data-aura-label]")).toBeInstanceOf(
      HTMLSpanElement,
    );
  });

  it("shows the alignment grid only while aura editing is unlocked", async () => {
    storeMocks.settingsValue = {
      activeGame: "poe1",
      auraOverlayShowCenterGuides: false,
      auraOverlayShowEditingGrid: true,
    };
    const lockedHtml = renderToStaticMarkup(<AuraOverlayPage />);
    expect(lockedHtml).not.toContain("auraSelectionGrid");

    electronMocks.isAuraLocked.mockResolvedValue(false);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    expect(
      container.querySelector('main[aria-label="Aura overlay"]')?.className,
    ).toContain("auraSelectionGrid");
    expect(container.querySelector('[data-aura-center-guide="x"]')).toBeNull();
    expect(
      container
        .querySelector('main[aria-label="Aura overlay"]')
        ?.getAttribute("style"),
    ).toContain("background-size: 32px 32px");
  });

  it("shows center lines independently from the editing grid", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    storeMocks.settingsValue = {
      activeGame: "poe1",
      auraOverlayShowCenterGuides: true,
      auraOverlayShowEditingGrid: false,
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    expect(
      container.querySelector('main[aria-label="Aura overlay"]')?.className,
    ).not.toContain("auraSelectionGrid");
    expect(
      container.querySelector('[data-aura-center-guide="x"]'),
    ).toBeInstanceOf(HTMLSpanElement);
    expect(
      container.querySelector('[data-aura-center-guide="y"]'),
    ).toBeInstanceOf(HTMLSpanElement);
  });

  it("snaps dragged auras to the visible editing grid", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    storeMocks.settingsValue = {
      activeGame: "poe1",
      auraOverlayEnableSnapping: true,
      auraOverlayShowEditingGrid: true,
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const auraButton = container.querySelector(
      'button[data-placement-id="placement-1"]',
    );
    expect(auraButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 30,
          clientY: 40,
        }),
      );
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          button: 0,
          clientX: 47,
          clientY: 77,
        }),
      );
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          button: 0,
          clientX: 47,
          clientY: 77,
        }),
      );
      await flushPromises();
    });

    expect(storeMocks.updateProfile).toHaveBeenLastCalledWith({
      id: "profile-1",
      cropRegions: [
        {
          ...profile.cropRegions[0],
          referenceHeight: 1080,
          referenceWidth: 1920,
        },
      ],
      overlayPlacements: [
        {
          ...profile.overlayPlacements[0],
          referenceHeight: 1080,
          referenceWidth: 1920,
          x: 32,
          y: 64,
        },
      ],
    });
  });

  it("keeps free movement when item snapping is disabled", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    storeMocks.settingsValue = {
      activeGame: "poe1",
      auraOverlayEnableSnapping: false,
      auraOverlayShowEditingGrid: true,
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const auraButton = container.querySelector(
      'button[data-placement-id="placement-1"]',
    );
    await act(async () => {
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 30,
          clientY: 40,
        }),
      );
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          button: 0,
          clientX: 47,
          clientY: 77,
        }),
      );
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          button: 0,
          clientX: 47,
          clientY: 77,
        }),
      );
      await flushPromises();
    });

    expect(storeMocks.updateProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overlayPlacements: [
          expect.objectContaining({
            x: 47,
            y: 77,
          }),
        ],
      }),
    );
  });

  it("projects legacy aura placements into the centered ultrawide safe area", async () => {
    storeMocks.useCapturePreviewShallow.mockImplementation((selector) =>
      selector({
        selectedSourceId: "screen:1",
        sources: [{ id: "screen:1", width: 3440, height: 1440 }],
      }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const auraFrame = container.querySelector(
      'div[data-placement-id="placement-1"]',
    );

    expect(auraFrame).toBeInstanceOf(HTMLDivElement);
    const style = (auraFrame as HTMLDivElement).style;
    expect(style.left).toBe("480px");
    expect(Number.parseFloat(style.top)).toBeCloseTo(160 / 3);
    expect(Number.parseFloat(style.width)).toBeCloseTo(400 / 3);
    expect(Number.parseFloat(style.height)).toBeCloseTo(160 / 3);
  });

  it("drags legacy ultrawide auras back into reference coordinates", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    storeMocks.useCapturePreviewShallow.mockImplementation((selector) =>
      selector({
        selectedSourceId: "screen:1",
        sources: [{ id: "screen:1", width: 3440, height: 1440 }],
      }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const auraButton = container.querySelector(
      'button[data-placement-id="placement-1"]',
    );
    expect(auraButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 480,
          clientY: 54,
        }),
      );
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          button: 0,
          clientX: 520,
          clientY: 54,
        }),
      );
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          button: 0,
          clientX: 520,
          clientY: 54,
        }),
      );
      await flushPromises();
    });

    expect(storeMocks.updateProfile).toHaveBeenLastCalledWith({
      id: "profile-1",
      cropRegions: [
        {
          ...profile.cropRegions[0],
          referenceWidth: 1920,
          referenceHeight: 1080,
        },
      ],
      overlayPlacements: [
        {
          ...profile.overlayPlacements[0],
          x: 60,
          y: 40,
          referenceWidth: 1920,
          referenceHeight: 1080,
        },
      ],
    });
  });

  it("keeps a dragged aura at the released position while saving", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    storeMocks.useCapturePreviewShallow.mockImplementation((selector) =>
      selector({
        selectedSourceId: "screen:1",
        sources: [{ id: "screen:1", width: 3440, height: 1440 }],
      }),
    );
    let resolveProfileUpdate: (() => void) | null = null;
    storeMocks.updateProfile.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveProfileUpdate = resolve;
        }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const auraFrame = container.querySelector(
      'div[data-placement-id="placement-1"]',
    );
    const auraButton = container.querySelector(
      'button[data-placement-id="placement-1"]',
    );
    expect(auraFrame).toBeInstanceOf(HTMLDivElement);
    expect(auraButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 480,
          clientY: 54,
        }),
      );
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          button: 0,
          clientX: 520,
          clientY: 54,
        }),
      );
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          button: 0,
          clientX: 520,
          clientY: 54,
        }),
      );
      await flushPromises();
    });

    expect((auraFrame as HTMLDivElement).style.left).toBe("520px");
    expect(storeMocks.updateProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          button: 0,
          clientX: 700,
          clientY: 54,
        }),
      );
      await flushPromises();
    });

    expect((auraFrame as HTMLDivElement).style.left).toBe("520px");
    expect(storeMocks.updateProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 520,
          clientY: 54,
        }),
      );
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          button: 0,
          clientX: 700,
          clientY: 54,
        }),
      );
      auraButton?.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          button: 0,
          clientX: 700,
          clientY: 54,
        }),
      );
      await flushPromises();
    });

    expect((auraFrame as HTMLDivElement).style.left).toBe("520px");
    expect(storeMocks.updateProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveProfileUpdate?.();
      await flushPromises();
    });
  });

  it("resizes legacy ultrawide auras without splitting crop and placement references", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    storeMocks.useCapturePreviewShallow.mockImplementation((selector) =>
      selector({
        selectedSourceId: "screen:1",
        sources: [{ id: "screen:1", width: 3440, height: 1440 }],
      }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const resizeHandle = container.querySelector(
      'span[data-placement-id="placement-1"][data-corner="se"]',
    );
    expect(resizeHandle).toBeInstanceOf(HTMLSpanElement);

    await act(async () => {
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 614,
          clientY: 107,
        }),
      );
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          button: 0,
          clientX: 654,
          clientY: 108,
        }),
      );
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          button: 0,
          clientX: 654,
          clientY: 108,
        }),
      );
      await flushPromises();
    });

    expect(storeMocks.updateProfile).toHaveBeenLastCalledWith({
      id: "profile-1",
      cropRegions: [
        {
          ...profile.cropRegions[0],
          referenceWidth: 1920,
          referenceHeight: 1080,
        },
      ],
      overlayPlacements: [
        {
          ...profile.overlayPlacements[0],
          scale: 1.3,
          referenceWidth: 1920,
          referenceHeight: 1080,
        },
      ],
    });
  });

  it("snaps an aura resize to a peer aura scale", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    storeMocks.settingsValue = {
      activeGame: "poe1",
      auraOverlayEnableSnapping: true,
    };
    const profileWithPeerScale: Profile = {
      ...profile,
      overlayPlacements: [
        profile.overlayPlacements[0]!,
        {
          ...profile.overlayPlacements[0]!,
          id: "placement-2",
          scale: 1.5,
          x: 300,
        },
      ],
    };
    storeMocks.useProfilesShallow.mockImplementation((selector) =>
      selector({
        items: [profileWithPeerScale],
        selectedProfileId: "profile-1",
        update: storeMocks.updateProfile,
      }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const resizeHandle = container.querySelector(
      'span[data-placement-id="placement-1"][data-corner="se"]',
    );
    await act(async () => {
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 130,
          clientY: 80,
        }),
      );
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          button: 0,
          clientX: 177,
          clientY: 99,
        }),
      );
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          button: 0,
          clientX: 177,
          clientY: 99,
        }),
      );
      await flushPromises();
    });

    expect(storeMocks.updateProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overlayPlacements: [
          expect.objectContaining({ id: "placement-1", scale: 1.5 }),
          expect.objectContaining({ id: "placement-2", scale: 1.5 }),
        ],
      }),
    );
  });

  it("keeps a resized aura at the released size while saving", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    storeMocks.useCapturePreviewShallow.mockImplementation((selector) =>
      selector({
        selectedSourceId: "screen:1",
        sources: [{ id: "screen:1", width: 3440, height: 1440 }],
      }),
    );
    let resolveProfileUpdate: (() => void) | null = null;
    storeMocks.updateProfile.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveProfileUpdate = resolve;
        }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const auraFrame = container.querySelector(
      'div[data-placement-id="placement-1"]',
    );
    const resizeHandle = container.querySelector(
      'span[data-placement-id="placement-1"][data-corner="se"]',
    );
    expect(auraFrame).toBeInstanceOf(HTMLDivElement);
    expect(resizeHandle).toBeInstanceOf(HTMLSpanElement);

    await act(async () => {
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 614,
          clientY: 107,
        }),
      );
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          button: 0,
          clientX: 654,
          clientY: 108,
        }),
      );
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          button: 0,
          clientX: 654,
          clientY: 108,
        }),
      );
      await flushPromises();
    });

    const releasedWidth = (auraFrame as HTMLDivElement).style.width;
    expect(storeMocks.updateProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          button: 0,
          clientX: 760,
          clientY: 140,
        }),
      );
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          button: 0,
          clientX: 760,
          clientY: 140,
        }),
      );
      await flushPromises();
    });

    expect((auraFrame as HTMLDivElement).style.width).toBe(releasedWidth);
    expect(storeMocks.updateProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveProfileUpdate?.();
      await flushPromises();
    });
  });

  it("does not save a resize when the handle is released without movement", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const resizeHandle = container.querySelector(
      'span[data-placement-id="placement-1"][data-corner="se"]',
    );
    expect(resizeHandle).toBeInstanceOf(HTMLSpanElement);

    await act(async () => {
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 130,
          clientY: 80,
        }),
      );
      resizeHandle?.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          button: 0,
          clientX: 130,
          clientY: 80,
        }),
      );
      await flushPromises();
    });

    expect(storeMocks.updateProfile).not.toHaveBeenCalled();
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
    let currentProfile = structuredClone(profile);
    storeMocks.updateProfile.mockImplementation(async (input) => {
      currentProfile = { ...currentProfile, ...input };
    });
    storeMocks.useProfilesShallow.mockImplementation((selector) =>
      selector({
        items: [currentProfile],
        selectedProfileId: "profile-1",
        update: storeMocks.updateProfile,
      }),
    );
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
          referenceWidth: 1920,
          referenceHeight: 1080,
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
          referenceWidth: 1920,
          referenceHeight: 1080,
        }),
      ],
    });
    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });
    expect(
      container
        .querySelector(
          'nav[aria-label="Aura placements"] button[data-placement-id="00000000-0000-4000-8000-000000000002"]',
        )
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(electronMocks.showAura).not.toHaveBeenCalled();
  });

  it("keeps the selected aura visible while preparing a new selection", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    let resolveSelection: ((selection: null) => void) | null = null;
    electronMocks.selectCropRegion.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveSelection = resolve;
        }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const existingAura = container.querySelector(
      'button[data-placement-id="placement-1"]',
    );
    await act(async () => {
      existingAura?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });
    expect(
      container.querySelector('[aria-label="Aura placement properties"]'),
    ).toBeInstanceOf(HTMLElement);

    const archedButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add arched aura",
    );
    expect(archedButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      archedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });
    expect(
      container.querySelector('[aria-label="Aura placement properties"]'),
    ).toBeInstanceOf(HTMLElement);
    expect(container.textContent).toContain("Preparing selection overlay…");
    expect(container.querySelector('[aria-busy="true"]')).toBeInstanceOf(
      HTMLElement,
    );

    const buttons = [...container.querySelectorAll("button")];
    const selectingButtons = buttons.filter(
      (button) => button.textContent === "Selecting...",
    );
    const addNewButton = buttons.find(
      (button) => button.textContent === "Add new aura",
    );
    const addPointerButton = buttons.find(
      (button) => button.textContent === "Add pointer aura",
    );
    const lockButton = buttons.find(
      (button) => button.textContent === "Lock auras",
    );

    expect(selectingButtons).toHaveLength(1);
    expect(addNewButton).toBeInstanceOf(HTMLButtonElement);
    expect(addPointerButton).toBeInstanceOf(HTMLButtonElement);
    expect(lockButton).toBeInstanceOf(HTMLButtonElement);
    expect((selectingButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((addNewButton as HTMLButtonElement).disabled).toBe(true);
    expect((addPointerButton as HTMLButtonElement).disabled).toBe(true);
    expect((lockButton as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      resolveSelection?.(null);
      await flushPromises();
    });
    expect(container.textContent).not.toContain("Preparing selection overlay…");
    expect(
      container.querySelector('[aria-label="Aura placement properties"]'),
    ).toBeInstanceOf(HTMLElement);
  });

  it("shows an error when the selection overlay cannot be prepared", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    electronMocks.selectCropRegion.mockRejectedValue(
      new Error("Renderer unavailable"),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const addAuraButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add new aura",
    );
    await act(async () => {
      addAuraButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(container.textContent).toContain(
      "Could not prepare the selection overlay. Please try again.",
    );
    expect(container.textContent).not.toContain("Preparing selection overlay…");
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
          referenceWidth: 1920,
          referenceHeight: 1080,
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
          referenceWidth: 1920,
          referenceHeight: 1080,
        }),
      ],
    });
    expect(electronMocks.showAura).not.toHaveBeenCalled();
  });

  it("starts add aura selection from an overlay event without reloading", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    electronMocks.selectCropRegion.mockResolvedValue({
      x: 100,
      y: 120,
      width: 50,
      height: 60,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });
    let handleAuraAddRequested:
      | ((request: {
          requestId: string;
          shape?: "rect" | "arc" | "points";
        }) => void)
      | null = null;
    electronMocks.onAuraAddRequested.mockImplementation((callback) => {
      handleAuraAddRequested = callback;
      return vi.fn();
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

    expect(handleAuraAddRequested).toBeTypeOf("function");
    await act(async () => {
      handleAuraAddRequested?.({ requestId: "request-1", shape: "rect" });
      await flushPromises();
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    expect(electronMocks.selectCropRegion).toHaveBeenCalledTimes(1);
    expect(electronMocks.selectCropRegion).toHaveBeenCalledWith({
      shape: "rect",
    });
    expect(useBoundStore.getState().auraOverlay.addAuraRequest).toBeNull();
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
          referenceWidth: 1920,
          referenceHeight: 1080,
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
          referenceWidth: 1920,
          referenceHeight: 1080,
        }),
      ],
    });
    expect(electronMocks.showAura).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    roots = roots.filter((item) => item !== root);

    const secondContainer = document.createElement("div");
    document.body.append(secondContainer);
    const secondRoot = createTestRoot(secondContainer);

    await act(async () => {
      secondRoot.render(<AuraOverlayPage />);
      await flushPromises();
    });

    expect(electronMocks.selectCropRegion).toHaveBeenCalledTimes(1);
  });

  it("locks auras when a route-started add aura selection is canceled", async () => {
    window.location.hash =
      "#/aura-overlay?profileId=profile-1&startAddingAura=1&addAuraRequestId=1";
    electronMocks.isAuraLocked.mockResolvedValue(false);
    electronMocks.selectCropRegion.mockResolvedValue(null);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    expect(electronMocks.selectCropRegion).toHaveBeenCalledTimes(1);
    expect(electronMocks.setAuraLocked).toHaveBeenCalledWith(true);
    expect(storeMocks.updateProfile).not.toHaveBeenCalled();
    expect(electronMocks.showAura).not.toHaveBeenCalled();
  });

  it("locks the focused aura overlay with Escape", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
      await flushPromises();
    });

    expect(electronMocks.setAuraLocked).toHaveBeenCalledWith(true);
  });

  it("shows a transient game handoff hint when auras lock", async () => {
    vi.useFakeTimers();
    electronMocks.isAuraLocked.mockResolvedValue(false);
    let handleAuraLockChanged: ((locked: boolean) => void) | null = null;
    electronMocks.onAuraLockChanged.mockImplementation(
      (callback: (locked: boolean) => void) => {
        handleAuraLockChanged = callback;
        return vi.fn();
      },
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    expect(container.textContent).not.toContain("Auras locked");
    if (!handleAuraLockChanged) {
      throw new Error("Expected aura lock listener to be registered");
    }
    const notifyAuraLockChanged = handleAuraLockChanged as (
      locked: boolean,
    ) => void;

    act(() => {
      notifyAuraLockChanged(true);
    });

    expect(container.textContent).toContain("Auras locked");
    expect(container.textContent).toContain(
      "Click the game to resume control.",
    );

    act(() => {
      vi.advanceTimersByTime(2_999);
    });

    expect(container.textContent).toContain("Auras locked");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(container.textContent).not.toContain("Auras locked");
  });

  it("deletes the selected aura with Delete", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const auraButton = container.querySelector(
      'button[data-placement-id="placement-1"]',
    );
    expect(auraButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      auraButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Delete" }),
      );
      await flushPromises();
    });

    expect(storeMocks.updateProfile).toHaveBeenLastCalledWith({
      id: "profile-1",
      cropRegions: [],
      overlayPlacements: [],
    });
    expect(electronMocks.showAura).not.toHaveBeenCalled();
  });

  it("undoes and redoes aura deletes from keyboard history", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    let currentProfile: Profile = structuredClone(profile);
    storeMocks.updateProfile.mockImplementation(async (input) => {
      currentProfile = {
        ...currentProfile,
        ...input,
      };
    });
    storeMocks.useProfilesShallow.mockImplementation((selector) =>
      selector({
        items: [currentProfile],
        selectedProfileId: "profile-1",
        update: storeMocks.updateProfile,
      }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    const auraButton = container.querySelector(
      'button[data-placement-id="placement-1"]',
    );
    await act(async () => {
      auraButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Delete" }),
      );
      await flushPromises();
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });
    expect(currentProfile.overlayPlacements).toEqual([]);

    storeMocks.updateProfile.mockRejectedValueOnce(new Error("write failed"));
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "z",
        }),
      );
      await flushPromises();
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });
    expect(currentProfile.overlayPlacements).toEqual([]);
    expect(
      useBoundStore.getState().auraOverlay.editingHistory.undo,
    ).toHaveLength(1);

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "z",
        }),
      );
      await flushPromises();
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });
    expect(currentProfile.cropRegions).toEqual(profile.cropRegions);
    expect(currentProfile.overlayPlacements).toEqual(profile.overlayPlacements);

    storeMocks.updateProfile.mockRejectedValueOnce(new Error("write failed"));
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "y",
        }),
      );
      await flushPromises();
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });
    expect(currentProfile.overlayPlacements).toEqual(profile.overlayPlacements);
    expect(
      useBoundStore.getState().auraOverlay.editingHistory.redo,
    ).toHaveLength(1);

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "y",
        }),
      );
      await flushPromises();
    });
    expect(currentProfile.cropRegions).toEqual([]);
    expect(currentProfile.overlayPlacements).toEqual([]);
    expect(electronMocks.showAura).not.toHaveBeenCalled();
  });

  it("keeps the focused aura selected while applying history", async () => {
    electronMocks.isAuraLocked.mockResolvedValue(false);
    const secondCrop = {
      height: 40,
      id: "crop-2",
      label: "Mana",
      width: 100,
      x: 120,
      y: 20,
    };
    const secondPlacement = {
      cropRegionId: secondCrop.id,
      id: "placement-2",
      opacity: 1,
      scale: 1,
      x: 150,
      y: 40,
    };
    let currentProfile: Profile = {
      ...structuredClone(profile),
      cropRegions: [...structuredClone(profile.cropRegions), secondCrop],
      overlayPlacements: [
        ...structuredClone(profile.overlayPlacements),
        secondPlacement,
      ],
    };
    storeMocks.updateProfile.mockImplementation(async (input) => {
      currentProfile = { ...currentProfile, ...input };
    });
    storeMocks.useProfilesShallow.mockImplementation((selector) =>
      selector({
        items: [currentProfile],
        selectedProfileId: currentProfile.id,
        update: storeMocks.updateProfile,
      }),
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createTestRoot(container);

    await act(async () => {
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          'button[data-placement-id="placement-2"]',
        )
        ?.click();
      useBoundStore.getState().auraOverlay.recordAuraHistory(currentProfile);
      currentProfile = {
        ...currentProfile,
        overlayPlacements: currentProfile.overlayPlacements.map((placement) =>
          placement.id === secondPlacement.id
            ? { ...placement, x: 300 }
            : placement,
        ),
      };
      root.render(<AuraOverlayPage />);
      await flushPromises();
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "z",
        }),
      );
      await flushPromises();
    });

    expect(useBoundStore.getState().auraOverlay.selectedPlacementId).toBe(
      secondPlacement.id,
    );
    expect(
      currentProfile.overlayPlacements.find(
        (placement) => placement.id === secondPlacement.id,
      )?.x,
    ).toBe(secondPlacement.x);
  });
});
