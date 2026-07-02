import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";

import type { CaptureProfile } from "~/types";
import { CaptureProfilesPanel } from "./CaptureProfilesPanel";

const storeMocks = vi.hoisted(() => ({
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  items: [] as CaptureProfile[],
  selectedProfileId: "poe1" as string | null,
  selectProfileWithPreviewSource: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useCaptureProfilesShallow: <T,>(
    selector: (captureProfiles: BoundStore["captureProfiles"]) => T,
  ) =>
    selector({
      create: storeMocks.createProfile,
      delete: storeMocks.deleteProfile,
      items: storeMocks.items,
      selectedProfileId: storeMocks.selectedProfileId,
      selectWithPreviewSource: storeMocks.selectProfileWithPreviewSource,
    } as unknown as BoundStore["captureProfiles"]),
}));

let container: HTMLDivElement;
let root: Root;

function createProfile(overrides: Partial<CaptureProfile>): CaptureProfile {
  return {
    captureTarget: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    deathClipSeconds: 10,
    game: "poe1",
    id: "poe1",
    isDefault: false,
    name: "Default PoE Capture",
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
    ...overrides,
  };
}

async function renderPanel(): Promise<void> {
  await act(async () => {
    root.render(<CaptureProfilesPanel />);
  });
}

function getProfileNameInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Capture profile name"]',
  );
  if (!input) {
    throw new Error("Expected capture profile name input to render");
  }

  return input;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CaptureProfilesPanel", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.createProfile.mockResolvedValue(undefined);
    storeMocks.deleteProfile.mockResolvedValue(undefined);
    storeMocks.items = [
      createProfile({
        id: "default-capture-poe1",
        isDefault: true,
        name: "Default PoE Capture",
      }),
      createProfile({
        game: "poe2",
        id: "default-capture-poe2",
        isDefault: true,
        name: "Default PoE 2 Capture",
      }),
      createProfile({
        game: "poe2",
        id: "poe2-bossing",
        name: "Bossing Capture",
      }),
    ];
    storeMocks.selectedProfileId = "default-capture-poe1";
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("creates a profile from the trimmed input name", async () => {
    await renderPanel();

    await act(async () => {
      const input = getProfileNameInput();
      setInputValue(input, "  Bossing Capture  ");
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button.btn-primary")?.click();
    });

    expect(storeMocks.createProfile).toHaveBeenCalledWith("Bossing Capture");
  });

  it("selects and deletes visible profiles", async () => {
    await renderPanel();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          'button[data-profile-id="poe2-bossing"]',
        )
        ?.click();
    });

    expect(storeMocks.selectProfileWithPreviewSource).toHaveBeenCalledWith(
      "poe2-bossing",
    );
    expect(container.textContent).toContain("Default PoE 1 Profile");
    expect(container.textContent).toContain("Default PoE 2 Profile");

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Delete Bossing Capture"]',
        )
        ?.click();
    });

    expect(storeMocks.deleteProfile).toHaveBeenCalledWith("poe2-bossing");
  });

  it("disables deleting default profiles", async () => {
    await renderPanel();

    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Delete Default PoE 1 Profile"]',
      )?.disabled,
    ).toBe(true);
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Delete Default PoE 2 Profile"]',
      )?.disabled,
    ).toBe(true);
  });

  it("disables deleting the last profile", async () => {
    storeMocks.items = [createProfile({ id: "poe1", name: "Bossing" })];
    await renderPanel();

    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Delete Bossing"]',
      )?.disabled,
    ).toBe(true);
  });

  it("shows the default recreation message when no profiles exist", async () => {
    storeMocks.items = [];
    await renderPanel();

    expect(container.textContent).toContain(
      "Default profile will be recreated automatically.",
    );
  });
});
