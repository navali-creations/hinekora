import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";

import { CaptureProfileLockToggle } from "./CaptureProfileLockToggle";

const storeMocks = vi.hoisted(() => ({
  isProfileUnlocked: false,
  isRewindActive: false,
  isRunRecordingActive: false,
  isStartingRecording: false,
  isStoppingRecording: false,
  selectedProfileId: "capture-profile-1" as string | null,
  toggleProfileLock: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useCaptureProfilesShallow: <T,>(
    selector: (captureProfiles: BoundStore["captureProfiles"]) => T,
  ) =>
    selector({
      isProfileUnlocked: storeMocks.isProfileUnlocked,
      selectedProfileId: storeMocks.selectedProfileId,
      toggleProfileLock: storeMocks.toggleProfileLock,
    } as unknown as BoundStore["captureProfiles"]),
  useManagedRecorderShallow: <T,>(
    selector: (managedRecorder: BoundStore["managedRecorder"]) => T,
  ) =>
    selector({
      status: {
        bufferActive: storeMocks.isRewindActive,
        isStartingRecording: storeMocks.isStartingRecording,
        isStoppingRecording: storeMocks.isStoppingRecording,
        runRecordingActive: storeMocks.isRunRecordingActive,
      },
    } as unknown as BoundStore["managedRecorder"]),
}));

let container: HTMLDivElement;
let root: Root;

async function renderToggle(
  props: ComponentProps<typeof CaptureProfileLockToggle> = {},
): Promise<void> {
  await act(async () => {
    root.render(<CaptureProfileLockToggle {...props} />);
  });
}

describe("CaptureProfileLockToggle", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.isProfileUnlocked = false;
    storeMocks.isRewindActive = false;
    storeMocks.isRunRecordingActive = false;
    storeMocks.isStartingRecording = false;
    storeMocks.isStoppingRecording = false;
    storeMocks.selectedProfileId = "capture-profile-1";
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("toggles the selected profile lock", async () => {
    await renderToggle();

    const button = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Unlock capture profile']",
    );
    expect(button?.disabled).toBe(false);

    await act(async () => {
      button?.click();
    });

    expect(storeMocks.toggleProfileLock).toHaveBeenCalled();
  });

  it("renders the unlocked chip state", async () => {
    storeMocks.isProfileUnlocked = true;

    await renderToggle({ variant: "chip" });

    expect(container.textContent).toContain("Unlocked");
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Lock capture profile",
    );
  });

  it("disables the toggle without a selected profile", async () => {
    storeMocks.selectedProfileId = null;

    await renderToggle();

    expect(container.querySelector("button")?.disabled).toBe(true);
  });

  it("blocks unlocking while recording or rewind is active", async () => {
    storeMocks.isRunRecordingActive = true;

    await renderToggle();

    const button = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Unlock capture profile']",
    );
    expect(button?.disabled).toBe(true);
    expect(button?.title).toBe(
      "Stop recording or rewind before unlocking the profile",
    );

    await act(async () => {
      button?.click();
    });

    expect(storeMocks.toggleProfileLock).not.toHaveBeenCalled();
  });

  it("blocks unlocking while recording is starting or stopping", async () => {
    storeMocks.isStartingRecording = true;

    await renderToggle();

    const button = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Unlock capture profile']",
    );
    expect(button?.disabled).toBe(true);

    storeMocks.isStartingRecording = false;
    storeMocks.isStoppingRecording = true;
    await renderToggle();

    expect(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='Unlock capture profile']",
      )?.disabled,
    ).toBe(true);
  });

  it("allows locking while recording or rewind is active", async () => {
    storeMocks.isProfileUnlocked = true;
    storeMocks.isRewindActive = true;

    await renderToggle();

    const button = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Lock capture profile']",
    );
    expect(button?.disabled).toBe(false);

    await act(async () => {
      button?.click();
    });

    expect(storeMocks.toggleProfileLock).toHaveBeenCalled();
  });

  it("can render as an attached dropdown control", async () => {
    await renderToggle({ attached: true });

    expect(container.querySelector("button")?.className).toContain("join-item");
  });
});
