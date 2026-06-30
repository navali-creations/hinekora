import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  settingsValue: {
    deathClipSeconds: 15,
    recordingHideOverlaysFromRewind: true,
  },
  updateSettings: vi.fn(),
  useSettingsShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useSettingsShallow: storeMocks.useSettingsShallow,
}));

import { ManagedRecorderRewindSettingsFields } from "./ManagedRecorderRewindSettingsFields";

let container: HTMLDivElement;
let root: Root;

async function renderFields(): Promise<void> {
  await act(async () => {
    root.render(<ManagedRecorderRewindSettingsFields />);
  });
}

function getDurationInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Rewind duration seconds"]',
  );
  if (!input) {
    throw new Error("Expected rewind duration input to render");
  }

  return input;
}

function getPresetButton(label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (buttonElement) => buttonElement.textContent?.trim() === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected ${label} preset button to render`);
  }

  return button;
}

function getDurationButtons(): string[] {
  return [...container.querySelectorAll("button")].map(
    (button) => button.textContent?.trim() ?? "",
  );
}

function getOverlayCheckbox(): HTMLInputElement {
  const checkbox = container.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  if (!checkbox) {
    throw new Error("Expected overlay capture checkbox to render");
  }

  return checkbox;
}

describe("ManagedRecorderRewindSettingsFields", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.settingsValue = {
      deathClipSeconds: 15,
      recordingHideOverlaysFromRewind: true,
    };
    storeMocks.updateSettings.mockReset();
    storeMocks.updateSettings.mockResolvedValue(undefined);
    storeMocks.useSettingsShallow.mockImplementation((selector) =>
      selector({
        value: storeMocks.settingsValue,
        update: storeMocks.updateSettings,
      }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("renders the saved rewind duration and preset controls", async () => {
    await renderFields();

    expect(container.textContent).toContain("Rewind duration");
    expect(getDurationButtons().slice(0, 3)).toEqual(["5", "10", "15"]);
    expect(getDurationInput().disabled).toBe(false);
    expect(getDurationInput().placeholder).toBe("60");
    expect(getDurationInput().value).toBe("");
    expect(getPresetButton("15").getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("seconds");
    expect(container.textContent).toContain("Hide overlays from rewind");
    expect(getOverlayCheckbox().checked).toBe(true);
  });

  it("updates rewind duration from presets and clamps custom typed values", async () => {
    await renderFields();

    await act(async () => {
      getPresetButton("45").click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      deathClipSeconds: 45,
    });

    const input = getDurationInput();
    await act(async () => {
      input.focus();
    });

    expect(input.value).toBe("");
    expect(input.disabled).toBe(false);
    expect(input.placeholder).toBe("60");
    expect(document.activeElement).toBe(input);
    expect(getPresetButton("15").getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      input.value = "99";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      deathClipSeconds: 60,
    });
    expect(input.value).toBe("60");
  });

  it("restores the saved preset when custom duration is left empty", async () => {
    await renderFields();

    const input = getDurationInput();
    await act(async () => {
      input.focus();
    });

    expect(input.value).toBe("");
    expect(getPresetButton("15").getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(input.value).toBe("");
    expect(getPresetButton("15").getAttribute("aria-pressed")).toBe("true");
    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("shows the custom input when the saved duration is not a preset", async () => {
    storeMocks.settingsValue = {
      deathClipSeconds: 12,
      recordingHideOverlaysFromRewind: true,
    };

    await renderFields();

    expect(getDurationInput().disabled).toBe(false);
    expect(getDurationInput().value).toBe("12");
  });

  it("updates overlay capture protection from the rewind tab", async () => {
    await renderFields();

    await act(async () => {
      getOverlayCheckbox().click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      recordingHideOverlaysFromRewind: false,
    });
  });
});
