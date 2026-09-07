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

function findCheckboxByLabel(
  container: HTMLElement,
  label: string,
): HTMLInputElement | undefined {
  return [
    ...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ].find((input) => input.parentElement?.textContent?.trim() === label);
}

function findTabByLabel(
  container: HTMLElement,
  label: string,
): HTMLButtonElement | undefined {
  return [
    ...container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ].find((button) => button.textContent?.trim() === label);
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
          centerOffsetX={0}
          centerOffsetY={0}
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

  it("shows and commits center-relative aura coordinates from the Aura tab", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AuraPlacementPropertiesPanel
          anchorBounds={{ height: 80, left: 440, top: 360, width: 120 }}
          displayHeight={80}
          displayWidth={120}
          label="Aura name"
          placement={placement}
          centerOffsetX={0}
          centerOffsetY={0}
          onChange={onChange}
        />,
      );
    });

    await act(async () => {
      findTabByLabel(container, "Aura")?.click();
    });

    const xInput = container.querySelector<HTMLInputElement>('input[name="x"]');
    const yInput = container.querySelector<HTMLInputElement>('input[name="y"]');
    expect(xInput?.value).toBe("0");
    expect(yInput?.value).toBe("0");

    await act(async () => {
      xInput?.focus();
      setInputValue(xInput as HTMLInputElement, "-40");
      yInput?.focus();
      setInputValue(yInput as HTMLInputElement, "-30");
    });

    expect(onChange).toHaveBeenCalledWith("placement-1", {
      centerOffsetX: -40,
      recordHistory: true,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      centerOffsetY: -30,
      recordHistory: true,
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
          centerOffsetX={0}
          centerOffsetY={0}
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

  it("steps only the hovered number value with the wheel and blocks exponent input", async () => {
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
          centerOffsetX={0}
          centerOffsetY={0}
          label="Aura name"
          placement={placement}
          onChange={onChange}
        />,
      );
    });

    const widthInput = container.querySelector<HTMLInputElement>(
      'input[name="width"]',
    );
    const panel = container.querySelector<HTMLDetailsElement>(
      'details[aria-label="Aura placement properties"]',
    );
    expect(widthInput).toBeInstanceOf(HTMLInputElement);
    expect(panel).toBeInstanceOf(HTMLDetailsElement);
    if (!widthInput || !panel) {
      return;
    }

    panel.scrollTop = 20;
    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
    });
    await act(async () => {
      widthInput.dispatchEvent(wheelEvent);
    });

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(panel.scrollTop).toBe(20);
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      displayWidth: 121,
      recordHistory: true,
    });

    const exponentEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "e",
    });
    await act(async () => {
      widthInput.dispatchEvent(exponentEvent);
    });
    expect(exponentEvent.defaultPrevented).toBe(true);
  });

  it("commits toggles, rotation, and reset as discrete changes", async () => {
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
          centerOffsetX={0}
          centerOffsetY={0}
          label="Aura name"
          placement={placement}
          visibleThickness={20}
          onChange={onChange}
        />,
      );
    });

    const mirrorInput = findCheckboxByLabel(container, "Mirror");
    const rotateButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Rotate aura"]',
    );
    const resetButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Reset to default",
    );
    expect(rotateButton?.textContent?.trim()).toBe("0 deg");

    await act(async () => {
      mirrorInput?.click();
      rotateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      resetButton?.click();
    });

    expect(onChange).toHaveBeenCalledWith("placement-1", { mirrored: true });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      rotationDegrees: 90,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      resetToDefaults: true,
    });
  });

  it("configures resize controls and colored aura effects", async () => {
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
          centerOffsetX={0}
          centerOffsetY={0}
          label="Aura name"
          placement={placement}
          showClipShapeControls
          onChange={onChange}
        />,
      );
    });

    await act(async () => {
      findCheckboxByLabel(container, "Hide resize controls")?.click();
    });
    await act(async () => {
      findTabByLabel(container, "Aura")?.click();
    });
    await act(async () => {
      findCheckboxByLabel(container, "Aura outline")?.click();
      findCheckboxByLabel(container, "Aura shadow")?.click();
      findCheckboxByLabel(container, "Round corners")?.click();
    });

    expect(onChange).toHaveBeenCalledWith("placement-1", {
      hideResizeControls: true,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      outlineColor: "#000000",
      outlineThickness: 1,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      shadowColor: "#000000",
      shadowSpread: 4,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      cornerRadius: 4,
    });

    await act(async () => {
      root?.render(
        <AuraPlacementPropertiesPanel
          anchorBounds={{ height: 80, left: 30, top: 40, width: 120 }}
          displayHeight={80}
          displayWidth={120}
          centerOffsetX={0}
          centerOffsetY={0}
          label="Aura name"
          placement={{
            ...placement,
            cornerRadius: 4,
            hideResizeControls: true,
            outlineColor: "#000000",
            outlineThickness: 1,
            shadowColor: "#000000",
            shadowSpread: 4,
          }}
          showClipShapeControls
          onChange={onChange}
        />,
      );
    });

    const outlineInput = container.querySelector<HTMLInputElement>(
      'input[name="outlineThickness"]',
    );
    const shadowInput = container.querySelector<HTMLInputElement>(
      'input[name="shadowSpread"]',
    );
    const cornerRadiusInput = container.querySelector<HTMLInputElement>(
      'input[name="cornerRadius"]',
    );
    expect(outlineInput?.value).toBe("1");
    expect(shadowInput?.value).toBe("4");
    expect(cornerRadiusInput?.value).toBe("4");
    expect(cornerRadiusInput?.max).toBe("10");
    const outlineColorInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Outline color"]',
    );
    const shadowColorInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Shadow color"]',
    );
    expect(outlineColorInput?.value).toBe("#000000");
    expect(shadowColorInput?.value).toBe("#000000");

    await act(async () => {
      outlineInput?.focus();
      setInputValue(outlineInput as HTMLInputElement, "3");
      shadowInput?.focus();
      setInputValue(shadowInput as HTMLInputElement, "6");
      cornerRadiusInput?.focus();
      setInputValue(cornerRadiusInput as HTMLInputElement, "20");
      setInputValue(outlineColorInput as HTMLInputElement, "#123456");
      setInputValue(shadowColorInput as HTMLInputElement, "#654321");
    });

    expect(onChange).not.toHaveBeenCalledWith("placement-1", {
      outlineColor: "#123456",
    });
    expect(onChange).not.toHaveBeenCalledWith("placement-1", {
      shadowColor: "#654321",
    });

    await act(async () => {
      outlineColorInput?.dispatchEvent(new Event("change", { bubbles: true }));
      shadowColorInput?.dispatchEvent(new Event("change", { bubbles: true }));
      findCheckboxByLabel(container, "Aura outline")?.click();
      findCheckboxByLabel(container, "Aura shadow")?.click();
      findCheckboxByLabel(container, "Round corners")?.click();
    });

    expect(onChange).toHaveBeenCalledWith("placement-1", {
      outlineThickness: 3,
      recordHistory: true,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      recordHistory: true,
      shadowSpread: 6,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      cornerRadius: 10,
      recordHistory: true,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      outlineColor: "#123456",
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      shadowColor: "#654321",
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      outlineColor: null,
      outlineThickness: null,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      shadowColor: null,
      shadowSpread: null,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      cornerRadius: null,
    });

    await act(async () => {
      findTabByLabel(container, "Icon")?.click();
    });
    const contentZoomInput = container.querySelector<HTMLInputElement>(
      'input[name="contentZoomPercent"]',
    );
    const iconOffsetXInput = container.querySelector<HTMLInputElement>(
      'input[name="iconOffsetX"]',
    );
    const iconOffsetYInput = container.querySelector<HTMLInputElement>(
      'input[name="iconOffsetY"]',
    );
    expect(contentZoomInput?.value).toBe("100");
    expect(contentZoomInput?.min).toBe("10");
    expect(contentZoomInput?.max).toBe("200");
    expect(iconOffsetXInput?.value).toBe("0");
    expect(iconOffsetYInput?.value).toBe("0");
    expect(iconOffsetXInput?.step).toBe("1");
    expect(iconOffsetYInput?.step).toBe("1");

    await act(async () => {
      contentZoomInput?.focus();
      setInputValue(contentZoomInput as HTMLInputElement, "165");
      iconOffsetXInput?.focus();
      setInputValue(iconOffsetXInput as HTMLInputElement, "12");
      iconOffsetYInput?.focus();
      setInputValue(iconOffsetYInput as HTMLInputElement, "-8");
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Use shield aura shape"]',
        )
        ?.click();
    });

    expect(onChange).toHaveBeenCalledWith("placement-1", {
      contentZoomPercent: 165,
      recordHistory: true,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      iconOffsetX: 12,
      recordHistory: true,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      iconOffsetY: -8,
      recordHistory: true,
    });
    expect(onChange).toHaveBeenCalledWith("placement-1", {
      clipShape: "shield",
    });
    expect(
      container.querySelectorAll('[aria-label="Aura shape"] button svg'),
    ).toHaveLength(4);
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
          centerOffsetX={0}
          centerOffsetY={0}
          label="Aura name"
          placement={placement}
          onChange={onChange}
        />,
      );
    });

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[name="label"]',
    );
    expect(nameInput).toBeInstanceOf(HTMLInputElement);
    expect(nameInput?.maxLength).toBe(80);
    expect(nameInput?.parentElement?.className).toContain(
      "propertiesNameField",
    );
    await act(async () => {
      nameInput?.focus();
      setInputValue(nameInput as HTMLInputElement, "Renamed aura");
    });

    await act(async () => {
      nameInput?.blur();
    });

    await act(async () => {
      findTabByLabel(container, "Aura")?.click();
    });
    const opacityInput = container.querySelector<HTMLInputElement>(
      'input[name="opacity"]',
    );
    expect(opacityInput).toBeInstanceOf(HTMLInputElement);

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
          centerOffsetX={0}
          centerOffsetY={0}
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
          centerOffsetX={0}
          centerOffsetY={0}
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
    expect(findTabByLabel(container, "General")?.ariaSelected).toBe("true");
    expect(findTabByLabel(container, "Aura")).toBeDefined();
    expect(findTabByLabel(container, "Icon")).toBeUndefined();

    await act(async () => toggle?.click());
    expect(panel?.open).toBe(false);

    await act(async () => toggle?.click());
    expect(panel?.open).toBe(true);
  });

  it("shows the Aura tab but hides the Icon tab for arched placements", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AuraPlacementPropertiesPanel
          anchorBounds={{ height: 80, left: 30, top: 40, width: 120 }}
          displayHeight={80}
          displayWidth={120}
          centerOffsetX={0}
          centerOffsetY={0}
          label="Arched aura"
          placement={placement}
          visibleThickness={20}
          onChange={vi.fn()}
        />,
      );
    });

    expect(findTabByLabel(container, "General")).toBeDefined();
    expect(findTabByLabel(container, "Aura")).toBeDefined();
    expect(findTabByLabel(container, "Icon")).toBeUndefined();

    await act(async () => {
      findTabByLabel(container, "Aura")?.click();
    });
    expect(
      container.querySelector<HTMLInputElement>('input[name="x"]')?.value,
    ).toBe("0");
    expect(
      container.querySelector<HTMLInputElement>('input[name="y"]')?.value,
    ).toBe("0");
  });
});
