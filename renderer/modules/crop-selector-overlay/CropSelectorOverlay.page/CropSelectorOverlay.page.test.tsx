import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const overlayWindowsMocks = vi.hoisted(() => ({
  cancelCropRegionSelection: vi.fn(),
  completeCropRegionSelection: vi.fn(),
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: vi.fn(),
}));

import { CropSelectorOverlayPage } from "./CropSelectorOverlay.page";

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

describe("CropSelectorOverlayPage", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "#/crop-overlay?shape=arc";
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        overlayWindows: {
          cancelCropRegionSelection:
            overlayWindowsMocks.cancelCropRegionSelection,
          completeCropRegionSelection:
            overlayWindowsMocks.completeCropRegionSelection,
        },
      },
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("completes an arched selection from A, B, and C clicks", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<CropSelectorOverlayPage />);
    });

    const overlay = container.querySelector('main[aria-label="Crop selector"]');
    expect(overlay).toBeInstanceOf(HTMLElement);

    await act(async () => {
      overlay?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          clientX: 50,
          clientY: 50,
        }),
      );
    });
    expect(container.textContent).not.toContain("A");

    await act(async () => {
      overlay?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 100,
          clientY: 160,
        }),
      );
    });
    expect(container.textContent).toContain("A");

    await act(async () => {
      overlay?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 220,
          clientY: 160,
        }),
      );
    });
    expect(container.textContent).toContain("B");

    await act(async () => {
      overlay?.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          clientX: 160,
          clientY: 100,
        }),
      );
      overlay?.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 160,
          clientY: 100,
        }),
      );
    });

    expect(
      overlayWindowsMocks.completeCropRegionSelection,
    ).toHaveBeenCalledWith({
      arc: {
        controlX: 70,
        controlY: 10,
        endX: 130,
        endY: 70,
        startX: 10,
        startY: 70,
        thickness: 20,
      },
      height: 80,
      shape: "arc",
      width: 140,
      x: 90,
      y: 90,
    });
  });
});
