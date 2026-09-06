import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AppSettings, createDefaultSettings } from "~/types";

const storeMocks = vi.hoisted(() => ({
  preferenceErrors: {} as Partial<Record<keyof AppSettings, string>>,
  settingsValue: null as AppSettings | null,
  updatePreference: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useSettingsShallow: (selector: unknown) =>
    (selector as (settings: unknown) => unknown)({
      preferenceErrors: storeMocks.preferenceErrors,
      updatePreference: storeMocks.updatePreference,
      value: storeMocks.settingsValue,
    }),
}));

import { OverlaySettingsCard } from "./OverlaySettingsCard";

let container: HTMLDivElement;
let root: Root;

async function renderOverlaySettings() {
  await act(async () => {
    root.render(<OverlaySettingsCard />);
  });
}

describe("OverlaySettingsCard", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.preferenceErrors = {};
    storeMocks.settingsValue = createDefaultSettings();
    storeMocks.updatePreference.mockResolvedValue(true);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("toggles overlay preferences through settings", async () => {
    await renderOverlaySettings();
    const recorderStartupToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show recording overlay at startup"]',
    );
    const auraCaptureToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Include aura overlay in captures"]',
    );
    const recorderStartMinimizedToggle =
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Start recording overlay minimized"]',
      );
    const recorderFocusToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Keep recording controls visible while a game is running"]',
    );
    const auraFocusToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Keep aura overlay visible while a game is running"]',
    );
    const clipPreviewFocusToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Keep clip previews visible while a game is running"]',
    );
    const gridLinesFocusToggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Keep grid lines overlay visible while a game is running"]',
    );

    await act(async () => {
      if (
        !recorderStartupToggle ||
        !recorderStartMinimizedToggle ||
        !auraCaptureToggle ||
        !recorderFocusToggle ||
        !auraFocusToggle ||
        !clipPreviewFocusToggle ||
        !gridLinesFocusToggle
      ) {
        throw new Error("Expected overlay preference toggles to render");
      }

      recorderStartupToggle.click();
      recorderStartMinimizedToggle.click();
      auraCaptureToggle.click();
      recorderFocusToggle.click();
      auraFocusToggle.click();
      clipPreviewFocusToggle.click();
      gridLinesFocusToggle.click();
    });

    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "recorderOverlayShowOnStartup",
      false,
    );
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "recorderOverlayStartMinimized",
      true,
    );
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "auraOverlayIncludeInCaptures",
      true,
    );
    expect(container.textContent).toContain("Windows screenshots");
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "recorderOverlayIgnoreGameFocus",
      true,
    );
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "auraOverlayIgnoreGameFocus",
      true,
    );
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "clipPreviewOverlayIgnoreGameFocus",
      true,
    );
    expect(storeMocks.updatePreference).toHaveBeenCalledWith(
      "gridLinesOverlayIgnoreGameFocus",
      true,
    );
    expect(container.textContent).toContain("Hidden when game is not focused");
    expect(container.textContent).toContain(
      "These settings work best with two or more monitors.",
    );

    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      auraOverlayIgnoreGameFocus: true,
      clipPreviewOverlayIgnoreGameFocus: true,
      gridLinesOverlayIgnoreGameFocus: true,
      recorderOverlayIgnoreGameFocus: true,
    };
    await renderOverlaySettings();

    expect(container.textContent).toContain("Always visible");
  });

  it("keeps preferences interactive and surfaces save failures", async () => {
    storeMocks.preferenceErrors = {
      gridLinesOverlayIgnoreGameFocus: "Could not save this preference.",
    };

    await renderOverlaySettings();

    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Keep recording controls visible while a game is running"]',
      )?.disabled,
    ).toBe(false);
    expect(container.textContent).not.toContain("Saving...");
    expect(container.querySelector(".loading-spinner")).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Could not save this preference.",
    );
  });
});
