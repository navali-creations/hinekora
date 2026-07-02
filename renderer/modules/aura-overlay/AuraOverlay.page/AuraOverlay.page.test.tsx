import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Profile } from "~/types";

const storeMocks = vi.hoisted(() => ({
  addAuraRequest: null as {
    requestId: string;
    shape?: "rect" | "arc" | "points";
  } | null,
  addingAuraShape: null as "rect" | "arc" | "points" | null,
  setAddAuraRequest: vi.fn(
    (
      request: {
        requestId: string;
        shape?: "rect" | "arc" | "points";
      } | null,
    ) => {
      storeMocks.addAuraRequest = request;
    },
  ),
  setAddingAuraShape: vi.fn((shape: "rect" | "arc" | "points" | null) => {
    storeMocks.addingAuraShape = shape;
  }),
  useAuraOverlayShallow: vi.fn(),
  updateProfile: vi.fn(),
  useCapturePreviewShallow: vi.fn(),
  useProfilesShallow: vi.fn(),
  useSettingsSelector: vi.fn(),
}));

const electronMocks = vi.hoisted(() => ({
  isAuraLocked: vi.fn(),
  onAuraAddRequested: vi.fn(),
  onAuraLockChanged: vi.fn(),
  selectCropRegion: vi.fn(),
  setAuraLocked: vi.fn(),
  showAura: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useAuraOverlayShallow: storeMocks.useAuraOverlayShallow,
  useCapturePreviewShallow: storeMocks.useCapturePreviewShallow,
  useProfilesShallow: storeMocks.useProfilesShallow,
  useSettingsSelector: storeMocks.useSettingsSelector,
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
    storeMocks.addAuraRequest = null;
    storeMocks.addingAuraShape = null;
    storeMocks.setAddAuraRequest.mockClear();
    storeMocks.setAddAuraRequest.mockImplementation((request) => {
      storeMocks.addAuraRequest = request;
    });
    storeMocks.setAddingAuraShape.mockClear();
    storeMocks.setAddingAuraShape.mockImplementation((shape) => {
      storeMocks.addingAuraShape = shape;
    });
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
      selector({ value: { activeGame: "poe1" } }),
    );
    storeMocks.useAuraOverlayShallow.mockImplementation((selector) =>
      selector({
        addAuraRequest: storeMocks.addAuraRequest,
        setAddAuraRequest: storeMocks.setAddAuraRequest,
        addingAuraShape: storeMocks.addingAuraShape,
        setAddingAuraShape: storeMocks.setAddingAuraShape,
      }),
    );
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
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
    expect(electronMocks.showAura).not.toHaveBeenCalled();
  });

  it("only marks the active add aura shape as selecting", async () => {
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
    expect(storeMocks.setAddAuraRequest).toHaveBeenLastCalledWith(null);
    expect(storeMocks.addAuraRequest).toBeNull();
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
});
