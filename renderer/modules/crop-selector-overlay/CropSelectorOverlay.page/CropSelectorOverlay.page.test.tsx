import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const overlayWindowsMocks = vi.hoisted(() => ({
  cancelCropRegionSelection: vi.fn(),
  completeCropRegionSelection: vi.fn(),
}));

import { CropSelectorOverlayPage } from "./CropSelectorOverlay.page";

function setCropSelectorShape(shape: "arc" | "points" | "rect"): void {
  window.location.hash = `#/crop-overlay?shape=${shape}`;
}

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

function createContextMenuEvent(): MouseEvent {
  return new MouseEvent("contextmenu", {
    bubbles: true,
    button: 2,
  });
}

async function renderCropSelectorPage(
  shape: "arc" | "points" | "rect",
): Promise<{ container: HTMLDivElement; overlay: HTMLElement; root: Root }> {
  setCropSelectorShape(shape);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<CropSelectorOverlayPage />);
  });

  const overlay = container.querySelector('main[aria-label="Crop selector"]');
  expect(overlay).toBeInstanceOf(HTMLElement);

  return { container, overlay: overlay as HTMLElement, root };
}

function readPointLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('span[class*="pointLabel"]')].map(
    (label) => label.textContent ?? "",
  );
}

describe("CropSelectorOverlayPage", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
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
    const rendered = await renderCropSelectorPage("arc");
    root = rendered.root;
    const { container, overlay } = rendered;

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          clientX: 50,
          clientY: 50,
        }),
      );
    });
    expect(readPointLabels(container)).not.toContain("A");

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 100,
          clientY: 160,
        }),
      );
    });
    expect(readPointLabels(container)).toContain("A");

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 220,
          clientY: 160,
        }),
      );
    });
    expect(readPointLabels(container)).toContain("B");

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          clientX: 160,
          clientY: 100,
        }),
      );
      overlay.dispatchEvent(
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

  it("shows grid selector controls for the active selection type", async () => {
    const rendered = await renderCropSelectorPage("points");
    root = rendered.root;
    const { container } = rendered;

    expect(container.textContent).toContain("Grid selector");
    expect(container.textContent).toContain("Active mode:");
    expect(container.textContent).toContain("Pointer aura");
    expect(container.textContent).toContain("Right click");
    expect(container.textContent).toContain("Press");
    expect(container.textContent).toContain("Esc");
    expect(container.textContent).toContain("grid selector");
    expect(container.querySelector(".kbd")).toBeInstanceOf(HTMLElement);
    expect(
      container
        .querySelector('main[aria-label="Crop selector"]')
        ?.getAttribute("style"),
    ).toContain("background-size: 32px 32px");
  });

  it("resets an arched selection with right click without closing the overlay", async () => {
    const rendered = await renderCropSelectorPage("arc");
    root = rendered.root;
    const { overlay } = rendered;

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 100,
          clientY: 160,
        }),
      );
    });

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 220,
          clientY: 160,
        }),
      );
    });

    await act(async () => {
      overlay.dispatchEvent(createContextMenuEvent());
    });

    expect(
      overlayWindowsMocks.cancelCropRegionSelection,
    ).not.toHaveBeenCalled();

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 300,
          clientY: 300,
        }),
      );
    });

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 420,
          clientY: 300,
        }),
      );
    });

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 360,
          clientY: 240,
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
      x: 290,
      y: 230,
    });
  });

  it("completes a pointer selection with Enter", async () => {
    const rendered = await renderCropSelectorPage("points");
    root = rendered.root;
    const { container, overlay } = rendered;

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 100,
          clientY: 120,
        }),
      );
    });

    expect(container.textContent).toContain("1");

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          clientX: 140,
          clientY: 180,
        }),
      );
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 140,
          clientY: 180,
        }),
      );
    });

    expect(container.textContent).toContain("2");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });

    expect(
      overlayWindowsMocks.completeCropRegionSelection,
    ).toHaveBeenCalledWith({
      height: 80,
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 70 },
      ],
      shape: "points",
      width: 60,
      x: 90,
      y: 110,
    });
  });

  it("completes a pointer selection below the point limit with Escape", async () => {
    const rendered = await renderCropSelectorPage("points");
    root = rendered.root;
    const { overlay } = rendered;

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          clientX: 100,
          clientY: 120,
        }),
      );
    });
    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          clientX: 140,
          clientY: 180,
        }),
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(
      overlayWindowsMocks.completeCropRegionSelection,
    ).toHaveBeenCalledWith({
      height: 80,
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 70 },
      ],
      shape: "points",
      width: 60,
      x: 90,
      y: 110,
    });
  });

  it("resets a pointer selection with right click without closing the overlay", async () => {
    const rendered = await renderCropSelectorPage("points");
    root = rendered.root;
    const { overlay } = rendered;

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 100,
          clientY: 120,
        }),
      );
    });

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 140,
          clientY: 180,
        }),
      );
      overlay.dispatchEvent(createContextMenuEvent());
    });

    expect(
      overlayWindowsMocks.cancelCropRegionSelection,
    ).not.toHaveBeenCalled();

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 300,
          clientY: 320,
        }),
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });

    expect(
      overlayWindowsMocks.completeCropRegionSelection,
    ).toHaveBeenCalledWith({
      height: 20,
      points: [{ x: 10, y: 10 }],
      shape: "points",
      width: 20,
      x: 290,
      y: 310,
    });
  });

  it("cancels the selection with Escape", async () => {
    const rendered = await renderCropSelectorPage("points");
    root = rendered.root;

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(
      overlayWindowsMocks.cancelCropRegionSelection,
    ).toHaveBeenCalledOnce();
  });

  it("completes a rectangular drag selection", async () => {
    const rendered = await renderCropSelectorPage("rect");
    root = rendered.root;
    const { overlay } = rendered;
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperty(overlay, "setPointerCapture", {
      configurable: true,
      value: setPointerCapture,
    });
    Object.defineProperty(overlay, "releasePointerCapture", {
      configurable: true,
      value: releasePointerCapture,
    });

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 120,
          clientY: 140,
          pointerId: 7,
        }),
      );
    });

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointermove", {
          clientX: 180,
          clientY: 210,
          pointerId: 7,
        }),
      );
    });

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerup", {
          clientX: 180,
          clientY: 210,
          pointerId: 7,
        }),
      );
    });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(
      overlayWindowsMocks.completeCropRegionSelection,
    ).toHaveBeenCalledWith({
      height: 70,
      width: 60,
      x: 120,
      y: 140,
    });
  });

  it("resets a rectangular drag with right click and releases pointer capture", async () => {
    const rendered = await renderCropSelectorPage("rect");
    root = rendered.root;
    const { overlay } = rendered;
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const hasPointerCapture = vi.fn(() => true);
    Object.defineProperty(overlay, "setPointerCapture", {
      configurable: true,
      value: setPointerCapture,
    });
    Object.defineProperty(overlay, "releasePointerCapture", {
      configurable: true,
      value: releasePointerCapture,
    });
    Object.defineProperty(overlay, "hasPointerCapture", {
      configurable: true,
      value: hasPointerCapture,
    });

    await act(async () => {
      overlay.dispatchEvent(
        createPointerLikeEvent("pointerdown", {
          button: 0,
          clientX: 120,
          clientY: 140,
          pointerId: 9,
        }),
      );
    });

    await act(async () => {
      overlay.dispatchEvent(createContextMenuEvent());
    });

    expect(setPointerCapture).toHaveBeenCalledWith(9);
    expect(hasPointerCapture).toHaveBeenCalledWith(9);
    expect(releasePointerCapture).toHaveBeenCalledWith(9);
    expect(
      overlayWindowsMocks.cancelCropRegionSelection,
    ).not.toHaveBeenCalled();
    expect(
      overlayWindowsMocks.completeCropRegionSelection,
    ).not.toHaveBeenCalled();
  });
});
