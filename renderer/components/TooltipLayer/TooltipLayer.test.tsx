import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipLayer } from "./TooltipLayer";

let container: HTMLDivElement;
let root: Root;
let trigger: HTMLButtonElement;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  trigger = document.createElement("button");
  trigger.className = "tooltip tooltip-left";
  trigger.dataset.tip = "Storage is almost full";
  trigger.setAttribute("aria-describedby", "existing-description");
  container.append(trigger);
  await act(async () => root.render(<TooltipLayer />));
  document.body.append(trigger);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("TooltipLayer", () => {
  it("follows a focused anchor when its position changes and stops tracking on dismissal", async () => {
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    const cancel = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});
    let left = 300;
    trigger.getBoundingClientRect = () => new DOMRect(left, 100, 20, 20);
    await act(async () => trigger.focus());
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');
    const initialLeft = tooltip?.style.left;
    left = 600;
    await act(async () => frame?.(0));
    expect(tooltip?.style.left).not.toBe(initialLeft);
    await act(async () => trigger.blur());
    expect(cancel).toHaveBeenCalledWith(1);
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
  it("preserves the tooltip's theme color", async () => {
    trigger.classList.add("tooltip-primary");
    await act(async () => trigger.focus());
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');
    expect(tooltip?.style.backgroundColor).toBe("var(--color-primary)");
    expect(tooltip?.style.color).toBe("var(--color-primary-content)");
  });

  it("renders hovered help outside its clipping container and dismisses on leave", async () => {
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    });
    const tooltip = document.querySelector('[role="tooltip"]');

    expect(tooltip?.textContent).toBe("Storage is almost full");
    expect(tooltip?.parentElement).toBe(document.body);
    expect(trigger.getAttribute("aria-describedby")).toContain(tooltip?.id);
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
    });
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(trigger.getAttribute("aria-describedby")).toBe(
      "existing-description",
    );
  });

  it("supports keyboard focus, live tooltip changes, and Escape", async () => {
    await act(async () => trigger.focus());
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
      "Storage is almost full",
    );
    await act(async () => {
      trigger.dataset.tip = "No audio output is selected";
    });
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
      "No audio output is selected",
    );
    await act(async () => {
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("dismisses stale tooltips on scroll and resize", async () => {
    await act(async () => trigger.focus());
    await act(async () => window.dispatchEvent(new Event("resize")));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    });
    await act(async () => trigger.dispatchEvent(new Event("scroll")));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
});
