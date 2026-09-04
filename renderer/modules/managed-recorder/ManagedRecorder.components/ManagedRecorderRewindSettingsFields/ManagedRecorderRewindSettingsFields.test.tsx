import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  isProfileUnlocked: true,
  isRewindActive: false,
  isRunRecordingActive: false,
  isStartingRecording: false,
  isStoppingRecording: false,
  selectedProfileId: "capture-profile-1" as string | null,
  settingsValue: {
    deathClipsEnabled: true,
    deathClipSeconds: 15,
    manualReplayShowPreview: true,
    manualReplaySeconds: 30,
    recordingAutoStartMode: "off",
    recordingHideOverlaysFromRewind: true,
  },
  updateSettings: vi.fn(),
  useSettingsShallow: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useCaptureProfilesShallow: (selector: (state: unknown) => unknown) =>
    selector({
      isProfileUnlocked: storeMocks.isProfileUnlocked,
      selectedProfileId: storeMocks.selectedProfileId,
    }),
  useManagedRecorderShallow: (selector: (state: unknown) => unknown) =>
    selector({
      status: {
        bufferActive: storeMocks.isRewindActive,
        isStartingRecording: storeMocks.isStartingRecording,
        isStoppingRecording: storeMocks.isStoppingRecording,
        recording: storeMocks.isRunRecordingActive,
        runRecordingActive: storeMocks.isRunRecordingActive,
      },
    }),
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

function getDurationInput(label = "Death clip duration"): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    `input[aria-label="${label} seconds"]`,
  );
  if (!input) {
    throw new Error("Expected rewind duration input to render");
  }

  return input;
}

function getPresetButton(
  seconds: string,
  label = "Death clip duration",
): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${seconds} second ${label.toLowerCase()}"]`,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected ${seconds} preset button to render`);
  }

  return button;
}

function getDurationButtons(label = "Death clip duration"): string[] {
  return [
    ...container.querySelectorAll<HTMLButtonElement>(
      `button[aria-label$="second ${label.toLowerCase()}"]`,
    ),
  ].map((button) => button.textContent?.trim() ?? "");
}

function getCheckbox(ariaLabel: string): HTMLInputElement {
  const checkbox = container.querySelector<HTMLInputElement>(
    `input[aria-label="${ariaLabel}"]`,
  );
  if (!checkbox) {
    throw new Error(`Expected ${ariaLabel} checkbox to render`);
  }

  return checkbox;
}

function getOverlayCheckbox(): HTMLInputElement {
  return getCheckbox("Hide Hinekora overlays from rewind");
}

describe("ManagedRecorderRewindSettingsFields", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.isProfileUnlocked = true;
    storeMocks.isRewindActive = false;
    storeMocks.isRunRecordingActive = false;
    storeMocks.isStartingRecording = false;
    storeMocks.isStoppingRecording = false;
    storeMocks.selectedProfileId = "capture-profile-1";
    storeMocks.settingsValue = {
      deathClipsEnabled: true,
      deathClipSeconds: 15,
      manualReplayShowPreview: true,
      manualReplaySeconds: 30,
      recordingAutoStartMode: "off",
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

    expect(container.textContent).toContain("Death clip duration");
    expect(container.textContent).toContain("Manual replay duration");
    expect(getDurationButtons().slice(0, 3)).toEqual(["5", "10", "15"]);
    expect(getDurationInput().disabled).toBe(false);
    expect(getDurationInput().placeholder).toBe("60");
    expect(getDurationInput().value).toBe("");
    expect(getPresetButton("15").getAttribute("aria-pressed")).toBe("true");
    expect(
      getPresetButton("30", "Manual replay duration").getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(container.textContent).toContain("seconds");
    expect(container.textContent).toContain("Preview quality");
    expect(
      container
        .querySelector('button[aria-label="Use 720p preview quality"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(container.textContent?.indexOf("Preview quality")).toBeLessThan(
      container.textContent?.indexOf("Enable death clips") ?? -1,
    );
    expect(container.textContent).toContain("Start rewind automatically");
    expect(getCheckbox("Enable death clips").checked).toBe(true);
    expect(getCheckbox("Show manual replay preview").checked).toBe(true);
    expect(container.textContent).toContain("Hide overlays from rewind");
    expect(getOverlayCheckbox().checked).toBe(true);
    const overlayHelpButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Uses window capture protection"]',
    );
    expect(overlayHelpButton?.classList.contains("tooltip-top")).toBe(true);
    expect(overlayHelpButton?.classList.contains("tooltip-bottom")).toBe(false);
  });

  it("updates rewind duration from presets and clamps custom typed values", async () => {
    await renderFields();

    await act(async () => {
      getPresetButton("45").click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      deathClipSeconds: 45,
    });
    await act(async () => {
      getPresetButton("60", "Manual replay duration").click();
    });
    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      manualReplaySeconds: 60,
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
      deathClipsEnabled: true,
      deathClipSeconds: 12,
      manualReplayShowPreview: true,
      manualReplaySeconds: 30,
      recordingAutoStartMode: "off",
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

  it("allows automatic death clips to be disabled", async () => {
    await renderFields();

    await act(async () => {
      getCheckbox("Enable death clips").click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      deathClipsEnabled: false,
    });
  });

  it("allows the manual replay preview to be disabled", async () => {
    await renderFields();

    await act(async () => {
      getCheckbox("Show manual replay preview").click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      manualReplayShowPreview: false,
    });
  });

  it("updates rewind auto-start from the rewind tab", async () => {
    await renderFields();

    await act(async () => {
      getCheckbox("Start rewind automatically").click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      recordingAutoStartMode: "rewind",
    });
  });

  it("disables active rewind auto-start from the rewind tab", async () => {
    storeMocks.settingsValue = {
      deathClipsEnabled: true,
      deathClipSeconds: 15,
      manualReplayShowPreview: true,
      manualReplaySeconds: 30,
      recordingAutoStartMode: "rewind",
      recordingHideOverlaysFromRewind: true,
    };
    await renderFields();

    expect(getCheckbox("Start rewind automatically").checked).toBe(true);

    await act(async () => {
      getCheckbox("Start rewind automatically").click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      recordingAutoStartMode: "off",
    });
  });

  it("disables rewind settings while the selected profile is locked", async () => {
    storeMocks.isProfileUnlocked = false;

    await renderFields();

    expect(getDurationInput().disabled).toBe(true);
    expect(getPresetButton("45").disabled).toBe(true);
    expect(getCheckbox("Enable death clips").disabled).toBe(true);
    expect(getCheckbox("Show manual replay preview").disabled).toBe(true);
    expect(getCheckbox("Start rewind automatically").disabled).toBe(true);
    expect(getOverlayCheckbox().disabled).toBe(true);

    await act(async () => {
      getPresetButton("45").click();
    });

    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });

  it("disables rewind settings while recording is active", async () => {
    storeMocks.isRunRecordingActive = true;

    await renderFields();

    expect(getDurationInput().disabled).toBe(true);
    expect(getPresetButton("45").disabled).toBe(true);
    expect(getCheckbox("Start rewind automatically").disabled).toBe(true);
    expect(getOverlayCheckbox().disabled).toBe(true);
  });
});
