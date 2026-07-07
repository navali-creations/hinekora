import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KeybindRegistrationStatus } from "~/main/modules/keybinds";
import { createManagedRecorderStatusTestFixture as createManagedRecorderStatus } from "~/renderer/modules/managed-recorder/ManagedRecorder.test-utils";

import {
  type AppSettings,
  createDefaultSettings,
  type ManagedRecorderStatus,
} from "~/types";
import { KeybindsSettingsCard } from "./KeybindsSettingsCard";

const storeMocks = vi.hoisted(() => ({
  settingsValue: null as AppSettings | null,
  updateSettings: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useSettingsShallow: (selector: unknown) =>
    (selector as (settings: unknown) => unknown)({
      value: storeMocks.settingsValue,
      update: storeMocks.updateSettings,
    }),
}));

let container: HTMLDivElement;
let root: Root;
let keybindStatus: KeybindRegistrationStatus;
let getKeybindStatus: ReturnType<typeof vi.fn>;
let onKeybindStatusChanged: ReturnType<typeof vi.fn>;
let statusListener: ((status: KeybindRegistrationStatus) => void) | null;
let recorderStatus: ManagedRecorderStatus;
let getRecorderStatus: ReturnType<typeof vi.fn>;
let onRecorderStatusChanged: ReturnType<typeof vi.fn>;
let recorderStatusListener: ((status: ManagedRecorderStatus) => void) | null;

async function renderKeybindsSettingsCard() {
  await act(async () => {
    root.render(<KeybindsSettingsCard />);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function getButtonByText(text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
  if (!button) {
    throw new Error(`Expected ${text} button to render`);
  }

  return button;
}

describe("KeybindsSettingsCard", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.settingsValue = createDefaultSettings();
    storeMocks.updateSettings.mockResolvedValue(undefined);
    keybindStatus = {
      manualBookmark: {
        accelerator: "Alt+B",
        displayLabel: "ALT + B",
        error: null,
        registered: true,
      },
      manualReplay: {
        accelerator: "Alt+C",
        displayLabel: "ALT + C",
        error: null,
        registered: true,
      },
    };
    statusListener = null;
    getKeybindStatus = vi.fn(async () => keybindStatus);
    onKeybindStatusChanged = vi.fn((listener) => {
      statusListener = listener;

      return vi.fn();
    });
    recorderStatus = createManagedRecorderStatus();
    recorderStatusListener = null;
    getRecorderStatus = vi.fn(async () => recorderStatus);
    onRecorderStatusChanged = vi.fn((listener) => {
      recorderStatusListener = listener;

      return vi.fn();
    });
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        keybinds: {
          getStatus: getKeybindStatus,
          onStatusChanged: onKeybindStatusChanged,
        },
        managedRecorder: {
          getStatus: getRecorderStatus,
          onStatusChanged: onRecorderStatusChanged,
        },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("renders saved keybinds and registration errors", async () => {
    keybindStatus.manualReplay = {
      ...keybindStatus.manualReplay,
      error: "Shortcut is unavailable",
      registered: false,
    };

    await renderKeybindsSettingsCard();

    expect(container.textContent).toContain("Global");
    expect(container.textContent).toContain("Internal");
    expect(container.textContent).toContain("ALT + B");
    expect(container.textContent).toContain("ALT + C");
    expect(container.textContent).toContain("Shortcut is unavailable");

    await act(async () => {
      statusListener?.({
        ...keybindStatus,
        manualReplay: {
          ...keybindStatus.manualReplay,
          error: null,
          registered: true,
        },
      });
    });

    expect(container.textContent).not.toContain("Shortcut is unavailable");
  });

  it("shows and clears status load failures", async () => {
    getKeybindStatus.mockRejectedValueOnce(new Error("offline"));

    await renderKeybindsSettingsCard();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Unable to load keybind status.");

    await act(async () => {
      statusListener?.(keybindStatus);
    });

    expect(container.textContent).not.toContain(
      "Unable to load keybind status.",
    );
  });

  it("records a new keybind from keyboard input", async () => {
    await renderKeybindsSettingsCard();

    await act(async () => {
      getButtonByText("Edit Keybind").click();
    });
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          code: "KeyM",
          key: "m",
        }),
      );
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      keybindManualBookmark: "Alt+M",
    });
  });

  it("does not record mouse input", async () => {
    await renderKeybindsSettingsCard();

    await act(async () => {
      getButtonByText("Edit Keybind").click();
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0 }),
      );
      window.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 1 }),
      );
      window.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 2 }),
      );
      window.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 3 }),
      );
    });

    expect(container.textContent).toContain("Press key");
    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("locks keybind editing while recorder status is loading", async () => {
    getRecorderStatus.mockReturnValueOnce(new Promise(() => undefined));

    await renderKeybindsSettingsCard();

    const recordButton = getButtonByText("Edit Keybind");
    expect(container.textContent).toContain(
      "Checking recorder status. Keybind editing is disabled until status is ready.",
    );
    expect(recordButton.disabled).toBe(true);

    await act(async () => {
      recordButton.click();
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          code: "KeyM",
          key: "m",
        }),
      );
    });

    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("locks keybind editing when recorder status fails to load", async () => {
    getRecorderStatus.mockRejectedValueOnce(new Error("offline"));

    await renderKeybindsSettingsCard();

    const recordButton = getButtonByText("Edit Keybind");
    expect(container.textContent).toContain(
      "Unable to load recorder status. Keybind editing is disabled while status is unavailable.",
    );
    expect(recordButton.disabled).toBe(true);

    await act(async () => {
      recorderStatusListener?.(createManagedRecorderStatus());
    });

    expect(container.textContent).not.toContain(
      "Unable to load recorder status.",
    );
    expect(getButtonByText("Edit Keybind").disabled).toBe(false);
  });

  it("locks keybind editing while recording is active", async () => {
    recorderStatus = createManagedRecorderStatus({ runRecordingActive: true });
    await renderKeybindsSettingsCard();

    const recordButton = getButtonByText("Edit Keybind");
    expect(container.textContent).toContain(
      "Recording is active. Stop recording before changing global shortcuts.",
    );
    expect(recordButton.disabled).toBe(true);

    await act(async () => {
      recordButton.click();
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          code: "KeyM",
          key: "m",
        }),
      );
    });

    expect(storeMocks.updateSettings).not.toHaveBeenCalled();

    await act(async () => {
      recorderStatusListener?.(createManagedRecorderStatus());
    });

    expect(container.textContent).not.toContain(
      "Recording is active. Stop recording before changing global shortcuts.",
    );
    expect(getButtonByText("Edit Keybind").disabled).toBe(false);
  });

  it("cancels active keybind recording when rewind starts", async () => {
    await renderKeybindsSettingsCard();

    await act(async () => {
      getButtonByText("Edit Keybind").click();
    });
    expect(container.textContent).toContain("Press key");

    await act(async () => {
      recorderStatusListener?.(
        createManagedRecorderStatus({ bufferActive: true }),
      );
    });

    expect(container.textContent).toContain(
      "Rewind is active. Stop rewind before changing global shortcuts.",
    );
    expect(container.textContent).not.toContain("Press key");

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          code: "KeyM",
          key: "m",
        }),
      );
    });

    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("records a single-key keyboard shortcut", async () => {
    await renderKeybindsSettingsCard();

    await act(async () => {
      getButtonByText("Edit Keybind").click();
    });
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "KeyM",
          key: "m",
        }),
      );
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      keybindManualBookmark: "M",
    });
  });

  it("cancels active recording from the cancel button without recording a click", async () => {
    await renderKeybindsSettingsCard();

    await act(async () => {
      getButtonByText("Edit Keybind").click();
    });
    expect(container.textContent).toContain("Press key");

    const cancelButton = getButtonByText("Cancel");
    await act(async () => {
      cancelButton.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0 }),
      );
      cancelButton.click();
    });

    expect(container.textContent).not.toContain("Press key");
    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("shows modifier previews and rejects duplicate keybinds", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      keybindManualReplay: "Alt+M",
    };
    await renderKeybindsSettingsCard();

    await act(async () => {
      getButtonByText("Edit Keybind").click();
    });
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Meta",
          metaKey: true,
          shiftKey: true,
        }),
      );
    });

    expect(container.textContent).toContain("SHIFT + META");

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          code: "KeyM",
          key: "m",
        }),
      );
    });

    expect(container.textContent).toContain(
      "Manual replay already uses ALT + M.",
    );
    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("clears and resets keybinds", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      keybindManualBookmark: null,
    };
    keybindStatus.manualBookmark = {
      accelerator: null,
      displayLabel: null,
      error: "No keybind set",
      registered: false,
    };
    await renderKeybindsSettingsCard();

    expect(container.textContent).toContain("No Keybind Set");

    const resetButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Reset Manual bookmark keybind"]',
    );
    await act(async () => {
      resetButton?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      keybindManualBookmark: "Alt+B",
    });

    storeMocks.updateSettings.mockClear();
    storeMocks.settingsValue = createDefaultSettings();
    await renderKeybindsSettingsCard();

    const clearButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Clear Manual bookmark keybind"]',
    );
    await act(async () => {
      clearButton?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      keybindManualBookmark: null,
    });
  });

  it("shows invalid persisted keybinds and allows clearing them", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      keybindManualBookmark: "Mouse4",
    };
    keybindStatus.manualBookmark = {
      accelerator: "Mouse4",
      displayLabel: "Mouse4",
      error: "Invalid keybind",
      registered: false,
    };

    await renderKeybindsSettingsCard();

    expect(container.textContent).toContain("Mouse4");
    expect(container.textContent).toContain("Invalid keybind");
    expect(container.textContent).not.toContain("No Keybind Set");

    const clearButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Clear Manual bookmark keybind"]',
    );
    expect(clearButton?.disabled).toBe(false);

    await act(async () => {
      clearButton?.click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      keybindManualBookmark: null,
    });
  });

  it("shows internal shortcut conflicts with global keybinds", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      keybindManualBookmark: "Delete",
    };

    await renderKeybindsSettingsCard();

    expect(container.textContent).toContain("DELETE");
    expect(container.textContent).toContain(
      "Also used by global Manual bookmark.",
    );
  });

  it("shows command-key internal shortcut conflicts with global keybinds", async () => {
    storeMocks.settingsValue = {
      ...createDefaultSettings(),
      keybindManualBookmark: "Meta+B",
    };

    await renderKeybindsSettingsCard();

    expect(container.textContent).toContain("META + B");
    expect(container.textContent).toContain(
      "Also used by global Manual bookmark.",
    );
  });
});
