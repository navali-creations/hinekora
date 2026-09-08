import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settingsMocks = vi.hoisted(() => ({
  editorLogEnabled: false,
  overlayDevToolsEnabled: false,
  preferenceError: null as string | null,
  overlayDevToolsPreferenceError: null as string | null,
  update: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useSettingsShallow: (selector: (settings: unknown) => unknown) =>
    selector({
      preferenceErrors: {
        ...(settingsMocks.preferenceError
          ? { editorLogEnabled: settingsMocks.preferenceError }
          : {}),
        ...(settingsMocks.overlayDevToolsPreferenceError
          ? {
              overlayDevToolsEnabled:
                settingsMocks.overlayDevToolsPreferenceError,
            }
          : {}),
      },
      updatePreference: settingsMocks.update,
      value: {
        editorLogEnabled: settingsMocks.editorLogEnabled,
        overlayDevToolsEnabled: settingsMocks.overlayDevToolsEnabled,
      },
    }),
}));

import { TroubleshootingSettingsCard } from "./TroubleshootingSettingsCard";

let container: HTMLDivElement;
let root: Root;
const revealLogFile = vi.fn();

function getButtonByText(label: string): HTMLButtonElement {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((candidate) => candidate.textContent?.includes(label));
  if (!button) {
    throw new Error(`Expected ${label} button to render`);
  }

  return button;
}

async function renderCard(): Promise<void> {
  await act(async () => {
    root.render(<TroubleshootingSettingsCard />);
  });
}

describe("TroubleshootingSettingsCard", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    settingsMocks.editorLogEnabled = false;
    settingsMocks.overlayDevToolsEnabled = false;
    settingsMocks.preferenceError = null;
    settingsMocks.overlayDevToolsPreferenceError = null;
    settingsMocks.update.mockResolvedValue(true);
    revealLogFile.mockResolvedValue({ success: true });
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        diagLog: {
          revealLogFile,
        },
      },
    });
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("opens the diagnostic log through preload", async () => {
    await renderCard();
    const button = getButtonByText("Open log file");

    await act(async () => {
      button.click();
    });

    expect(container.textContent).toContain("Diagnostic Log");
    expect(revealLogFile).toHaveBeenCalledTimes(1);
  });

  it("shows a failure message when the diagnostic log cannot be opened", async () => {
    revealLogFile.mockResolvedValueOnce({
      success: false,
      error: "shell failed",
    });
    await renderCard();
    const button = getButtonByText("Open log file");

    await act(async () => {
      button.click();
    });

    expect(container.textContent).toContain("Could not open diagnostic log.");
    expect(revealLogFile).toHaveBeenCalledTimes(1);
  });

  it("persists the editor log toggle", async () => {
    await renderCard();
    const toggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Editor log"]',
    );

    await act(async () => {
      toggle?.click();
    });

    expect(settingsMocks.update).toHaveBeenCalledWith("editorLogEnabled", true);
  });

  it("persists the overlay Developer Tools toggle", async () => {
    await renderCard();
    const toggle = container.querySelector<HTMLInputElement>(
      'input[aria-label="Overlay Developer Tools"]',
    );

    await act(async () => {
      toggle?.click();
    });

    expect(settingsMocks.update).toHaveBeenCalledWith(
      "overlayDevToolsEnabled",
      true,
    );
  });

  it("restores the persisted overlay Developer Tools preference", async () => {
    settingsMocks.overlayDevToolsEnabled = true;

    await renderCard();

    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Overlay Developer Tools"]',
      )?.checked,
    ).toBe(true);
  });

  it("reports when the overlay Developer Tools toggle cannot be saved", async () => {
    settingsMocks.update.mockResolvedValueOnce(false);
    await renderCard();

    await act(async () => {
      container
        .querySelector<HTMLInputElement>(
          'input[aria-label="Overlay Developer Tools"]',
        )
        ?.click();
    });

    settingsMocks.overlayDevToolsPreferenceError =
      "Could not save this preference.";
    await renderCard();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Could not save this preference.",
    );
  });

  it("reports when the editor log toggle cannot be saved", async () => {
    settingsMocks.update.mockResolvedValueOnce(false);
    await renderCard();

    await act(async () => {
      container
        .querySelector<HTMLInputElement>('input[aria-label="Editor log"]')
        ?.click();
    });

    settingsMocks.preferenceError = "Could not save this preference.";
    await renderCard();

    expect(container.textContent).toContain("Could not save this preference.");
  });
});
