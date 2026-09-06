import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AppSettings, createDefaultSettings } from "~/types";

const storeMocks = vi.hoisted(() => ({
  preferenceErrors: {} as Partial<Record<keyof AppSettings, string>>,
  settings: null as AppSettings | null,
  updatePreference: vi.fn(),
}));

vi.mock("../AuraOverlayBulkResize/AuraOverlayBulkResize", () => ({
  AuraOverlayBulkResize: () => <div>Match icon size</div>,
}));

vi.mock("~/renderer/store", () => ({
  useSettingsShallow: (selector: unknown) =>
    (selector as (settings: unknown) => unknown)({
      preferenceErrors: storeMocks.preferenceErrors,
      updatePreference: storeMocks.updatePreference,
      value: storeMocks.settings,
    }),
}));

import { AuraOverlayEditingPreferences } from "./AuraOverlayEditingPreferences";

describe("AuraOverlayEditingPreferences", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.preferenceErrors = {};
    storeMocks.settings = createDefaultSettings();
    storeMocks.updatePreference.mockResolvedValue(true);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("toggles the persisted aura editing guides", async () => {
    await act(async () => root.render(<AuraOverlayEditingPreferences />));

    expect(
      container.querySelector(
        'summary[aria-label="Show aura display options"]',
      ),
    ).toBeInstanceOf(HTMLElement);
    expect(container.textContent).toContain("Display options");
    expect(container.textContent).toContain("Match icon size");
    expect(
      container.querySelector('[aria-label="1 active options"]')?.textContent,
    ).toBe("1");

    const frameToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show aura editing frame"]',
    );
    const gridToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show aura editing grid"]',
    );
    const centerToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show aura center lines"]',
    );
    const snappingToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Enable aura item snapping"]',
    );
    const labelsToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Hide all aura labels"]',
    );
    const propertiesToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Hide per-aura options when focused"]',
    );
    expect(frameToggle?.checked).toBe(true);
    expect(gridToggle?.checked).toBe(false);
    expect(centerToggle?.checked).toBe(false);
    expect(snappingToggle?.checked).toBe(false);
    expect(labelsToggle?.checked).toBe(false);
    expect(propertiesToggle?.checked).toBe(false);

    await act(async () => {
      frameToggle?.click();
      gridToggle?.click();
      centerToggle?.click();
      snappingToggle?.click();
      labelsToggle?.click();
      propertiesToggle?.click();
    });

    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "auraOverlayShowEditingFrame",
      false,
    );
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "auraOverlayShowEditingGrid",
      true,
    );
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "auraOverlayShowCenterGuides",
      true,
    );
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "auraOverlayEnableSnapping",
      true,
    );
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "auraOverlayHideLabels",
      true,
    );
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "auraOverlayHidePropertiesPanel",
      true,
    );
  });

  it("shows preference save failures", async () => {
    storeMocks.preferenceErrors = {
      auraOverlayShowEditingFrame: "Could not save the frame preference.",
      auraOverlayShowEditingGrid: "Could not save the grid preference.",
      auraOverlayShowCenterGuides:
        "Could not save the center guides preference.",
      auraOverlayEnableSnapping: "Could not save the snapping preference.",
      auraOverlayHideLabels: "Could not save the labels preference.",
      auraOverlayHidePropertiesPanel:
        "Could not save the properties preference.",
    };

    await act(async () => root.render(<AuraOverlayEditingPreferences />));

    expect(
      [...container.querySelectorAll('[role="alert"]')].map(
        (alert) => alert.textContent,
      ),
    ).toEqual([
      "Could not save the frame preference.",
      "Could not save the grid preference.",
      "Could not save the center guides preference.",
      "Could not save the snapping preference.",
      "Could not save the labels preference.",
      "Could not save the properties preference.",
    ]);
  });

  it("does not show an indicator when every option is inactive", async () => {
    storeMocks.settings = {
      ...createDefaultSettings(),
      auraOverlayShowEditingFrame: false,
    };

    await act(async () => root.render(<AuraOverlayEditingPreferences />));

    expect(
      container.querySelector('[aria-label$="active options"]'),
    ).toBeNull();
  });
});
