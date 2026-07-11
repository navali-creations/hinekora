import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReplayClipPreviewResolution } from "~/types";

const storeMocks = vi.hoisted(() => ({
  isProfileUnlocked: true,
  isRewindActive: false,
  isRunRecordingActive: false,
  isStartingRecording: false,
  isStoppingRecording: false,
  previewResolution: "720p" as ReplayClipPreviewResolution,
  updateSettings: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useCaptureProfilesShallow: (selector: (state: unknown) => unknown) =>
    selector({ isProfileUnlocked: storeMocks.isProfileUnlocked }),
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
  useSettingsShallow: (selector: (state: unknown) => unknown) =>
    selector({
      update: storeMocks.updateSettings,
      value: {
        replayClipPreviewResolution: storeMocks.previewResolution,
      },
    }),
}));

import { ManagedRecorderPreviewQualityField } from "./ManagedRecorderPreviewQualityField";

let container: HTMLDivElement;
let root: Root;

function getQualityButton(resolution: ReplayClipPreviewResolution) {
  const button = container.querySelector<HTMLButtonElement>(
    `button[aria-label="Use ${resolution} preview quality"]`,
  );
  if (!button) {
    throw new Error(`Expected ${resolution} preview quality button`);
  }
  return button;
}

async function renderField(): Promise<void> {
  await act(async () => {
    root.render(<ManagedRecorderPreviewQualityField />);
  });
}

describe("ManagedRecorderPreviewQualityField", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.isProfileUnlocked = true;
    storeMocks.isRewindActive = false;
    storeMocks.isRunRecordingActive = false;
    storeMocks.isStartingRecording = false;
    storeMocks.isStoppingRecording = false;
    storeMocks.previewResolution = "720p";
    storeMocks.updateSettings.mockReset();
    storeMocks.updateSettings.mockResolvedValue(undefined);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("shows the selected quality and explains both preview modes", async () => {
    await renderField();

    const originalButton = getQualityButton("1080p");
    const proxyButton = getQualityButton("720p");
    expect(
      [...container.querySelectorAll("button")].map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(["720p", "1080p"]);
    expect(originalButton.getAttribute("aria-pressed")).toBe("false");
    expect(proxyButton.getAttribute("aria-pressed")).toBe("true");
    expect(originalButton.classList.contains("tooltip-left")).toBe(true);
    expect(proxyButton.classList.contains("tooltip-left")).toBe(true);
    expect(originalButton.dataset.tip).toContain("original 1080p rewind");
    expect(proxyButton.dataset.tip).toContain("temporary 720p proxy");
    expect(proxyButton.dataset.tip).toContain(
      "Saving, clipboard, and clips opened in the full editor still use the original 1080p clip",
    );
  });

  it("persists the selected preview quality", async () => {
    await renderField();

    await act(async () => {
      getQualityButton("1080p").click();
    });

    expect(storeMocks.updateSettings).toHaveBeenCalledWith({
      replayClipPreviewResolution: "1080p",
    });
  });

  it("disables quality changes with other recorder settings", async () => {
    storeMocks.isProfileUnlocked = false;
    await renderField();

    expect(getQualityButton("1080p").disabled).toBe(true);
    expect(getQualityButton("720p").disabled).toBe(true);
    await act(async () => {
      getQualityButton("1080p").click();
    });
    expect(storeMocks.updateSettings).not.toHaveBeenCalled();
  });
});
