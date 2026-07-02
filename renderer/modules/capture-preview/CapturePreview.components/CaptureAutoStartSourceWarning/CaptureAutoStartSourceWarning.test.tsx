import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CapturePreviewSource, CaptureProfile, GameId } from "~/types";

const source: CapturePreviewSource = {
  displayId: null,
  game: "poe1",
  height: null,
  id: "window:poe:next",
  kind: "window",
  name: "Path of Exile 1",
  thumbnailDataUrl: null,
  width: null,
};
const unavailableSource: CapturePreviewSource = {
  ...source,
  available: false,
  id: "missing-window:poe1",
  name: "Path of Exile 1 (not running)",
};

function createCaptureProfile(game: GameId): CaptureProfile {
  return {
    captureTarget: {
      game,
      id: game === "poe1" ? "window:poe:previous" : "window:poe2:previous",
      kind: "window",
      label: game === "poe1" ? "Path of Exile 1" : "Path of Exile 2",
    },
    createdAt: "2026-07-01T00:00:00.000Z",
    deathClipSeconds: 10,
    game,
    id: `capture-profile-${game}`,
    isDefault: false,
    name: `${game} Capture`,
    recordingAudioInputDeviceId: null,
    recordingAudioOutputDeviceId: null,
    recordingAutoStartMode: "off",
    recordingClipQuality: "high",
    recordingEncoder: "hardware_h264",
    recordingFps: 60,
    recordingHideOverlaysFromRecording: true,
    recordingHideOverlaysFromRewind: true,
    recordingOutputResolution: "native",
    recordingRunQuality: "moderate",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

const profile = createCaptureProfile("poe1");
const poe2Profile = createCaptureProfile("poe2");

const storeMocks = vi.hoisted(() => ({
  settingsValue: {
    activeGame: "poe1",
    recordingAutoStartMode: "recording",
  },
  sources: [] as CapturePreviewSource[],
  selectedSourceId: "missing-window:poe1",
  profileItems: [] as CaptureProfile[],
  selectedProfileId: "capture-profile-poe1",
}));

vi.mock("~/renderer/store", () => ({
  useCaptureProfilesShallow: (selector: (state: unknown) => unknown) =>
    selector({
      items: storeMocks.profileItems,
      selectedProfileId: storeMocks.selectedProfileId,
    }),
  useCapturePreviewShallow: (selector: (state: unknown) => unknown) =>
    selector({
      selectedSourceId: storeMocks.selectedSourceId,
      sources: storeMocks.sources,
    }),
  useSettingsSelector: (selector: (state: unknown) => unknown) =>
    selector({ value: storeMocks.settingsValue }),
}));

import { CaptureAutoStartSourceWarning } from "./CaptureAutoStartSourceWarning";

let container: HTMLDivElement;
let root: Root;

async function renderWarning(): Promise<void> {
  await act(async () => {
    root.render(<CaptureAutoStartSourceWarning />);
  });
}

describe("CaptureAutoStartSourceWarning", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.settingsValue = {
      activeGame: "poe1",
      recordingAutoStartMode: "recording",
    };
    storeMocks.sources = [unavailableSource];
    storeMocks.selectedSourceId = unavailableSource.id;
    storeMocks.profileItems = [profile];
    storeMocks.selectedProfileId = profile.id;
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("warns when automatic startup is waiting for a selected game window", async () => {
    await renderWarning();

    expect(container.textContent).toContain(
      "Automatic recording will continue once Path of Exile 1 is running",
    );
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it("does not warn when the selected game window is available again", async () => {
    storeMocks.sources = [source];
    storeMocks.selectedSourceId = source.id;

    await renderWarning();

    expect(container.textContent).toBe("");
  });

  it("does not warn when automatic startup is disabled", async () => {
    storeMocks.settingsValue = {
      activeGame: "poe1",
      recordingAutoStartMode: "off",
    };
    storeMocks.sources = [source];
    storeMocks.selectedSourceId = source.id;

    await renderWarning();

    expect(container.textContent).toBe("");
  });

  it("warns about unavailable selected game sources without automatic startup", async () => {
    storeMocks.settingsValue = {
      activeGame: "poe1",
      recordingAutoStartMode: "off",
    };

    await renderWarning();

    expect(container.textContent).toContain(
      "Path of Exile 1 is currently unavailable",
    );
  });

  it("does not warn about unavailable saved capture targets unless the not-running source is selected", async () => {
    storeMocks.settingsValue = {
      activeGame: "poe1",
      recordingAutoStartMode: "off",
    };
    storeMocks.sources = [
      {
        displayId: "display-1",
        game: null,
        height: 1080,
        id: "screen:1",
        kind: "screen",
        name: "Screen 1",
        thumbnailDataUrl: null,
        width: 1920,
      },
      unavailableSource,
    ];
    storeMocks.selectedSourceId = "screen:1";

    await renderWarning();

    expect(container.textContent).toBe("");
  });

  it("uses the active game profile when persisted selection belongs to another game", async () => {
    storeMocks.profileItems = [profile, poe2Profile];
    storeMocks.selectedProfileId = poe2Profile.id;

    await renderWarning();

    expect(container.textContent).toContain(
      "Automatic recording will continue once Path of Exile 1 is running",
    );
  });
});
