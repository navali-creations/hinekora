import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  settingsValue: {
    recorderSettingsInfoAlertDismissed: false,
  },
  updateSettings: vi.fn(),
  useSettingsShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useSettingsShallow: storeMocks.useSettingsShallow,
}));

import { ManagedRecorderSettingsInfoAlert } from "./ManagedRecorderSettingsInfoAlert";

let container: HTMLDivElement;
let root: Root;

async function renderAlert(): Promise<void> {
  await act(async () => {
    root.render(<ManagedRecorderSettingsInfoAlert />);
  });
}

describe("ManagedRecorderSettingsInfoAlert", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.settingsValue = {
      recorderSettingsInfoAlertDismissed: false,
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

  it("renders local-save guidance and persists dismissal", async () => {
    await renderAlert();

    expect(container.textContent).toContain(
      "Settings are saved locally; set them once.",
    );

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Dismiss recorder settings info alert"]',
        )
        ?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      recorderSettingsInfoAlertDismissed: true,
    });
  });

  it("stays hidden after dismissal", async () => {
    storeMocks.settingsValue = {
      recorderSettingsInfoAlertDismissed: true,
    };

    await renderAlert();

    expect(container.textContent).toBe("");
  });
});
