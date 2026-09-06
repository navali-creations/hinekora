import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OverlayPlacement } from "~/types";
import { AuraPlacementPropertiesPanel } from "./AuraPlacementPropertiesPanel";

const placement: OverlayPlacement = {
  id: "placement-1",
  cropRegionId: "crop-1",
  x: 30,
  y: 40,
  scale: 1,
  opacity: 1,
};

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("AuraPlacementPropertiesPanel", () => {
  let root: Root | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.replaceChildren();
  });

  it("commits number fields while typing with one history entry per focus session", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AuraPlacementPropertiesPanel
          anchorBounds={{ height: 80, left: 30, top: 40, width: 120 }}
          displayHeight={80}
          displayWidth={120}
          label="Aura name"
          placement={placement}
          visibleThickness={20}
          onChange={onChange}
        />,
      );
    });

    const widthInput = container.querySelector<HTMLInputElement>(
      'input[name="width"]',
    );
    expect(widthInput).toBeInstanceOf(HTMLInputElement);

    await act(async () => {
      widthInput?.focus();
      setInputValue(widthInput as HTMLInputElement, "150");
    });

    expect(onChange).toHaveBeenCalledWith("placement-1", {
      displayWidth: 150,
      recordHistory: true,
    });

    await act(async () => {
      setInputValue(widthInput as HTMLInputElement, "155");
    });

    expect(onChange).toHaveBeenCalledWith("placement-1", {
      displayWidth: 155,
      recordHistory: false,
    });
  });

  it("keeps scale edits at one or higher", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AuraPlacementPropertiesPanel
          anchorBounds={{ height: 80, left: 30, top: 40, width: 120 }}
          displayHeight={80}
          displayWidth={120}
          label="Aura name"
          placement={{ ...placement, scale: 2 }}
          visibleThickness={20}
          onChange={onChange}
        />,
      );
    });

    const scaleInput = container.querySelector<HTMLInputElement>(
      'input[name="scale"]',
    );
    expect(scaleInput).toBeInstanceOf(HTMLInputElement);

    await act(async () => {
      scaleInput?.focus();
      setInputValue(scaleInput as HTMLInputElement, "0.5");
    });

    expect(scaleInput?.min).toBe("1");
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      recordHistory: true,
      scale: 1,
    });
  });

  it("commits toggles and rotate actions as single discrete changes", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AuraPlacementPropertiesPanel
          anchorBounds={{ height: 80, left: 30, top: 40, width: 120 }}
          displayHeight={80}
          displayWidth={120}
          label="Aura name"
          placement={placement}
          visibleThickness={20}
          onChange={onChange}
        />,
      );
    });

    const mirrorInput = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    const rotateButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Rotate"),
    );

    await act(async () => {
      mirrorInput?.click();
      rotateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith("placement-1", { mirrored: true });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      rotationDegrees: 90,
    });
  });

  it("commits opacity and name changes", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AuraPlacementPropertiesPanel
          anchorBounds={{ height: 80, left: 30, top: 40, width: 120 }}
          displayHeight={80}
          displayWidth={120}
          label="Aura name"
          placement={placement}
          onChange={onChange}
        />,
      );
    });

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[name="label"]',
    );
    const opacityInput = container.querySelector<HTMLInputElement>(
      'input[name="opacity"]',
    );
    expect(nameInput).toBeInstanceOf(HTMLInputElement);
    expect(nameInput?.maxLength).toBe(80);
    expect(nameInput?.parentElement?.className).toContain(
      "propertiesNameField",
    );
    expect(opacityInput).toBeInstanceOf(HTMLInputElement);

    await act(async () => {
      nameInput?.focus();
      setInputValue(nameInput as HTMLInputElement, "Renamed aura");
    });

    await act(async () => {
      nameInput?.blur();
    });

    await act(async () => {
      opacityInput?.focus();
      setInputValue(opacityInput as HTMLInputElement, "0.45");
    });

    expect(onChange).toHaveBeenCalledWith("placement-1", {
      label: "Renamed aura",
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      opacity: 0.45,
      recordHistory: true,
    });
  });

  it("restores the placement name without committing when Escape is pressed", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AuraPlacementPropertiesPanel
          anchorBounds={{ height: 80, left: 30, top: 40, width: 120 }}
          displayHeight={80}
          displayWidth={120}
          label="Aura name"
          placement={placement}
          onChange={onChange}
        />,
      );
    });

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[name="label"]',
    );
    await act(async () => {
      nameInput?.focus();
      setInputValue(nameInput as HTMLInputElement, "Discard me");
      nameInput?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    });

    expect(nameInput?.value).toBe("Aura name");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("collapses and expands the per-aura controls", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AuraPlacementPropertiesPanel
          anchorBounds={{ height: 80, left: 30, top: 40, width: 120 }}
          displayHeight={80}
          displayWidth={120}
          label="Aura name"
          placement={placement}
          onChange={vi.fn()}
        />,
      );
    });

    const panel = container.querySelector<HTMLDetailsElement>(
      'details[aria-label="Aura placement properties"]',
    );
    const toggle = container.querySelector<HTMLElement>(
      'summary[aria-label="Collapse or expand aura properties"]',
    );
    expect(panel?.open).toBe(true);

    await act(async () => toggle?.click());
    expect(panel?.open).toBe(false);

    await act(async () => toggle?.click());
    expect(panel?.open).toBe(true);
  });
});
